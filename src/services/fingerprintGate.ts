import i18n from '../i18n';
import { SCHOOL_ID } from '../constants/school';
import * as accountVault from './accountVault';
import {
  consumeFingerprintTicket,
  getFingerprintOptInState,
  isFingerprintPlatformSupported,
  verifyFingerprintForAccount,
} from './biometricService';
import type { FingerprintFailureReason, FingerprintPromptCopy } from './biometricService';

/**
 * fingerprintGate.ts — the single choke point every "enter this account" path
 * passes through.
 *
 * Wired into AuthProvider.switchAccount, which is what the unified login
 * screen's saved-account rows, the account switcher sheet, the quick account
 * switch, and notification-triggered switching all call. One implementation
 * therefore covers every route into a fingerprint-protected account, instead
 * of each screen remembering to ask.
 *
 * The gate is intentionally permissive for accounts the feature does not
 * apply to: a student, parent, accountant, or driver target returns "allowed"
 * without ever reaching a prompt, because the role is checked before any
 * biometric call is made.
 */

export interface FingerprintGateOutcome {
  allowed: boolean;
  reason?: FingerprintFailureReason;
  /** Ready-to-show message when `allowed` is false. */
  message?: string;
}

/** Prompt copy, resolved against the active language at call time. */
export function getFingerprintPromptCopy(): FingerprintPromptCopy {
  return {
    promptMessage: i18n.t('fingerprint.unlockTitle'),
    promptSubtitle: i18n.t('fingerprint.unlockSubtitle'),
    cancelLabel: i18n.t('fingerprint.usePassword'),
  };
}

/** User-facing explanation for a refused unlock. Never leaks device details. */
export function describeFingerprintFailure(reason?: FingerprintFailureReason): string {
  switch (reason) {
    case 'cancelled':
      return i18n.t('fingerprint.cancelled');
    case 'lockout':
      return i18n.t('fingerprint.lockedOut');
    case 'enrollment_changed':
      return i18n.t('fingerprint.enrollmentChanged');
    case 'weak_biometric':
    case 'no_fingerprint':
    case 'mixed_biometrics':
      return i18n.t('fingerprint.noStrongFingerprint');
    case 'not_enrolled':
      return i18n.t('fingerprint.notEnrolled');
    case 'no_hardware':
    case 'unsupported_platform':
    case 'probe_failed':
      return i18n.t('fingerprint.unavailable');
    case 'ineligible_role':
      return i18n.t('fingerprint.notAllowedForRole');
    case 'storage_error':
      return i18n.t('fingerprint.storageError');
    case 'busy':
      return i18n.t('fingerprint.failed');
    default:
      return i18n.t('fingerprint.failed');
  }
}

/**
 * Decide whether `userId`'s session may be restored/switched to right now.
 *
 * The target's role is read from the vault at this moment rather than trusted
 * from whatever the UI last rendered, so an account whose role changed since
 * the screen was drawn is judged on its current role.
 */
export async function requireFingerprintForVaultAccount(
  userId: string
): Promise<FingerprintGateOutcome> {
  if (!isFingerprintPlatformSupported()) return { allowed: true };
  if (!userId) {
    return {
      allowed: false,
      reason: 'storage_error',
      message: describeFingerprintFailure('storage_error'),
    };
  }

  let roleCode: string | null | undefined;
  try {
    const accounts = await accountVault.listAccounts();
    const target = accounts.find((a) => a.userId === userId);
    // Unknown account: let the switch itself fail with its own vault error
    // rather than inventing a biometric refusal for something that is not there.
    if (!target) {
      return {
        allowed: false,
        reason: 'storage_error',
        message: describeFingerprintFailure('storage_error'),
      };
    }
    roleCode = target.validatedUser?.role?.code;
  } catch {
    return {
      allowed: false,
      reason: 'storage_error',
      message: describeFingerprintFailure('storage_error'),
    };
  }

  // Also performs the role-downgrade cleanup: an account that is no longer
  // eligible reports "off" and its stale record is deleted.
  //
  // 'unknown' means SecureStore could not be read for an otherwise eligible
  // account. We cannot prove it is unprotected, so it is treated as protected
  // and falls through to verify, which refuses with a storage error.
  const state = await getFingerprintOptInState({ schoolId: SCHOOL_ID, userId, roleCode });
  if (state === 'off') return { allowed: true };

  // A screen that just verified this exact account (the login screen's
  // fingerprint action, the lock overlay) leaves a single-use ticket so the
  // user is not asked twice for one intent.
  if (consumeFingerprintTicket(userId)) return { allowed: true };

  const result = await verifyFingerprintForAccount(
    { schoolId: SCHOOL_ID, userId, roleCode },
    getFingerprintPromptCopy()
  );

  if (result.success) return { allowed: true };
  return {
    allowed: false,
    reason: result.reason,
    message: describeFingerprintFailure(result.reason),
  };
}
