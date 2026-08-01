import type { Session } from '@supabase/supabase-js';
import { SecureTokenStore } from './secureTokenStore';
import { supabase } from './supabaseConfig';
import { AuthSession, ValidatedUser } from '../types/auth';
import { api, APIError, registerSessionRecoveryCallback } from './apiClient';
import { SCHOOL_NAME, SCHOOL_ID } from '../constants/school';
import { normalizeLoginEmail } from '../utils/roleHelpers';
import * as accountVault from './accountVault';
import type { VaultAccount } from './accountVault';
import type { AccessContext, PortalContextsPayload } from '../types/context';
import { refreshAccessTokenStandalone } from './pushFanout';

const TOKEN_SKEW_SECONDS = 60;

function mapRoleCodeForFrontend(code: string): string {
  return code === 'accounts' ? 'accountant' : code;
}

/** Single-flight refresh so TOKEN_REFRESHED storms don't stack validate calls */
let refreshSessionInFlight: Promise<AuthSession | null> | null = null;
/** Single-flight cold-start repair so native and web screens cannot race session setup. */
let restorePersistedSessionInFlight: Promise<AuthSession | null> | null = null;

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 — internal session-swap guard + serialization
//
// `internalSwapDepth` is a module-level counter (NOT a boolean) that is held > 0
// for the entire duration of any internal supabase.auth.setSession() /
// signInWithPassword() we perform during switchAccount or the addAccount-restore
// step. useAuth's onAuthStateChange checks isInternalSessionSwap() and suppresses
// the events those calls emit (SIGNED_IN / TOKEN_REFRESHED) so they don't trip
// the "a brand-new login just happened" path. A counter (not a flag) keeps
// suppression on across nested/overlapping swaps until the LAST one completes.
//
// `enqueueSwap` serializes all live-client mutations (switchAccount + addAccount)
// onto a single promise chain, so two switches in quick succession (A→B→A) run
// sequentially and the vault's active pointer can never disagree with the live
// client's actual session. The shared core `doSwitchAccount` is intentionally
// NOT enqueued so addAccount can call it directly without self-deadlocking.
// ─────────────────────────────────────────────────────────────────────────
let internalSwapDepth = 0;
function beginInternalSwap(): void { internalSwapDepth += 1; }
function endInternalSwap(): void { internalSwapDepth = Math.max(0, internalSwapDepth - 1); }

/** True while we are performing an internal session swap; checked by useAuth. */
export function isInternalSessionSwap(): boolean { return internalSwapDepth > 0; }

let swapChain: Promise<unknown> = Promise.resolve();
/** Serialize all live-client mutations onto one chain (race-safe ordering). */
function enqueueSwap<T>(fn: () => Promise<T>): Promise<T> {
  const run = swapChain.then(fn, fn); // run regardless of the previous result
  swapChain = run.then(() => undefined, () => undefined); // keep the chain alive
  return run;
}

function isTransientValidationError(err: unknown): boolean {
  if (err instanceof APIError) {
    const c = err.statusCode;
    if (c === 0 || c === 503 || (c !== undefined && c >= 500 && c < 600)) return true;
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('unavailable')) return true;
  }
  return false;
}

function shouldForceSignOutOnValidateError(err: unknown): boolean {
  if (err instanceof APIError && err.statusCode === 403) return true;
  return false;
}

function isConfirmedRefreshRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const value = err as { status?: number; code?: string; message?: string };
  const code = (value.code || '').toLowerCase();
  const message = (value.message || '').toLowerCase();
  return (
    (value.status === 400 || value.status === 401) &&
    (
      code.includes('refresh_token') ||
      code.includes('invalid_grant') ||
      message.includes('refresh token') ||
      message.includes('invalid grant')
    )
  );
}

async function persistSessionFromRefresh(
  supabaseSession: NonNullable<AuthSession['supabaseSession']>,
  validatedUser: ValidatedUser
): Promise<AuthSession> {
  const authSession: AuthSession = {
    supabaseSession,
    validatedUser,
    tokenExpiresAt: supabaseSession.expires_at
      ? supabaseSession.expires_at * 1000
      : Date.now() + 3600000,
  };
  await setSecureItem(STORAGE_KEY, JSON.stringify(authSession));
  try {
    await accountVault.addAccount(accountVault.buildVaultAccount(authSession));
  } catch {
    // Vault sync is best-effort — never block session persistence.
  }
  return authSession;
}

