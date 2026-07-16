/**
 * useLoginDoodleState — the ONE place the login doodle's state is derived.
 *
 * JSX never branches on raw focus/visibility flags for the doodle; it renders
 * exactly one `LoginDoodleState`. Priority order (spec):
 *
 *   submitting > success > error > passwordHidden > passwordVisible
 *     > usernameActive > idle
 *
 * Password-privacy rules encoded here:
 *   • Actively entering a hidden password  → eyes closed  (passwordHidden)
 *   • Password visible (eye toggle on)     → eyes open, looking at the field,
 *     even after the field blurs           (passwordVisible)
 *   • Hidden password + focus left field   → back to neutral (idle)
 */
import { useMemo } from 'react';
import type { LoginDoodleState, LoginFocusedField } from '../components/doodles/doodleTypes';

interface Args {
  focusedField: LoginFocusedField;
  showPassword: boolean;
  isSubmitting: boolean;
  loginResult: 'success' | 'error' | null;
}

export function useLoginDoodleState({
  focusedField,
  showPassword,
  isSubmitting,
  loginResult,
}: Args): LoginDoodleState {
  return useMemo<LoginDoodleState>(() => {
    if (isSubmitting) return 'submitting';
    if (loginResult === 'success') return 'success';
    if (loginResult === 'error') return 'error';
    if (focusedField === 'password' && !showPassword) return 'passwordHidden';
    if (showPassword) return 'passwordVisible';
    if (focusedField === 'email') return 'usernameActive';
    return 'idle';
  }, [focusedField, showPassword, isSubmitting, loginResult]);
}
