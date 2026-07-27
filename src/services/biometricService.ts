import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { isFingerprintEligibleRole } from '../utils/roleHelpers';

/**
 * biometricService.ts — opt-in fingerprint login / app unlock.
 *
 * SCOPE
 *   Strong fingerprint ONLY, on native Android/iOS only, for the higher-
 *   authority staff/admin roles only (see isFingerprintEligibleRole). This
 *   module is a *local device* gate: it decides whether the phone in the
 *   user's hand may re-enter an already-authenticated account. It is NEVER
 *   server authorization — the backend's own token validation and school
 *   membership checks remain the only authority on what an account may do.
 *
 * WHAT IS STORED
 *   One tiny opt-in record per (schoolId, userId), under its own namespaced
 *   SecureStore key. No passwords, no refresh tokens, no session material:
 *   after a successful scan we hand control back to the existing account
 *   vault, which already owns every token. There is deliberately no global
 *   `biometric_enabled` / `biometric_user_id` / biometric refresh-token key —
 *   those would let one account's scan unlock a sibling account.
 *
 * FAIL-CLOSED RULES
 *   Any doubt means "no fingerprint, use email and password": an ineligible
 *   or unknown role, a device that no longer reports a strong enrolled
 *   fingerprint, a capability signature that no longer matches the one
 *   recorded at enable time, a SecureStore read/write error, or a corrupt
 *   record. In the recoverable-by-re-enrolling cases the stale record is
 *   deleted so the user is never left with a switch that claims to be on.
 *
 * PLATFORM HONESTY
 *   `authenticateAsync` shows the *system* biometric prompt. On a phone that
 *   exposes more than one Class 3 / strong modality (for example a strong
 *   fingerprint sensor plus a strong 3D face unlock), the OS decides which
 *   sensor that prompt ultimately accepts — expo-local-authentication exposes
 *   no API to pin the prompt to the fingerprint sensor.
 *
 *   Modern Android phones almost always report Face + Fingerprint in
 *   `supportedAuthenticationTypesAsync` (hardware capability, not enrolment),
 *   so we do NOT refuse hybrid hardware. We require fingerprint hardware to be
 *   present and the enrolled level to be BIOMETRIC_STRONG, and we set
 *   `biometricsSecurityLevel: 'strong'` + `disableDeviceFallback` so weak face
 *   unlock and the device PIN/pattern/passcode are never accepted.
 */

/** Namespaced, per-account key. SecureStore keys allow [A-Za-z0-9._-] only. */
const OPT_IN_KEY_PREFIX = 'fp_optin_v1';
const PROOF_KEY_PREFIX = 'fp_proof_v1';

/** How long a fingerprint success stays valid for the switch it authorized. */
const TICKET_TTL_MS = 30_000;

export type FingerprintUnavailableReason =
  /** Web or Tauri desktop — the feature does not exist there. */
  | 'unsupported_platform'
  /** No biometric sensor at all. */
  | 'no_hardware'
  /** Sensor exists but nothing is enrolled. */
  | 'not_enrolled'
  /** Enrolled, but no fingerprint — e.g. a face-only device. */
  | 'no_fingerprint'
  /**
   * Legacy reason kept for stored/translated error paths. Hybrid Face +
   * Fingerprint hardware is no longer rejected (see getFingerprintCapability).
   */
  | 'mixed_biometrics'
  /** Enrolled fingerprint is not Class 3 / BIOMETRIC_STRONG. */
  | 'weak_biometric'
  /** The capability probe itself threw. */
  | 'probe_failed';

export interface FingerprintCapability {
  available: boolean;
  reason: FingerprintUnavailableReason | null;
  /**
   * Stable description of the enrolled biometric configuration, recorded when
   * the user opts in and re-checked on every unlock. If it stops matching we
   * fail closed and require password login.
   *
   * Caveat worth stating plainly: the platform API reports modalities and the
   * enrolled security level, not the identity of individual enrolled fingers.
   * Removing every fingerprint, dropping to a weak modality, or losing the
   * sensor is detected; silently adding one more finger to an already-strong
   * enrolment is not observable through expo-local-authentication.
   */
  signature: string | null;
}