/**
 * Last-resort recovery. Refresh tokens remain the primary mechanism; the
 * stored password is touched only after a refresh token is missing or
 * rejected. Credentials are persisted on every platform so switches do not
 * silently die when a dormant account's refresh token expires.
 */
async function recoverSessionWithSavedLogin(
  prior: Pick<AuthSession, 'validatedUser'>
): Promise<Session | null> {
  const credential = await accountVault.getLoginRecoveryCredential(
    prior.validatedUser.userId
  );
  if (!credential) return null;

  beginInternalSwap();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credential.email,
      password: credential.password,
    });
    if (
      error ||
      !data.session ||
      data.session.user.id !== prior.validatedUser.userId
    ) {
      return null;
    }
    return data.session;
  } finally {
    endInternalSwap();
  }
}

function vaultAccountAsPrior(target: VaultAccount): Pick<AuthSession, 'validatedUser'> {
  return { validatedUser: target.validatedUser };
}

async function saveRecoveryCredentialReliably(
  userId: string,
  email: string,
  password: string
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await accountVault.saveLoginRecoveryCredential(
        userId,
        email,
        password
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 50 * Math.pow(2, attempt))
        );
      }
    }
  }
  throw lastError;
}

async function syncVaultFromAuthSession(authSession: AuthSession): Promise<void> {
  await accountVault.addAccount(accountVault.buildVaultAccount(authSession));
}

/** Persist the live Supabase client's session for the account we're switching away from. */
async function snapshotLiveAccountToVault(
  account: VaultAccount,
  liveSession: Session | null
): Promise<void> {
  if (!liveSession?.refresh_token) return;
  const authSession: AuthSession = {
    supabaseSession: liveSession,
    validatedUser: account.validatedUser,
    tokenExpiresAt: liveSession.expires_at
      ? liveSession.expires_at * 1000
      : Date.now() + 3600000,
  };
  try {
    await syncVaultFromAuthSession(authSession);
  } catch {
    /* best-effort */
  }
}

function mergeRefreshedTokensIntoSession(
  base: Session,
  refreshed: { access_token: string; refresh_token: string; expires_at: number }
): Session {
  const nowS = Math.floor(Date.now() / 1000);
  return {
    ...base,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
    expires_in: Math.max(0, refreshed.expires_at - nowS),
  };
}

/**
 * Resolve usable access + refresh tokens for a vaulted account.
 * Uses standalone refresh (no live-client mutation) when tokens are missing or stale.
 * Does not touch the live client or stored passwords — callers handle password
 * recovery under the internal-swap guard.
 */
async function resolveTargetSessionTokens(
  target: VaultAccount,
  userId: string
): Promise<{ accessToken: string; refreshToken: string; needsRecovery: boolean }> {
  let refreshToken =
    target.supabaseSession?.refresh_token ??
    (await accountVault.getBackupRefreshTokenForUser(userId)) ??
    '';
  let accessToken = target.supabaseSession?.access_token ?? '';

  const expiresAt = target.supabaseSession?.expires_at ?? 0;
  const nowS = Math.floor(Date.now() / 1000);
  const needsRefresh =
    !refreshToken || !accessToken || !expiresAt || expiresAt <= nowS + TOKEN_SKEW_SECONDS;

  if (needsRefresh && refreshToken) {
    const refreshed = await refreshAccessTokenStandalone(refreshToken);
    if (refreshed) {
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token;
      const prefetchedSession = mergeRefreshedTokensIntoSession(
        target.supabaseSession ?? ({} as Session),
        refreshed
      );
      try {
        await syncVaultFromAuthSession({
          supabaseSession: prefetchedSession,
          validatedUser: target.validatedUser,
          tokenExpiresAt: refreshed.expires_at * 1000,
        });
      } catch {
        /* best-effort */
      }
      return { accessToken, refreshToken, needsRecovery: false };
    }
    return { accessToken, refreshToken, needsRecovery: true };
  }

  const tokensLookUsable =
    !!accessToken &&
    !!refreshToken &&
    !!expiresAt &&
    expiresAt > nowS + TOKEN_SKEW_SECONDS;
  return {
    accessToken,
    refreshToken,
    needsRecovery: !tokensLookUsable,
  };
}

