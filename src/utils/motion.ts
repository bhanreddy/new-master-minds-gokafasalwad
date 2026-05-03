/* ─────────────────────────────────────────────
 *  Motion Controller — Centralized Animation Presets
 *  Single source of truth for all motion timing
 * ───────────────────────────────────────────── */

import { Easing } from 'react-native-reanimated';

// ── Spring Presets ──────────────────────────
export const Springs = {
    /** Card press: snappy, responsive */
    cardPress: {
        damping: 16,
        stiffness: 180,
        mass: 0.8,
    },
    /** Card release: smooth return */
    cardRelease: {
        damping: 14,
        stiffness: 200,
        mass: 0.7,
    },
    /** Navigation pill slide */
    navPill: {
        damping: 18,
        stiffness: 160,
        mass: 0.8,
    },
    /** Entering animations */
    entering: {
        damping: 15,
        stiffness: 140,
        mass: 0.9,
    },
    /** Gentle bounce */
    gentle: {
        damping: 20,
        stiffness: 120,
        mass: 1,
    },
} as const;

// ── Timing Presets ──────────────────────────
export const Timing = {
    /** Counter animation duration */
    counterDuration: 1200,
    /** Counter easing curve */
    counterEasing: Easing.out(Easing.cubic),
    /** Glow pulse cycle */
    glowDuration: 2500,
    /** Live indicator pulse */
    pulseDuration: 1200,
    /** Gradient shift cycle */
    gradientShiftDuration: 8000,
    /** Screen load base delay */
    screenLoadDelay: 100,
} as const;

// ── Stagger Helper ──────────────────────────
/**
 * Calculate stagger delay for sequential element entrance.
 * @param index - Element index in the sequence
 * @param baseDelay - Base delay between items (default: 80ms)
 * @param initialDelay - Delay before first element (default: 200ms)
 */
export function staggerDelay(
    index: number,
    baseDelay: number = 80,
    initialDelay: number = 200
): number {
    return initialDelay + index * baseDelay;
}

// ── Press Scale Values ──────────────────────
export const PressScale = {
    /** Card press scale (0.96) */
    card: 0.96,
    /** Button press scale */
    button: 0.97,
    /** Default resting scale */
    rest: 1,
} as const;

// ── Entering Animation Durations ────────────
export const EnteringDuration = {
    /** Hero section */
    hero: 600,
    /** Analytics bar */
    analytics: 500,
    /** Section header */
    sectionHeader: 400,
    /** Card items */
    card: 500,
} as const;