export interface FingerprintAccountRef {
  schoolId: number;
  userId: string;
  roleCode: string | null | undefined;
}

export type FingerprintFailureReason =
  | FingerprintUnavailableReason
  | 'ineligible_role'
  | 'not_enabled'
  | 'enrollment_changed'
  | 'storage_error'
  | 'cancelled'
  | 'lockout'
  | 'busy'
  | 'failed';

export interface FingerprintResult {
  success: boolean;
  reason?: FingerprintFailureReason;
}

interface OptInRecord {
  v: 1;
  schoolId: number;
  userId: string;
  roleCode: string;
  signature: string;
  enabledAt: number;
}

// ── Platform ─────────────────────────────────────────────────────────────

/** Native Android/iOS only. Web and the Tauri desktop wrapper (which ships the
 *  web bundle) never see this feature. */
export function isFingerprintPlatformSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

// ── Device capability ────────────────────────────────────────────────────

/**
 * A device qualifies only when ALL of these hold: biometric hardware exists,
 * something is enrolled, the supported modalities include FINGERPRINT, and the
 * enrolled level is BIOMETRIC_STRONG. A face-only phone, a weak (2D image)
 * face unlock, and a PIN/pattern-only device all fail here.
 *
 * Hybrid Face + Fingerprint hardware is allowed: Android reports both whenever
 * the chipset has both sensors, even if the user only enrolled a fingerprint.
 */
export async function getFingerprintCapability(): Promise<FingerprintCapability> {
  if (!isFingerprintPlatformSupported()) {
    return { available: false, reason: 'unsupported_platform', signature: null };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, reason: 'no_hardware', signature: null };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { available: false, reason: 'not_enrolled', signature: null };
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (!types?.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return { available: false, reason: 'no_fingerprint', signature: null };
    }

    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
      return { available: false, reason: 'weak_biometric', signature: null };
    }

    return { available: true, reason: null, signature: buildSignature(types, level) };
  } catch {
    // Never surface the raw platform error — it can name device internals.
    return { available: false, reason: 'probe_failed', signature: null };
  }
}

function buildSignature(
  types: LocalAuthentication.AuthenticationType[],
  level: LocalAuthentication.SecurityLevel
): string {
  const sorted = [...types].sort((a, b) => a - b).join(',');
  return `v1:${Platform.OS}:${level}:${sorted}`;
}

// ── Native prompt ────────────────────────────────────────────────────────

/**
 * Serializes every prompt in the process. Rapid taps, an AppState resume that
 * races the cold-start unlock, and an account switch firing mid-prompt all
 * await the same promise instead of stacking native dialogs on top of each
 * other (which Android answers by cancelling all of them).
 */
let promptInFlight: { intentKey: string; promise: Promise<FingerprintResult> } | null = null;

export interface FingerprintPromptCopy {
  promptMessage: string;
  promptSubtitle?: string;
  cancelLabel: string;
}

/**
 * Show the system strong-biometric prompt.
 *
 * `disableDeviceFallback: true` + an empty `fallbackLabel` remove the iOS
 * "Use Passcode" button, and `biometricsSecurityLevel: 'strong'` restricts
 * Android to Class 3 (which also stops the framework offering device
 * credentials). The device PIN, pattern, passcode, and any weak face unlock
 * are therefore never accepted as a fallback for this feature.
 */