async function restorePreviousLiveSession(
  previousActive: VaultAccount | null,
  previousLiveSession: Session | null
): Promise<void> {
  const sessionToRestore = previousLiveSession ?? previousActive?.supabaseSession ?? null;
  if (!sessionToRestore?.access_token) return;

  const refreshToken =
    sessionToRestore.refresh_token ||
    (previousActive ? await accountVault.getBackupRefreshTokenForUser(previousActive.userId) : null) ||
    '';
  if (!refreshToken) return;

  const { data, error } = await supabase.auth.setSession({
    access_token: sessionToRestore.access_token,
    refresh_token: refreshToken,
  });

  if (error || !data?.session) {
    if (__DEV__) {
      console.warn('[AuthService] failed to restore previous live session after switch failure:', error?.message);
    }
    return;
  }

  if (!previousActive) return;

  const restored = await persistSessionFromRefresh(data.session, previousActive.validatedUser);
  await accountVault.addAccount(accountVault.buildVaultAccount(restored));
  await accountVault.setActiveAccountId(previousActive.userId);
}

function mapSwitchErrorMessage(message?: string): string {
  const raw = message || "Could not restore this account's session";
  const lower = raw.toLowerCase();
  if (lower.includes('refresh token') || lower.includes('invalid') || lower.includes('expired')) {
    return 'This saved login expired. Remove it from the list, then add it again with email and password.';
  }
  if (lower.includes('could not restore')) {
    return 'This saved login expired. Remove it from the list, then add it again with email and password.';
  }
  return raw;
}

const STORAGE_KEY = 'auth_session';

async function setSecureItem(key: string, value: string) {
  await SecureTokenStore.setItem(key, value);
}

async function getSecureItem(key: string): Promise<string | null> {
  return await SecureTokenStore.getItem(key);
}

async function removeSecureItem(key: string) {
  await SecureTokenStore.removeItem(key);
}

async function readPersistedAuthSession(): Promise<AuthSession | null> {
  const raw = await getSecureItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.validatedUser && parsed?.supabaseSession ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Rebuild the live Supabase client from SchoolIMS's durable auth_session.
 *
 * Android can kill the JavaScript process and browsers can rebuild or restore a
 * page while leaving durable app data intact. In that state the UI identity
 * still exists, but the newly-created Supabase client can temporarily report
 * no session. refreshSession() without a live refresh token then returns
 * AuthSessionMissingError and every screen appears disconnected until a manual
 * login.
 *
 * This repair is deliberately non-destructive:
 *   1. reuse a matching live session when one already exists;
 *   2. explicitly set the persisted access + refresh tokens on the new client;
 *   3. if those tokens are dead, silently use the saved recovery credential.
 *
 * No failure in this function removes the remembered identity.
 */
async function restorePersistedSessionCore(): Promise<AuthSession | null> {
  const prior = await readPersistedAuthSession();
  if (!prior?.validatedUser || !prior.supabaseSession) return null;

  let liveSession: Session | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    liveSession = data.session;
  } catch {
    // Fall through to the independently persisted SchoolIMS session.
  }

  const liveMatchesRememberedUser =
    !!liveSession?.access_token &&
    !!liveSession?.refresh_token &&
    liveSession.user?.id === prior.validatedUser.userId;
  const liveExpiresAt = liveSession?.expires_at ?? 0;
  const liveIsUsable =
    liveMatchesRememberedUser &&
    liveExpiresAt > Math.floor(Date.now() / 1000) + TOKEN_SKEW_SECONDS;

  if (liveIsUsable && liveSession) {
    const liveDiffersFromPersisted =
      liveSession.access_token !== prior.supabaseSession.access_token ||
      liveSession.refresh_token !== prior.supabaseSession.refresh_token ||
      liveSession.expires_at !== prior.supabaseSession.expires_at;
    return liveDiffersFromPersisted
      ? persistSessionFromRefresh(liveSession, prior.validatedUser)
      : prior;
  }

  const candidate = liveMatchesRememberedUser
    ? liveSession
    : prior.supabaseSession;

  if (candidate?.access_token && candidate?.refresh_token) {
    beginInternalSwap();
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: candidate.access_token,
        refresh_token: candidate.refresh_token,
      });
      if (
        !error &&
        data?.session &&
        data.session.user.id === prior.validatedUser.userId
      ) {
        return persistSessionFromRefresh(
          data.session,
          prior.validatedUser
        );
      }
    } catch {
      // Saved-login recovery below is the final repair layer.
    } finally {
      endInternalSwap();
    }
  }

  const recovered = await recoverSessionWithSavedLogin(prior);
  if (!recovered) return null;
  return persistSessionFromRefresh(recovered, prior.validatedUser);
}

export const clearAuthState = async (): Promise<void> => {
  await removeSecureItem(STORAGE_KEY);
};

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 — shared switch core
// ─────────────────────────────────────────────────────────────────────────

