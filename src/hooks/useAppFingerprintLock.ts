import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SCHOOL_ID } from '../constants/school';
import {
  getFingerprintOptInState,
  isFingerprintPlatformSupported,
  verifyFingerprintForAccount,
} from '../services/biometricService';
import {
  describeFingerprintFailure,
  getFingerprintPromptCopy,
} from '../services/fingerprintGate';
import { isFingerprintEligibleRole } from '../utils/roleHelpers';
import { useAuth } from './useAuth';

/**
 * useAppFingerprintLock — cold-start and resume protection for an opted-in
 * staff/admin account.
 *
 * Lifecycle:
 *   - Cold start begins in `resolving`, which the overlay renders as an
 *     opaque cover, so nothing protected is on screen while we work out
 *     whether this account is locked.
 *   - Returning to the foreground after more than BACKGROUND_LOCK_MS away
 *     re-locks. A quick trip to the notification shade or a permission dialog
 *     does not.
 *   - A refused or cancelled scan leaves the app locked with "Try again" and
 *     "Use email and password". It never signs the user out on its own and
 *     never touches sibling saved accounts.
 *
 * It adds its own AppState subscription rather than editing the one in
 * useAuth, which exists to re-arm Supabase's token auto-refresh and is left
 * exactly as it was.
 */

/** Time in the background before the app re-locks. */
export const BACKGROUND_LOCK_MS = 30_000;

export type FingerprintLockStatus = 'resolving' | 'unlocked' | 'locked';

export interface AppFingerprintLock {
  status: FingerprintLockStatus;
  /** A native prompt is on screen. */
  prompting: boolean;
  /** Localized explanation after a refused scan. */
  failureMessage: string | null;
  /** Opaque cover used immediately while the app is not active. */
  privacyCovered: boolean;
  retry: () => Promise<void>;
  /** Not named `use*`: it is a plain action, not a React hook. */
  fallbackToPassword: () => Promise<void>;
}