export async function promptFingerprint(
  copy: FingerprintPromptCopy,
  intentKey = 'unscoped'
): Promise<FingerprintResult> {
  if (promptInFlight) {
    // Coalesce duplicate taps for one account/intent, but never let another
    // account inherit the first prompt's success.
    if (promptInFlight.intentKey === intentKey) return promptInFlight.promise;
    return { success: false, reason: 'busy' };
  }

  const promise = (async (): Promise<FingerprintResult> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: copy.promptMessage,
        promptSubtitle: copy.promptSubtitle,
        cancelLabel: copy.cancelLabel,
        disableDeviceFallback: true,
        fallbackLabel: '',
        biometricsSecurityLevel: 'strong',
        requireConfirmation: true,
      });

      if (result.success) return { success: true };
      return { success: false, reason: mapAuthError(result.error) };
    } catch {
      return { success: false, reason: 'failed' };
    } finally {
      promptInFlight = null;
    }
  })();

  promptInFlight = { intentKey, promise };
  return promise;
}

function mapAuthError(error: string | undefined): FingerprintFailureReason {
  switch (error) {
    case 'user_cancel':
    case 'app_cancel':
    case 'system_cancel':
    case 'user_fallback':
      return 'cancelled';
    case 'lockout':
      return 'lockout';
    case 'not_enrolled':
      return 'not_enrolled';
    case 'not_available':
      return 'no_hardware';
    case 'passcode_not_set':
      return 'not_enrolled';
    default:
      return 'failed';
  }
}

// ── Per-account opt-in storage ───────────────────────────────────────────

/** Key is namespaced by BOTH school and user so accounts never share state. */
export function buildOptInKey(schoolId: number, userId: string): string {
  return `${OPT_IN_KEY_PREFIX}_${schoolId}_${sanitize(userId)}`;
}

function buildProofKey(schoolId: number, userId: string): string {
  return `${PROOF_KEY_PREFIX}_${schoolId}_${sanitize(userId)}`;
}

/** SecureStore rejects keys outside [A-Za-z0-9._-]; UUIDs already comply. */
function sanitize(value: string): string {
  return String(value).replace(/[^A-Za-z0-9._-]/g, '_');
}

async function readRecord(
  schoolId: number,
  userId: string
): Promise<{ record: OptInRecord | null; storageError: boolean }> {
  if (!isFingerprintPlatformSupported() || !userId) {
    return { record: null, storageError: false };
  }
  try {
    const raw = await SecureStore.getItemAsync(buildOptInKey(schoolId, userId));
    if (!raw) return { record: null, storageError: false };
    const parsed = JSON.parse(raw) as OptInRecord;
    // A record that does not describe this exact account is not trusted.
    if (
      parsed?.v !== 1 ||
      parsed.userId !== userId ||
      parsed.schoolId !== schoolId ||
      typeof parsed.signature !== 'string' ||
      typeof parsed.roleCode !== 'string' ||
      typeof parsed.enabledAt !== 'number'
    ) {
      // A present but invalid record is not the same as an absent opt-in.
      return { record: null, storageError: true };
    }
    return { record: parsed, storageError: false };
  } catch {
    // Unreadable SecureStore (or corrupt JSON) → fail closed, do not guess.
    return { record: null, storageError: true };
  }
}

/**
 * `unknown` means SecureStore could not be read, so we cannot prove the
 * account is unprotected. Callers that guard access must treat it as
 * protected; callers that only render a switch should treat it as off.
 */
export type FingerprintOptInState = 'on' | 'off' | 'unknown';

/**
 * Has THIS account opted in? Role is re-checked here too, so a downgraded
 * account reports "off" — and has its stale record removed — even if some
 * caller forgot to check the role first.
 */
export async function getFingerprintOptInState(
  account: FingerprintAccountRef
): Promise<FingerprintOptInState> {
  if (!isFingerprintPlatformSupported()) return 'off';

  const eligible = isFingerprintEligibleRole(account.roleCode);
  const { record, storageError } = await readRecord(account.schoolId, account.userId);

  if (!eligible) {
    // Role downgrade cleanup. An ineligible account is never protected, so an
    // unreadable store does not need to fail closed here.
    if (record) await disableFingerprintForAccount(account.schoolId, account.userId);
    return 'off';
  }
  if (storageError) return 'unknown';
  return record ? 'on' : 'off';
}

