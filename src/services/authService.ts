import NetInfo from '@react-native-community/netinfo';
import { SecureTokenStore } from './secureTokenStore';
import { supabase } from './supabaseConfig';
import { AuthSession, ValidatedUser } from '../types/auth';
import { api, APIError } from './apiClient';
import { SCHOOL_NAME, SCHOOL_ID } from '../constants/school';

/** Single-flight refresh so TOKEN_REFRESHED storms don't stack validate calls */
let refreshSessionInFlight: Promise<AuthSession | null> | null = null;

function isTransientValidationError(err: unknown): boolean {
  if (err instanceof APIError) {
    const c = err.statusCode;
    if (c === 0 || c === 503 || (c !== undefined && c >= 500 && c < 600)) return true;
    if (c === 401) return true;
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('unavailable')) return true;
  }
  return false;
}

function shouldForceSignOutOnValidateError(err: unknown): boolean {
  if (err instanceof APIError && err.statusCode === 403) return true;
  return false;
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
  return authSession;
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

export const clearAuthState = async (): Promise<void> => {
  await removeSecureItem(STORAGE_KEY);
};

export const AuthService = {
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  signIn: async (email: string, password: string): Promise<{ session?: AuthSession; error?: string }> => {
    // 1. clearAuthState() — always clear before new login
    await clearAuthState();

    // 2. supabase.auth.signInWithPassword({ email, password })
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
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

      // 8. Return { session: AuthSession }
      return { session: authSession };
    } catch (err: any) {
      // 5. If 403 account_not_in_school → signOut(), return { error: "This account does not belong to this school." }
      // 6. If 403 account_locked → signOut(), return { error: "Your account is locked. Contact your admin." }

      // OUT_OF_HOURS: Re-throw so accounts-login.tsx can catch and show the access request modal
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

  signOut: async (): Promise<void> => {
    // 1. Remove from SecureStore
    await removeSecureItem(STORAGE_KEY);
    // 2. supabase.auth.signOut()
    await supabase.auth.signOut();
    // 3. Clear any in-memory cache (handled by useAuth state wiping)
  },

  getSession: async (): Promise<AuthSession | null> => {
    // Read from SecureStore
    const sessionStr = await getSecureItem(STORAGE_KEY);
    if (!sessionStr) return null;

    try {
      const session = JSON.parse(sessionStr) as AuthSession;
      // If token expired → call refreshSession()
      if (Date.now() >= session.tokenExpiresAt) {
        return await AuthService.refreshSession();
      }
      return session;
    } catch {
      return null;
    }
  },

  refreshSession: async (): Promise<AuthSession | null> => {
    if (refreshSessionInFlight) {
      return refreshSessionInFlight;
    }

    refreshSessionInFlight = (async (): Promise<AuthSession | null> => {
      const priorStr = await getSecureItem(STORAGE_KEY);
      let prior: AuthSession | null = null;
      if (priorStr) {
        try {
          prior = JSON.parse(priorStr) as AuthSession;
        } catch {
          prior = null;
        }
      }

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshData.session) {
        // Layer A fix: Don't immediately clear auth for ALL roles.
        // If we have a prior session, preserve it — the caller (useAuth handleRefresh)
        // will decide whether to retry or clear based on role and retry count.
        // Only clear if there's no prior session at all (nothing to fall back to).
        if (prior?.validatedUser) {
          console.warn('[AUTH_REFRESH] Supabase refresh failed but prior session exists — preserving for retry');
          return null; // Return null to signal failure without clearing storage
        }
        console.log('[AUTH_OUT]', 'token_expired', new Date().toISOString());
        await clearAuthState();
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
          // 403 from backend = confirmed rejection (wrong school, locked account)
          console.log('[AUTH_OUT]', 'api_403_confirmed', new Date().toISOString());
          await AuthService.signOut();
          return null;
        }
        // Layer A fix: For ALL roles, preserve prior validated user on transient errors.
        // Previously only student role got this treatment.
        if (prior?.validatedUser) {
          return persistSessionFromRefresh(refreshData.session, prior.validatedUser);
        }
        // No prior session to fall back to — signal failure
        console.log('[AUTH_OUT]', 'validation_failed_no_prior', new Date().toISOString());
        return null;
      }

      // Silent API path returns null on 401 without throwing
      if (!validatedUser) {
        // Layer A fix: always use prior validated user if available, regardless of role
        if (prior?.validatedUser) {
          return persistSessionFromRefresh(refreshData.session, prior.validatedUser);
        }
        console.log('[AUTH_OUT]', 'validation_null_no_prior', new Date().toISOString());
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
    return c === 'staff' || c === 'teacher';
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