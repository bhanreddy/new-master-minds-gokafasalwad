import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SCHOOL_ID } from '../constants/school';
import { isFingerprintEligibleRole } from '../utils/roleHelpers';
import {
  disableFingerprintForAccount,
  enableFingerprintForAccount,
  getFingerprintCapability,
  isFingerprintEnabledForAccount,
  isFingerprintPlatformSupported,
} from '../services/biometricService';
import type {
  FingerprintFailureReason,
  FingerprintUnavailableReason,
} from '../services/biometricService';
import { describeFingerprintFailure } from '../services/fingerprintGate';
import { useAuth } from './useAuth';

/**
 * useFingerprintAuth — state and actions behind the "Fingerprint Login" switch
 * in the staff and admin Security sections.
 *
 * `showRow` is the only thing a settings screen needs to decide visibility: it
 * is false on web/Tauri, false for every role outside the eligible list
 * (principals sign in through the admin portal and teachers through the staff
 * portal, so the role — not the portal — is what decides), and false on a
 * phone with no enrolled strong fingerprint. The service repeats each of these
 * checks, so hiding the row is presentation, not the security boundary.
 */
export interface UseFingerprintAuth {
  /** Render the settings row at all? */
  showRow: boolean;
  /** Opted in for the active account. */
  enabled: boolean;
  /** Initial capability/opt-in probe or a toggle is running. */
  busy: boolean;
  /** Why the device is unusable, when it is. */
  unavailableReason: FingerprintUnavailableReason | null;
  /** Last toggle error, already localized. */
  error: string | null;
  /**
   * Flip the switch. Returns the localized failure inline as well as storing
   * it, because a caller awaiting this cannot read the fresh `error` state
   * from the render that scheduled the call.
   */
  setEnabled: (next: boolean) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

export function useFingerprintAuth(): UseFingerprintAuth {
  const { t } = useTranslation();
  const { user } = useAuth();

  const userId = user?.userId ?? null;
  const roleCode = user?.role?.code ?? null;
  const eligibleRole = isFingerprintEligibleRole(roleCode);

  const [deviceReady, setDeviceReady] = useState(false);
  const [unavailableReason, setUnavailableReason] =
    useState<FingerprintUnavailableReason | null>(null);
  const [enabled, setEnabledState] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isFingerprintPlatformSupported() || !eligibleRole || !userId) {
      if (mountedRef.current) {
        setDeviceReady(false);
        setEnabledState(false);
        setUnavailableReason(
          isFingerprintPlatformSupported() ? null : 'unsupported_platform'
        );
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const capability = await getFingerprintCapability();
      const optedIn = await isFingerprintEnabledForAccount({
        schoolId: SCHOOL_ID,
        userId,
        roleCode,
      });
      if (!mountedRef.current) return;
      setDeviceReady(capability.available);
      setUnavailableReason(capability.reason);
      // A record can outlive the enrolment it was created against; show the
      // switch as off in that case rather than claiming protection we cannot
      // deliver. The record itself is dropped at the next verify attempt.
      setEnabledState(optedIn && capability.available);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [eligibleRole, roleCode, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEnabled = useCallback(
    async (next: boolean): Promise<{ ok: boolean; error?: string }> => {
      setError(null);
      if (!userId) return { ok: false };

      const fail = (reason: FingerprintFailureReason) => {
        const message = describeFingerprintFailure(reason);
        if (mountedRef.current) setError(message);
        return { ok: false, error: message };
      };

      // Re-assert the rule at action time: the row could have been rendered
      // before a role change landed.
      if (!isFingerprintPlatformSupported() || !isFingerprintEligibleRole(roleCode)) {
        return fail('ineligible_role');
      }

      setBusy(true);
      try {
        if (!next) {
          // Disable removes ONLY this account's record; other saved accounts
          // keep their own opt-in.
          const removed = await disableFingerprintForAccount(SCHOOL_ID, userId);
          if (!removed) return fail('storage_error');
          if (mountedRef.current) setEnabledState(false);
          return { ok: true };
        }

        // The service owns verification and persistence as one operation.
        const result = await enableFingerprintForAccount(
          { schoolId: SCHOOL_ID, userId, roleCode },
          {
            promptMessage: t('fingerprint.verifyToEnable'),
            promptSubtitle: t('fingerprint.verifyToEnableSubtitle'),
            cancelLabel: t('fingerprint.cancel'),
          }
        );
        if (!result.success) return fail(result.reason ?? 'failed');

        if (mountedRef.current) setEnabledState(true);
        return { ok: true };
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [roleCode, t, userId]
  );

  return {
    showRow: isFingerprintPlatformSupported() && eligibleRole && deviceReady,
    enabled,
    busy,
    unavailableReason,
    error,
    setEnabled,
    refresh,
  };
}