export function useAppFingerprintLock(): AppFingerprintLock {
  const { user, authChecked, signOutKeepAccount } = useAuth();

  const [status, setStatus] = useState<FingerprintLockStatus>(() =>
    isFingerprintPlatformSupported() ? 'resolving' : 'unlocked'
  );
  const [prompting, setPrompting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [privacyCovered, setPrivacyCovered] = useState(false);

  const mountedRef = useRef(true);
  /** Serializes lock evaluation so two triggers cannot both open a dialog. */
  const busyRef = useRef(false);
  /** userId currently behind the lock, so a scan can only unlock that account. */
  const lockedUserIdRef = useRef<string | null>(null);
  const lastEvaluatedTargetRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** The lock applies only to a live, authenticated session. Saved accounts on
   *  the signed-out login screen are protected by the switch gate instead. */
  const resolveTargetAccount = useCallback(async (): Promise<{
    userId: string;
    roleCode: string | null | undefined;
  } | null> => {
    if (user?.userId) return { userId: user.userId, roleCode: user.role?.code };
    return null;
  }, [user?.role?.code, user?.userId]);

  /** Prompt for the account already behind the lock. */
  const runPrompt = useCallback(
    async (target: { userId: string; roleCode: string | null | undefined }) => {
      setPrompting(true);
      try {
        const result = await verifyFingerprintForAccount(
          { schoolId: SCHOOL_ID, userId: target.userId, roleCode: target.roleCode },
          getFingerprintPromptCopy()
        );
        if (!mountedRef.current) return;

        if (result.success) {
          lockedUserIdRef.current = null;
          setPrivacyCovered(false);
          setFailureMessage(null);
          setStatus('unlocked');
          return;
        }

        // The record vanished or the account stopped being eligible while we
        // were prompting — there is nothing left to protect, so let the normal
        // session continue rather than stranding the user behind a dead lock.
        if (result.reason === 'not_enabled' || result.reason === 'ineligible_role') {
          lockedUserIdRef.current = null;
          setPrivacyCovered(false);
          setStatus('unlocked');
          return;
        }

        setPrivacyCovered(false);
        setFailureMessage(describeFingerprintFailure(result.reason));
      } finally {
        if (mountedRef.current) setPrompting(false);
      }
    },
    []
  );

  /** Decide whether the app should be locked, and prompt once if it should. */
  const evaluate = useCallback(async (force = false) => {
    if (!isFingerprintPlatformSupported()) {
      setStatus('unlocked');
      return;
    }
    if (!authChecked) {
      setStatus('resolving');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const target = await resolveTargetAccount();
      if (!target) {
        // Keep the cold-start cover until auth restoration has conclusively
        // finished instead of treating a temporary null as "unprotected".
        if (mountedRef.current && authChecked) {
          lastEvaluatedTargetRef.current = null;
          setPrivacyCovered(false);
          setStatus('unlocked');
        }
        return;
      }
      const targetKey = `${target.userId}:${target.roleCode ?? ''}`;
      if (!force && lastEvaluatedTargetRef.current === targetKey) return;

      // 'unknown' (SecureStore unreadable for an eligible account) locks too:
      // we cannot prove this account is unprotected, so we fail closed and let
      // the user fall back to email and password.
      const state = await getFingerprintOptInState({
        schoolId: SCHOOL_ID,
        userId: target.userId,
        roleCode: target.roleCode,
      });
      if (state === 'off') {
        lastEvaluatedTargetRef.current = targetKey;
        if (mountedRef.current) {
          setPrivacyCovered(false);
          setStatus('unlocked');
        }
        return;
      }

      if (!mountedRef.current) return;
      lastEvaluatedTargetRef.current = targetKey;
      lockedUserIdRef.current = target.userId;
      setFailureMessage(null);
      setStatus('locked');
      await runPrompt(target);
    } finally {
      busyRef.current = false;
    }
  }, [authChecked, resolveTargetAccount, runPrompt]);

  // Kept in a ref so the AppState subscription below can be registered once
  // and still call the latest closure. Re-subscribing on every session change
  // would reset the "when did we go to the background" timestamp and could
  // silently skip a re-lock.
  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  // Cold start and the later auth-restoration transition. Re-evaluating when
  // authChecked/user changes closes the race where the first render had no
  // live user yet.
  useEffect(() => {
    void evaluateRef.current();
  }, [authChecked, user?.role?.code, user?.userId]);

  // Signing out clears the lock so the login screen is reachable.
  useEffect(() => {
    if (!user && lockedUserIdRef.current) {
      lockedUserIdRef.current = null;
      lastEvaluatedTargetRef.current = null;
      setPrivacyCovered(false);
      setFailureMessage(null);
      setStatus('unlocked');
    }
  }, [user]);

  // Resume protection.
  useEffect(() => {
    if (!isFingerprintPlatformSupported()) return;

    let lastState: AppStateStatus = AppState.currentState;
    let backgroundedAt: number | null = null;

    const onChange = (nextState: AppStateStatus) => {
      // Android and iOS both emit repeats of the same state; only transitions
      // matter here, so an echoed 'active' can never queue a second prompt.
      if (nextState === lastState) return;
      const previousState = lastState;
      lastState = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        // iOS passes through 'inactive' on its way to 'background'; keep the
        // first timestamp so the away time is measured from when the user
        // actually left.
        if (backgroundedAt === null) backgroundedAt = Date.now();
        // Paint the cover synchronously before the OS captures the app-switcher
        // snapshot. Covering every eligible live role is intentionally
        // conservative and avoids an async SecureStore read at this boundary.
        if (
          lockedUserIdRef.current ||
          isFingerprintEligibleRole(user?.role?.code)
        ) {
          setPrivacyCovered(true);
        }
        return;
      }

      if (nextState !== 'active') return;
      const awayFor = backgroundedAt === null ? 0 : Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (previousState === 'unknown') return;
      if (awayFor < BACKGROUND_LOCK_MS) {
        setPrivacyCovered(false);
        return;
      }
      setStatus((current) => (current === 'locked' ? current : 'resolving'));
      setPrivacyCovered(false);
      if (lockedUserIdRef.current) return; // already locked and waiting
      void evaluateRef.current(true);
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [user?.role?.code]);

  const retry = useCallback(async () => {
    const lockedUserId = lockedUserIdRef.current;
    if (!lockedUserId || prompting) return;
    const target = await resolveTargetAccount();
    // Only ever re-prompt for the exact account the lock was raised for.
    if (!target || target.userId !== lockedUserId) return;
    setFailureMessage(null);
    await runPrompt(target);
  }, [prompting, resolveTargetAccount, runPrompt]);

  const fallbackToPassword = useCallback(async () => {
    lockedUserIdRef.current = null;
    setFailureMessage(null);
    // Ends the live session but keeps this account (and every sibling) saved,
    // so it is still offered on the login screen for a password sign-in.
    // Routing is left to the existing useAuthGuard, which sends a signed-out
    // user on a protected route to /welcome exactly as any other logout does.
    await signOutKeepAccount();
    if (mountedRef.current) {
      setPrivacyCovered(false);
      setStatus('unlocked');
    }
  }, [signOutKeepAccount]);

  return {
    status,
    prompting,
    failureMessage,
    privacyCovered,
    retry,
    fallbackToPassword,
  };
}