/**
 * Shared switch core (NOT enqueued — callers serialize via enqueueSwap).
 *
 * Pulls the target's stored session from the vault, sets it on the live
 * Supabase client (silently recovering an expired access token via its stored
 * refresh token), persists it as the active `auth_session`, updates the vault's
 * active pointer, and kicks off background re-validation.
 *
 * INVARIANT 1: never calls clearAuthState()/signIn()/SecureTokenStore.removeItem.
 * Only setItem-based writes are used, so the account being switched AWAY from is
 * never wiped. Token fidelity: if the stored access token was still valid (no
 * SDK rotation), the ORIGINAL stored session bytes are written back verbatim, so
 * a round-trip (A→B→A) leaves A's `auth_session` + single backup byte-identical.
 */
async function doSwitchAccount(
  userId: string
): Promise<{ session?: AuthSession; error?: string }> {
  const accounts = await accountVault.listAccounts();
  const target = accounts.find((a) => a.userId === userId);
  if (!target) return { error: 'Account not found in vault' };
  const previousActiveId = await accountVault.getActiveAccountId();
  const previousActive =
    previousActiveId && previousActiveId !== userId
      ? accounts.find((a) => a.userId === previousActiveId) ?? null
      : null;
  const { data: { session: previousLiveSession } } = await supabase.auth.getSession();

  // Keep the account we're leaving in sync with the live client's latest tokens.
  if (previousActive && previousLiveSession?.refresh_token) {
    await snapshotLiveAccountToVault(previousActive, previousLiveSession);
  }

  const { accessToken, refreshToken, needsRecovery } = await resolveTargetSessionTokens(
    target,
    userId
  );

  beginInternalSwap();
  try {
    let liveSession: Session | null = null;
    let setSessionError: string | undefined;

    if (!needsRecovery && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!error && data?.session) {
        liveSession = data.session;
      } else {
        setSessionError = error?.message;
      }
    }

    // Refresh dead or setSession rejected → rebuild from durable login credential.
    if (!liveSession) {
      const recovered = await recoverSessionWithSavedLogin(vaultAccountAsPrior(target));
      if (recovered) {
        liveSession = recovered;
      }
    }

    if (!liveSession) {
      await restorePreviousLiveSession(previousActive, previousLiveSession);
      return {
        error: mapSwitchErrorMessage(
          setSessionError ||
            (refreshToken ? 'Could not restore this account\'s session' : 'No saved session for this account')
        ),
      };
    }

    return await finalizeSwitchedSession(
      liveSession,
      target,
      previousActive,
      previousLiveSession
    );
  } catch (e: any) {
    await restorePreviousLiveSession(previousActive, previousLiveSession);
    return { error: mapSwitchErrorMessage(e?.message || 'Account switch failed') };
  } finally {
    endInternalSwap();
  }
}

async function finalizeSwitchedSession(
  liveSession: Session,
  target: VaultAccount,
  previousActive: VaultAccount | null,
  previousLiveSession: Session | null
): Promise<{ session?: AuthSession; error?: string }> {
  const validatedUser = await api.post<ValidatedUser>(
    '/auth/validate-school-user',
    {},
    {
      headers: { Authorization: `Bearer ${liveSession.access_token}` },
      silent: true,
      timeoutMs: 20000,
    }
  );
  if (
    !validatedUser ||
    validatedUser.userId !== target.userId ||
    validatedUser.schoolId !== SCHOOL_ID
  ) {
    await restorePreviousLiveSession(previousActive, previousLiveSession);
    return { error: 'This saved account is no longer authorized. Sign in again.' };
  }

  const newActive: AuthSession = {
    supabaseSession: liveSession,
    validatedUser,
    tokenExpiresAt: liveSession.expires_at
      ? liveSession.expires_at * 1000
      : Date.now() + 3600000,
  };

  await setSecureItem(STORAGE_KEY, JSON.stringify(newActive));

  try {
    await syncVaultFromAuthSession(newActive);
  } catch {
    /* best-effort */
  }
  await accountVault.setActiveAccountId(target.userId);

  return { session: newActive };
}

