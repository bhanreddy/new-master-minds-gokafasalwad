/**
 * useWelcomeGuideAnimation — owns the welcome-page guide-doodle timeline.
 *
 * One keyframed shared value (`pointProgress`, 0→1 over ~1.6s) drives BOTH the
 * doodle's pointing gesture AND the Login card's attention pulse, so the two
 * can never drift apart. The loop:
 *
 *   [wait ~4s] → notice CTA → extend to live arrow → click → retract → repeat
 *
 * Lifecycle guarantees (all hard requirements):
 *   • starts only after the screen entrance animation has finished
 *   • pauses the moment the Login card is pressed
 *   • stops permanently for the session after the first card interaction
 *   • cancels on screen blur/unmount (no timers or loops survive)
 *   • no-ops entirely under reduced motion
 *
 * Everything runs as UI-thread Reanimated animations — the JS thread is only
 * touched at the discrete press/focus events the screen already handles.
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Idle gap between pointing gestures. */
const IDLE_GAP_MS = 4000;
/** Long enough for the reach to read clearly without making the UI feel slow. */
const GESTURE_MS = 1750;
/** Wait for the screen entrance choreography before the first gesture. */
const ENTRANCE_SETTLE_MS = 900;

interface Args {
  motionEnabled: boolean;
  /** The card's existing 0→1 pressed shared value (scale feedback). */
  pressedSV: SharedValue<number>;
}

export function useWelcomeGuideAnimation({ motionEnabled, pressedSV }: Args) {
  /** 0→1 keyframed progress of the pointing gesture. */
  const pointProgress = useSharedValue(0);
  /** 0→1 sine loop for the doodle's gentle idle float. */
  const idleFloat = useSharedValue(0);
  /** Session-permanent stop after the first card interaction. */
  const stoppedRef = useRef(false);
  /** True only while the loops are scheduled (prevents double-starts). */
  const runningRef = useRef(false);

  const startLoops = useCallback(() => {
    if (!motionEnabled || stoppedRef.current || runningRef.current) return;
    runningRef.current = true;

    // Gesture loop: linear driver — the gesture's own easing lives in the
    // interpolate keyframes, so keyframe spacing stays true to the spec.
    pointProgress.value = 0;
    pointProgress.value = withDelay(
      ENTRANCE_SETTLE_MS,
      withRepeat(
        withSequence(
          withDelay(IDLE_GAP_MS, withTiming(1, { duration: GESTURE_MS, easing: Easing.linear })),
          // Pose at progress 1 === pose at 0, so this snap is invisible.
          withTiming(0, { duration: 1 }),
        ),
        -1,
        false,
      ),
    );

    // Idle float: tiny ±3px bob. Transform-only, runs forever until cancelled.
    idleFloat.value = 0;
    idleFloat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [motionEnabled, pointProgress, idleFloat]);

  const cancelLoops = useCallback(() => {
    runningRef.current = false;
    cancelAnimation(pointProgress);
    cancelAnimation(idleFloat);
    pointProgress.value = withTiming(0, { duration: 160 });
  }, [pointProgress, idleFloat]);

  /**
   * First interaction with the Login card: stop the guide for this session.
   * (Covers both "pause while pressed" and "stop after first interaction".)
   * The idle float keeps running — only the pointing gesture retires.
   */
  const stopGuide = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    cancelAnimation(pointProgress);
    pointProgress.value = withTiming(0, { duration: 160 });
  }, [pointProgress]);

  // Start on screen focus, cancel on blur/unmount. Re-focusing the welcome
  // screen in the same session re-arms the guide unless the user already
  // interacted with the card.
  useFocusEffect(
    useCallback(() => {
      startLoops();
      return cancelLoops;
    }, [startLoops, cancelLoops]),
  );

  /**
   * Card press-scale style. The gesture's "response" animation lives on the
   * CTA arrow itself (press-dip + ripple, keyed off pointProgress in the
   * screen) — the mascot presses the button, the button reacts; the card
   * body stays still so the interaction reads precisely, not noisily.
   */
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressedSV.value, [0, 1], [1, 0.975]) }],
  }));

  return { pointProgress, idleFloat, cardAnimatedStyle, stopGuide };
}