/** Convenience for UI: only a provably-on account renders as enabled. */
export async function isFingerprintEnabledForAccount(
  account: FingerprintAccountRef
): Promise<boolean> {
  return (await getFingerprintOptInState(account)) === 'on';
}

/**
 * Turn the feature on for one account after a successful strong scan.
 * Verification and persistence live in one boundary so callers cannot create
 * an opt-in record without proving the current biometric.
 */
export async function enableFingerprintForAccount(
  account: FingerprintAccountRef,
  copy: FingerprintPromptCopy = {
    promptMessage: 'Confirm fingerprint protection',
    cancelLabel: 'Cancel',
  }
): Promise<FingerprintResult> {
  if (!isFingerprintPlatformSupported()) {
    return { success: false, reason: 'unsupported_platform' };
  }
  if (!isFingerprintEligibleRole(account.roleCode)) {
    return { success: false, reason: 'ineligible_role' };
  }
  if (!account.userId) {
    return { success: false, reason: 'storage_error' };
  }

  const capability = await getFingerprintCapability();
  if (!capability.available || !capability.signature) {
    return { success: false, reason: capability.reason ?? 'probe_failed' };
  }

  if (Platform.OS === 'ios') {
    // iOS does not prompt when a biometryCurrentSet item is first created.
    const verified = await promptFingerprint(
      copy,
      `enable:${account.schoolId}:${account.userId}`
    );
    if (!verified.success) return verified;
  }

  const record: OptInRecord = {
    v: 1,
    schoolId: account.schoolId,
    userId: account.userId,
    roleCode: String(account.roleCode),
    signature: capability.signature,
    enabledAt: Date.now(),
  };

  try {
    // This proof is bound by the OS to the current biometric set. On iOS it
    // uses biometryCurrentSet; on Android it uses a BIOMETRIC_STRONG-gated
    // Keystore key. Adding/removing enrollment invalidates future reads.
    await SecureStore.setItemAsync(
      buildProofKey(account.schoolId, account.userId),
      JSON.stringify({
        schoolId: account.schoolId,
        userId: account.userId,
        nonce: Crypto.randomUUID(),
      }),
      {
        requireAuthentication: true,
        authenticationPrompt: copy.promptMessage,
      }
    );
    // Commit metadata only after creation of the protected proof succeeds.
    await SecureStore.setItemAsync(
      buildOptInKey(account.schoolId, account.userId),
      JSON.stringify(record)
    );
    return { success: true };
  } catch (error) {
    // Do not leave metadata claiming the feature is enabled if creation of the
    // protected proof was cancelled or failed.
    await Promise.all([
      SecureStore.deleteItemAsync(buildOptInKey(account.schoolId, account.userId)).catch(
        () => undefined
      ),
      SecureStore.deleteItemAsync(buildProofKey(account.schoolId, account.userId)).catch(
        () => undefined
      ),
    ]);
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return {
      success: false,
      reason: message.includes('cancel') ? 'cancelled' : 'storage_error',
    };
  }
}

/**
 * Remove ONE account's opt-in record. Sibling accounts in the vault keep
 * theirs — this is why the keys are per (schoolId, userId) in the first place.
 * Safe to call for accounts that never opted in.
 */
export async function disableFingerprintForAccount(
  schoolId: number,
  userId: string
): Promise<boolean> {
  if (!isFingerprintPlatformSupported() || !userId) return true;
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(buildOptInKey(schoolId, userId)),
      SecureStore.deleteItemAsync(buildProofKey(schoolId, userId)),
    ]);
    return true;
  } catch {
    return false;
  }
}