export const AuthService = {
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    const email = currentSession?.user?.email;
    const userId = currentSession?.user?.id;
    if (!email || !userId || !currentPassword) {
      throw new Error('Current password is required.');
    }

    beginInternalSwap();
    try {
      const { data: reauthenticated, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
      if (
        signInError ||
        !reauthenticated.session ||
        reauthenticated.session.user.id !== userId
      ) {
        throw new Error('Current password is incorrect.');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await saveRecoveryCredentialReliably(
        userId,
        email,
        newPassword
      );
    } finally {
      endInternalSwap();
    }
  },

  /**
   * Patch the active user's photoUrl in the persisted auth_session AND the
   * multi-account vault, then return the updated in-memory session so the
   * provider can re-render every avatar that reads validatedUser.photoUrl.
   * Tokens are never touched. Returns null if there is no stored session.
   */
  updateActivePhotoUrl: async (photoUrl: string | null): Promise<AuthSession | null> => {
    const raw = await getSecureItem(STORAGE_KEY);
    if (!raw) return null;
    let parsed: AuthSession;
    try {
      parsed = JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
    if (!parsed?.validatedUser) return null;

    const updated: AuthSession = {
      ...parsed,
      validatedUser: { ...parsed.validatedUser, photoUrl },
    };

    await setSecureItem(STORAGE_KEY, JSON.stringify(updated));
    try {
      await accountVault.addAccount(accountVault.buildVaultAccount(updated));
    } catch {
      // Vault update is best-effort — never block the photo change on it.
    }
    return updated;
  },

  applyPortalContext: async (
    activeContext: AccessContext,
    portalContexts?: PortalContextsPayload | null
  ): Promise<AuthSession | null> => {
    const raw = await getSecureItem(STORAGE_KEY);
    if (!raw) return null;
    let parsed: AuthSession;
    try {
      parsed = JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
    if (!parsed?.validatedUser) return null;

    const primaryRole = activeContext.role_codes[0] || parsed.validatedUser.role?.code || 'student';
    const roleCode = mapRoleCodeForFrontend(primaryRole);

    const updated: AuthSession = {
      ...parsed,
      validatedUser: {
        ...parsed.validatedUser,
        role: { code: roleCode, name: roleCode },
        roles: (activeContext.role_codes || []).map(mapRoleCodeForFrontend),
        permissions: activeContext.permissions ?? parsed.validatedUser.permissions,
        staffId: activeContext.staff_id ?? parsed.validatedUser.staffId,
        portalContexts: portalContexts ?? parsed.validatedUser.portalContexts,
      },
    };

    await setSecureItem(STORAGE_KEY, JSON.stringify(updated));
    try {
      await accountVault.addAccount(accountVault.buildVaultAccount(updated));
    } catch {
      // best-effort
    }
    return updated;
  },

  signIn: async (email: string, password: string): Promise<{ session?: AuthSession; error?: string }> => {
    // 1. clearAuthState() — always clear before new login
    await clearAuthState();

    const canonicalEmail = normalizeLoginEmail(email);

    // 2. supabase.auth.signInWithPassword({ email, password })
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: canonicalEmail,
      password,
    });

    // 3. If Supabase error → return { error: "Invalid credentials" }
    if (signInError || !signInData.session) {
      return { error: 'Invalid credentials' };
    }

    // 4. Call POST /api/auth/validate-school-user with JWT
    try {
      const validatedUser = await api.post<ValidatedUser>('/auth/validate-school-user', {}, {
        headers: {
          'Authorization': `Bearer ${signInData.session.access_token}`
        },
        silent: true
      });

      // Guard: If validation failed (e.g. 401/403 returned null due to silent: true)
      if (!validatedUser) {
        throw new Error('Verification failed. Your session could not be validated.');
      }

      // 5. Multitenancy gate: verify user belongs to THIS school build
      if (validatedUser.schoolId !== SCHOOL_ID) {
        console.log('[AUTH_OUT]', 'api_401', new Date().toISOString());
        await AuthService.signOut();
        return { error: `This account does not belong to ${SCHOOL_NAME}.\nContact your school administrator.` };
      }

      // 7. Store AuthSession in SecureStore
      const authSession: AuthSession = {
        supabaseSession: signInData.session,
        validatedUser,
        tokenExpiresAt: signInData.session.expires_at ? signInData.session.expires_at * 1000 : Date.now() + 3600000,
      };

      await setSecureItem(STORAGE_KEY, JSON.stringify(authSession));

      // 7b. Register the session into the multi-account vault so a single-account
      //     user is transparently "a vault of one" and is set as the active
      //     account. Wrapped so a vault failure can NEVER break the existing
      //     login flow (backward-compat invariant).
      try {
        await accountVault.addAccount(accountVault.buildVaultAccount(authSession));
        await accountVault.setActiveAccountId(authSession.validatedUser.userId);
        await saveRecoveryCredentialReliably(
          authSession.validatedUser.userId,
          canonicalEmail,
          password
        );
      } catch (vaultErr) {
        if (__DEV__) console.warn('[AuthService] vault register (signIn) failed:', vaultErr);
      }

      // 8. Return { session: AuthSession }
      return { session: authSession };
    } catch (err: any) {
      // 5. If 403 account_not_in_school → signOut(), return { error: "This account does not belong to this school." }
      // 6. If 403 account_locked → signOut(), return { error: "Your account is locked. Contact your admin." }

      // OUT_OF_HOURS: Re-throw so the unified login screen (app/login.tsx) can catch and show the access request modal
      const errCode = err?.code;
      const errMsg = err?.message || '';
      
      const isOutOfHours =
        errCode === 'OUT_OF_HOURS_NO_ACCESS' ||
        errMsg.includes('Accounts department access is restricted to school hours') ||
        errMsg.indexOf('OUT_OF_HOURS_NO_ACCESS') !== -1;

      if (isOutOfHours) {
        console.log('[AUTH_OUT]', 'api_401', new Date().toISOString());
        await AuthService.signOut();
        const outOfHoursError: any = new Error(errMsg || 'Access restricted to school hours');
        outOfHoursError.code = 'OUT_OF_HOURS_NO_ACCESS';
        outOfHoursError.userId = signInData.user.id;
        throw outOfHoursError;
      }

      let errorMsg = err?.message || 'Validation failed. Contact support.';
      
      const errMsgLc = errMsg.toLowerCase();
      if (errMsgLc.includes('account_not_in_school') || errMsgLc.includes('is not registered with')) {
        errorMsg = `This account is not registered with ${SCHOOL_NAME}.\nContact your school administrator.`;
      } else if (err?.code === 'SCHOOL_MISMATCH' || errMsgLc.includes('user does not belong to this school')) {
        errorMsg = `This account does not belong to ${SCHOOL_NAME}.\nContact your school administrator.`;
      } else if (errMsgLc.includes('account_locked')) {
        errorMsg = `Your account has been locked. Contact ${SCHOOL_NAME} admin.`;
      } else if (errMsgLc.includes('account_not_active')) {
        errorMsg = `Your account is not active. Contact ${SCHOOL_NAME} admin.`;
      } else if (errMsgLc.includes('school_id is required')) {
        errorMsg = 'Tenant context missing. Please restart the app and try again.';
      }

      console.log('[AUTH_OUT]', 'api_401', new Date().toISOString());
      await AuthService.signOut();
      return { error: errorMsg };
    }
  },

  /**
   * addAccount — additive login for the multi-account vault, with Phase-2
   * live-client reconciliation.
   *
   * Same login + validation as signIn(), but never calls clearAuthState() and
   * never writes the active `auth_session` slot for an *existing* multi-account
   * setup. The whole operation is serialized onto the swap chain and held under
   * the internal-swap guard so the events emitted by signInWithPassword (and the
   * restore) are suppressed in useAuth.
   *
   * Active-account reconciliation (case determined from the vault pointer BEFORE
   * the login mutates anything):
   *   - A different account was active  → restore it as the live + active account
   *     via the shared doSwitchAccount() (no duplicated setSession logic).
   *   - No account was active (very first add on this device) → the new account
   *     becomes and stays active; persist it as `auth_session` + pointer.
   *   - The active account was re-added  → no-op (already live + active).
   */
  addAccount: (email: string, password: string): Promise<{ session?: AuthSession; error?: string }> =>
    enqueueSwap(async () => {
      const canonicalEmail = normalizeLoginEmail(email);
      // Capture the active pointer BEFORE signInWithPassword mutates the client.
      const previousActiveUserId = await accountVault.getActiveAccountId();

      beginInternalSwap();
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: canonicalEmail,
          password,
        });

        if (signInError || !signInData.session) {
          // signInWithPassword does not set a session on failure; restore the
          // previous active account if the client state was disturbed.
          if (previousActiveUserId) {
            try { await doSwitchAccount(previousActiveUserId); } catch { /* best-effort */ }
          }
          return { error: 'Invalid credentials' };
        }

        try {
          const validatedUser = await api.post<ValidatedUser>('/auth/validate-school-user', {}, {
            headers: { Authorization: `Bearer ${signInData.session.access_token}` },
            silent: true,
          });

          if (!validatedUser) {
            if (previousActiveUserId) await doSwitchAccount(previousActiveUserId);
            return { error: 'Verification failed. Your session could not be validated.' };
          }

          // Same-school gate — this single-tenant build only ever holds one school.
          if (validatedUser.schoolId !== SCHOOL_ID) {
            if (previousActiveUserId) await doSwitchAccount(previousActiveUserId);
            return { error: `This account does not belong to ${SCHOOL_NAME}.\nContact your school administrator.` };
          }

          const authSession: AuthSession = {
            supabaseSession: signInData.session,
            validatedUser,
            tokenExpiresAt: signInData.session.expires_at ? signInData.session.expires_at * 1000 : Date.now() + 3600000,
          };

          // Persist the new account into the vault (does not change active yet).
          await accountVault.addAccount(accountVault.buildVaultAccount(authSession));
          await saveRecoveryCredentialReliably(
            authSession.validatedUser.userId,
            canonicalEmail,
            password
          );

          const newUserId = validatedUser.userId;
          if (previousActiveUserId && previousActiveUserId !== newUserId) {
            // Restore the previously-active account as the live + active session.
            await doSwitchAccount(previousActiveUserId);
          } else if (!previousActiveUserId) {
            // First account ever — it becomes active; client is already on it.
            await setSecureItem(STORAGE_KEY, JSON.stringify(authSession));
            await accountVault.setActiveAccountId(newUserId);
          }
          // (previousActiveUserId === newUserId → re-added the active account; no-op.)

          return { session: authSession };
        } catch (err: any) {
          // Validation threw — restore the previous active account, then map error.
          if (previousActiveUserId) {
            try { await doSwitchAccount(previousActiveUserId); } catch { /* best-effort */ }
          }
          const errMsg = err?.message || '';
          const errMsgLc = errMsg.toLowerCase();
          let errorMsg = errMsg || 'Validation failed. Contact support.';

          if (errMsgLc.includes('account_not_in_school') || errMsgLc.includes('is not registered with')) {
            errorMsg = `This account is not registered with ${SCHOOL_NAME}.\nContact your school administrator.`;
          } else if (err?.code === 'SCHOOL_MISMATCH' || errMsgLc.includes('user does not belong to this school')) {
            errorMsg = `This account does not belong to ${SCHOOL_NAME}.\nContact your school administrator.`;
          } else if (errMsgLc.includes('account_locked')) {
            errorMsg = `Your account has been locked. Contact ${SCHOOL_NAME} admin.`;
          } else if (errMsgLc.includes('account_not_active')) {
            errorMsg = `Your account is not active. Contact ${SCHOOL_NAME} admin.`;
          }
          return { error: errorMsg };
        }
      } finally {
        endInternalSwap();
      }
    }),

  /**
   * switchAccount — seamlessly make a vaulted account the live + active account.
   * Serialized onto the swap chain (race-safe under rapid A→B→A). Delegates to
   * the shared doSwitchAccount core. Never prompts for a password; if the
   * stored refresh token is dead it silently rebuilds the session from the
   * durable login credential saved at sign-in / add-account time.
   */
  switchAccount: (userId: string): Promise<{ session?: AuthSession; error?: string }> =>
    enqueueSwap(() => doSwitchAccount(userId)),

  signOut: async (): Promise<void> => {
    // 1. Remove from SecureStore
    await removeSecureItem(STORAGE_KEY);
    // 2. supabase.auth.signOut()
    await supabase.auth.signOut();
    // 3. Clear any in-memory cache (handled by useAuth state wiping)
  },

  getSession: async (): Promise<AuthSession | null> => {
    const session = await readPersistedAuthSession();
    if (!session) return null;
    // Restore the locally validated app identity immediately, even when its
    // short-lived access token is stale. AuthProvider explicitly awaits live
    // client hydration during boot; this local read never starts a second,
    // unobserved recovery job.
    return session;
  },

  /** Local-only read used while handling Supabase auth events. */
  getStoredSession: async (): Promise<AuthSession | null> => {
    return readPersistedAuthSession();
  },

  /**
   * Ensure the live Supabase client is usable after process death. Concurrent
   * boot, foreground, and API recovery calls all share the same repair.
   */
  restorePersistedSession: async (): Promise<AuthSession | null> => {
    if (restorePersistedSessionInFlight) {
      return restorePersistedSessionInFlight;
    }
    restorePersistedSessionInFlight = restorePersistedSessionCore().finally(() => {
      restorePersistedSessionInFlight = null;
    });
    return restorePersistedSessionInFlight;
  },

  /**
   * Persist the session Supabase already rotated. Calling refreshSession()
   * from TOKEN_REFRESHED would rotate twice and can race the SDK storage write.
   */
  adoptRefreshedSession: async (
    refreshed: Session
  ): Promise<AuthSession | null> => {
    const prior = await readPersistedAuthSession();
    if (
      !prior?.validatedUser ||
      refreshed.user.id !== prior.validatedUser.userId
    ) {
      return null;
    }
    return persistSessionFromRefresh(refreshed, prior.validatedUser);
  },

  refreshSession: async (): Promise<AuthSession | null> => {
    if (refreshSessionInFlight) {
      return refreshSessionInFlight;
    }

    refreshSessionInFlight = (async (): Promise<AuthSession | null> => {
      const prior = await readPersistedAuthSession();

      let { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshData.session) {
        if (isConfirmedRefreshRejection(refreshError)) {
          // Refresh-token rejection is recoverable on native when the user
          // previously completed a successful password login on this device.
          // Do not erase the cached app session before trying that recovery.
          if (prior?.validatedUser) {
            const recovered = await recoverSessionWithSavedLogin(prior);
            if (recovered) {
              refreshData = { ...refreshData, session: recovered };
              refreshError = null;
            } else {
              console.warn(
                '[AUTH_REFRESH] Refresh token rejected and saved-login recovery was unavailable; cached session preserved'
              );
              return null;
            }
          } else {
            return null;
          }
        } else if (prior?.validatedUser) {
          // A newly-created native or browser client may not yet have a live
          // session even though SchoolIMS's durable auth_session survived.
          // Rehydrate it explicitly instead of retrying "session missing"
          // forever behind an apparently logged-in UI.
          const restored = await AuthService.restorePersistedSession();
          if (restored?.supabaseSession) {
            refreshData = {
              ...refreshData,
              session: restored.supabaseSession,
            };
            refreshError = null;
          }
        }
      }

      if (refreshError || !refreshData.session) {
        // Layer A fix: Don't immediately clear auth for ALL roles.
        // If we have a prior session, preserve it — the caller (useAuth handleRefresh)
        // will decide whether to retry or clear based on role and retry count.
        // Only clear if there's no prior session at all (nothing to fall back to).
        if (prior?.validatedUser) {
          console.warn('[AUTH_REFRESH] Supabase refresh failed but prior session exists — preserving for retry');
          return null; // Return null to signal failure without clearing storage
        }
        console.warn('[AUTH_REFRESH] No cached identity is available for recovery');
        return null;
      }

      let validatedUser: ValidatedUser | null = null;
      try {
        validatedUser = await api.post<ValidatedUser>(
          '/auth/validate-school-user',
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshData.session.access_token}`,
            },
            silent: true,
          }
        );
      } catch (err) {
        if (shouldForceSignOutOnValidateError(err)) {
          console.log('[AUTH_OUT]', 'api_403_confirmed', new Date().toISOString());
          await AuthService.signOut();
          return null;
        }
        if (isTransientValidationError(err) && prior?.validatedUser) {
          return persistSessionFromRefresh(refreshData.session, prior.validatedUser);
        }
        console.warn('[AUTH_REFRESH] Validation failed without cached identity');
        return null;
      }

      if (!validatedUser) {
        console.warn('[AUTH_REFRESH] Empty validation response; cached session preserved');
        return null;
      }

      if (validatedUser.schoolId !== SCHOOL_ID) {
        console.log('[AUTH_OUT]', 'school_mismatch', new Date().toISOString());
        await AuthService.signOut();
        return null;
      }

      return persistSessionFromRefresh(refreshData.session, validatedUser);
    })().finally(() => {
      refreshSessionInFlight = null;
    });

    return refreshSessionInFlight;
  },

  // Role check helpers
  isAdmin: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'admin';
  },
  isStaff: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    const c = session?.validatedUser?.role?.code;
    return c === 'staff' || c === 'teacher' || c === 'principal';
  },
  isStudent: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'student';
  },
  isAccounts: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'accountant';
  },
  isPrincipal: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'principal';
  },
  isDriver: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'driver';
  }
};

// Register at module initialization, before any screen effect can issue an API
// request. The callback returns only the Supabase session required for retry;
// AuthService remains the single owner of persistence and backend validation.
registerSessionRecoveryCallback(async (reason) => {
  const restored = await AuthService.restorePersistedSession();
  if (!restored) return null;

  // A missing client session has already been repaired by setSession (which
  // refreshes expired tokens itself). A server 401 or pre-expiry check needs an
  // explicit rotation before retrying the original request.
  if (reason === 'missing') return restored.supabaseSession;

  const refreshed = await AuthService.refreshSession();
  return (refreshed ?? restored).supabaseSession;
});
