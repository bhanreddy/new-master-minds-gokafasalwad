/**
 * BrokenErrorDoodle — friendly "broken QR" mascot for error popups.
 *
 * Static SVG body + UI-thread transform/opacity only (Reanimated). No blur,
 * no per-frame SVG prop animation — holds 60fps on low-end Android.
 */
import React, { memo, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
  G,
} from 'react-native-svg';

export interface BrokenErrorDoodleProps {
  /** Rendered width in px; height is derived (~1.12×). */
  size?: number;
  /** False when the user prefers reduced motion — snaps to rest pose. */
  motionEnabled?: boolean;
}

const INK = '#2A3142';
const BODY = '#F2F4F8';
const BODY_EDGE = '#D8DEE9';
const QR = '#5B657A';
const QR_SOFT = '#8A93A8';
const TONGUE = '#F0717A';
const CRACK = '#9AA3B8';
const BLUSH = '#F8B4B4';

function BrokenErrorDoodleInner({
  size = 148,
  motionEnabled = true,
}: BrokenErrorDoodleProps) {
  const height = size * 1.12;
  const enter = useSharedValue(0);
  const shake = useSharedValue(0);
  const floatY = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (!motionEnabled) {
      enter.value = 1;
      shake.value = 0;
      floatY.value = 0;
      wobble.value = 0;
      return;
    }

    enter.value = 0;
    enter.value = withSpring(1, { damping: 14, stiffness: 160, mass: 0.9 });

    shake.value = withDelay(
      80,
      withSequence(
        withTiming(1, { duration: 45, easing: Easing.out(Easing.quad) }),
        withTiming(-1, { duration: 55 }),
        withTiming(0.7, { duration: 50 }),
        withTiming(-0.5, { duration: 45 }),
        withTiming(0, { duration: 60, easing: Easing.out(Easing.cubic) }),
      ),
    );

    floatY.value = withDelay(
      420,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    wobble.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(enter);
      cancelAnimation(shake);
      cancelAnimation(floatY);
      cancelAnimation(wobble);
    };
  }, [motionEnabled, enter, shake, floatY, wobble]);

  const characterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 18 + floatY.value * -4 },
      { translateX: shake.value * 5 },
      { rotate: `${shake.value * 4 + (wobble.value - 0.5) * 2.4}deg` },
      { scale: 0.88 + enter.value * 0.12 },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + enter.value * 0.28 - floatY.value * 0.08,
    transform: [{ scaleX: 1 - floatY.value * 0.08 }, { scaleY: 1 - floatY.value * 0.12 }],
  }));

  // ViewBox 0 0 160 170 — character centered with room for limbs + shadow.
  return (
    <View style={[styles.wrap, { width: size, height }]} pointerEvents="none">
      <Animated.View style={[styles.shadowSlot, shadowStyle]}>
        <Svg width={size * 0.55} height={size * 0.12} viewBox="0 0 100 22">
          <Ellipse cx="50" cy="11" rx="42" ry="8" fill="rgba(42,49,66,0.28)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.character, characterStyle]}>
        <Svg width={size} height={height} viewBox="0 0 160 170">
          <Defs>
            <LinearGradient id="bodySheen" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="0.45" stopColor={BODY} stopOpacity="1" />
              <Stop offset="1" stopColor={BODY_EDGE} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="faceGlow" x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Soft ambient halo */}
          <Ellipse cx="80" cy="88" rx="58" ry="54" fill="rgba(255, 196, 80, 0.10)" />

          {/* Arms */}
          <Path
            d="M42 92 C28 98, 22 108, 18 118"
            stroke={INK}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M118 92 C132 98, 138 108, 142 118"
            stroke={INK}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Hands */}
          <Circle cx="18" cy="118" r="3.2" fill={INK} />
          <Circle cx="142" cy="118" r="3.2" fill={INK} />

          {/* Legs */}
          <Path
            d="M68 128 C66 142, 62 152, 58 158"
            stroke={INK}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M92 128 C94 142, 98 152, 102 158"
            stroke={INK}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Feet */}
          <Ellipse cx="56" cy="160" rx="7" ry="3.2" fill={INK} />
          <Ellipse cx="104" cy="160" rx="7" ry="3.2" fill={INK} />

          {/* Body */}
          <Rect
            x="42"
            y="42"
            width="76"
            height="86"
            rx="22"
            fill="url(#bodySheen)"
            stroke={BODY_EDGE}
            strokeWidth="2.5"
          />
          <Rect
            x="46"
            y="46"
            width="68"
            height="40"
            rx="16"
            fill="url(#faceGlow)"
          />

          {/* QR modules — simplified friendly pattern */}
          <G opacity="0.92">
            <Rect x="54" y="54" width="14" height="14" rx="3" fill={QR} />
            <Rect x="58" y="58" width="6" height="6" rx="1.5" fill={BODY} />
            <Rect x="92" y="54" width="14" height="14" rx="3" fill={QR} />
            <Rect x="96" y="58" width="6" height="6" rx="1.5" fill={BODY} />

            <Rect x="72" y="56" width="6" height="6" rx="1.5" fill={QR_SOFT} />
            <Rect x="80" y="56" width="6" height="6" rx="1.5" fill={QR} />
            <Rect x="72" y="64" width="6" height="6" rx="1.5" fill={QR} />
            <Rect x="80" y="64" width="6" height="6" rx="1.5" fill={QR_SOFT} />

            <Rect x="54" y="74" width="6" height="6" rx="1.5" fill={QR} />
            <Rect x="62" y="74" width="6" height="6" rx="1.5" fill={QR_SOFT} />
            <Rect x="70" y="74" width="6" height="6" rx="1.5" fill={QR} />
            <Rect x="84" y="74" width="6" height="6" rx="1.5" fill={QR_SOFT} />
            <Rect x="92" y="74" width="6" height="6" rx="1.5" fill={QR} />
            <Rect x="100" y="74" width="6" height="6" rx="1.5" fill={QR_SOFT} />

            <Rect x="54" y="108" width="14" height="14" rx="3" fill={QR} />
            <Rect x="58" y="112" width="6" height="6" rx="1.5" fill={BODY} />
            <Rect x="76" y="110" width="8" height="8" rx="2" fill={QR_SOFT} />
            <Rect x="90" y="108" width="6" height="6" rx="1.5" fill={QR} />
            <Rect x="98" y="108" width="6" height="6" rx="1.5" fill={QR_SOFT} />
            <Rect x="90" y="116" width="6" height="6" rx="1.5" fill={QR_SOFT} />
            <Rect x="98" y="116" width="6" height="6" rx="1.5" fill={QR} />
          </G>

          {/* Crack */}
          <Path
            d="M108 48 L102 58 L110 66 L104 74"
            stroke={CRACK}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M110 52 L116 56"
            stroke={CRACK}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Face — X eyes + distressed mouth */}
          <Path
            d="M62 88 L72 98 M72 88 L62 98"
            stroke={INK}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <Path
            d="M88 88 L98 98 M98 88 L88 98"
            stroke={INK}
            strokeWidth="3.4"
            strokeLinecap="round"
          />

          {/* Blush */}
          <Ellipse cx="58" cy="104" rx="5" ry="3.2" fill={BLUSH} opacity="0.55" />
          <Ellipse cx="102" cy="104" rx="5" ry="3.2" fill={BLUSH} opacity="0.55" />

          {/* Mouth */}
          <Ellipse cx="80" cy="108" rx="8" ry="6.5" fill={INK} />
          <Ellipse cx="80" cy="110.5" rx="5.2" ry="3.6" fill={TONGUE} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? { userSelect: 'none' as any } : null),
  },
  shadowSlot: {
    position: 'absolute',
    bottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  character: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const BrokenErrorDoodle = memo(BrokenErrorDoodleInner);
export default BrokenErrorDoodle;
