/**
 * doodleTypes.ts — Shared contracts for the animated mascot doodles.
 *
 * The doodles are decorative (pointerEvents="none"), built from plain Views +
 * UI-thread transforms (no SVG animated props, no images, no blur) so they hold
 * 60fps on low-end Android. Screens provide state; doodles own their motion.
 */
import type { SharedValue } from 'react-native-reanimated';

/**
 * Single derived state for the login-page doodle. Derived in ONE place
 * (useLoginDoodleState) — never scattered across JSX conditions.
 */
export type LoginDoodleState =
  | 'idle'
  | 'usernameActive'
  | 'passwordHidden'
  | 'passwordVisible'
  | 'submitting'
  | 'success'
  | 'error';

/** Which login field currently has keyboard focus. */
export type LoginFocusedField = 'email' | 'password' | null;

export interface LoginFormDoodleProps {
  /** Derived doodle state — see useLoginDoodleState. */
  state: LoginDoodleState;
  /** Rendered width in px; height is derived (~1.12×). */
  size: number;
  /** School primary color (body / uniform). */
  primaryColor: string;
  /** Darker school shade (cap / arm shading). */
  primaryDarkColor: string;
  /** False when the user prefers reduced motion — poses snap, loops stay off. */
  motionEnabled: boolean;
}

export interface WelcomeGuideDoodleProps {
  /** Rendered width in px; height is derived (~1.18×). */
  size: number;
  /** School primary color (body / uniform). */
  primaryColor: string;
  /** Darker school shade (cap / arm shading). */
  primaryDarkColor: string;
  /** False when the user prefers reduced motion — doodle stays in idle pose. */
  motionEnabled: boolean;
  /**
   * 0→1 keyframed progress of the "point at the Login card" gesture.
   * Owned by useWelcomeGuideAnimation so the card pulse derives from the SAME
   * value and can never drift out of sync with the finger taps.
   */
  pointProgress: SharedValue<number>;
  /** Gentle idle float (0→1 sine loop), also owned by the hook. */
  idleFloat: SharedValue<number>;
  /**
   * Vertical centre of the live CTA arrow, measured from the doodle root.
   * This is layout-derived by the welcome screen; the arm therefore lands on
   * the button on small phones, tablets, web, and after rotation.
   */
  targetY: number;
}