// ── Unlock tickets ───────────────────────────────────────────────────────
//
// A screen that has just verified the user (the login screen's fingerprint
// button, the lock overlay) records a short-lived, single-use ticket. The
// switchAccount gate consumes it instead of prompting a second time for the
// same intent. Tickets are per-userId and in-memory only.

const tickets = new Map<string, number>();
let proofReadInFlight: {
  accountKey: string;
  promise: Promise<FingerprintResult>;
} | null = null;

export function issueFingerprintTicket(userId: string): void {
  if (!userId) return;
  tickets.set(userId, Date.now() + TICKET_TTL_MS);
}

export function consumeFingerprintTicket(userId: string): boolean {
  const expiry = tickets.get(userId);
  if (expiry === undefined) return false;
  tickets.delete(userId);
  return expiry > Date.now();
}

export function clearFingerprintTickets(): void {
  tickets.clear();
}

// ── The gate ─────────────────────────────────────────────────────────────

/**
 * The one call every entry path uses: "may this account be entered right now,
 * and if it is fingerprint-protected, has the user just proved it?"
 *
 * Returns success with no prompt for accounts that are not fingerprint-
 * protected — a forbidden role can therefore never be shown a biometric
 * dialog, because the role check happens before the prompt.
 */
export async function verifyFingerprintForAccount(
  account: FingerprintAccountRef,
  copy: FingerprintPromptCopy
): Promise<FingerprintResult> {
  if (!isFingerprintPlatformSupported()) {
    return { success: false, reason: 'unsupported_platform' };
  }
  if (!isFingerprintEligibleRole(account.roleCode)) {
    // Role was revoked or was never eligible: drop any stale record and refuse.
    await disableFingerprintForAccount(account.schoolId, account.userId);
    return { success: false, reason: 'ineligible_role' };
  }

  const { record, storageError } = await readRecord(account.schoolId, account.userId);
  if (storageError) return { success: false, reason: 'storage_error' };
  if (!record) return { success: false, reason: 'not_enabled' };

  const capability = await getFingerprintCapability();
  if (!capability.available || !capability.signature) {
    return { success: false, reason: capability.reason ?? 'probe_failed' };
  }
  if (capability.signature !== record.signature) {
    // The enrolled biometric configuration changed under us. Fail closed and
    // force a deliberate re-opt-in behind a password login.
    await disableFingerprintForAccount(account.schoolId, account.userId);
    return { success: false, reason: 'enrollment_changed' };
  }

  const accountKey = `${account.schoolId}:${account.userId}`;
  if (proofReadInFlight) {
    if (proofReadInFlight.accountKey === accountKey) return proofReadInFlight.promise;
    return { success: false, reason: 'busy' };
  }

  const promise = (async (): Promise<FingerprintResult> => {
    try {
      // Reading this OS-protected value is the authentication prompt. Using
      // the key itself avoids a successful generic prompt being replayed for
      // another account and lets the OS detect changed enrollment.
      const proof = await SecureStore.getItemAsync(
        buildProofKey(account.schoolId, account.userId),
        {
          requireAuthentication: true,
          authenticationPrompt: copy.promptMessage,
        }
      );
      if (!proof) {
        await disableFingerprintForAccount(account.schoolId, account.userId);
        return { success: false, reason: 'enrollment_changed' };
      }
      const parsed = JSON.parse(proof) as { schoolId?: number; userId?: string };
      if (parsed.schoolId !== account.schoolId || parsed.userId !== account.userId) {
        return { success: false, reason: 'storage_error' };
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('lockout') || message.includes('locked out')) {
        return { success: false, reason: 'lockout' };
      }
      if (message.includes('cancel') || message.includes('auth')) {
        return { success: false, reason: 'cancelled' };
      }
      return { success: false, reason: 'storage_error' };
    } finally {
      proofReadInFlight = null;
    }
  })();

  proofReadInFlight = { accountKey, promise };
  return promise;
}
