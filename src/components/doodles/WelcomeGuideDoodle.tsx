/**
 * Premium welcome guide.
 *
 * The character is a small vector illustration rather than a pile of rounded
 * rectangles. Its arm is deliberately separate from the artwork: the screen
 * supplies the live CTA-arrow Y coordinate and the forearm extends to that
 * exact point before the shared timeline triggers the button response.
 */
import React, { memo, useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import type { WelcomeGuideDoodleProps } from "./doodleTypes";

const FACE = "#FFD9BE";
const FACE_SHADE = "#F3B78F";
const HAIR = "#24213A";
const HAIR_LIGHT = "#3B3656";
const INK = "#242338";
const WHITE = "#FFFFFF";
const TIE = "#F2A23A";

const SHOULDER_X = 73;
const SHOULDER_Y = 67;

function WelcomeGuideDoodleInner({
  size,
  primaryColor,
  primaryDarkColor,
  motionEnabled,
  pointProgress,
  idleFloat,
  targetY,
}: WelcomeGuideDoodleProps) {
  const u = size / 100;
  const artHeight = size * 1.12;
  const shoulderY = SHOULDER_Y * u;
  const restLength = 25 * u;
  const targetLength = Math.max(restLength, targetY - shoulderY);
  const handHeight = 23 * u;
  const stemHeight = Math.max(8 * u, targetLength - handHeight + 6 * u);

  const blink = useSharedValue(1);
  useEffect(() => {
    if (!motionEnabled) {
      blink.value = 1;
      return;
    }

    blink.value = withRepeat(
      withSequence(
        withDelay(3300, withTiming(0.06, { duration: 65 })),
        withTiming(1, { duration: 105 }),
        withDelay(180, withTiming(0.08, { duration: 60 })),
        withTiming(1, { duration: 105 }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(blink);
      blink.value = 1;
    };
  }, [blink, motionEnabled]);

  const rootAnim = useAnimatedStyle(() => {
    const engaged = interpolate(
      pointProgress.value,
      [0, 0.18, 0.35, 0.82, 1],
      [0, 0, 0.35, 1, 0],
    );
    const idleY = interpolate(idleFloat.value, [0, 1], [0, -2.5]);
    return { transform: [{ translateY: idleY * (1 - engaged) }] };
  });

  const characterAnim = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          pointProgress.value,
          [0, 0.18, 0.35, 0.68, 0.78, 1],
          [0, 0, 1.5 * u, 3 * u, 2 * u, 0],
        ),
      },
      {
        rotate: `${interpolate(
          pointProgress.value,
          [0, 0.18, 0.4, 0.72, 0.86, 1],
          [0, 0, 2.5, 3.5, 2, 0],
        )}deg`,
      },
    ],
  }));

  const pupilAnim = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          pointProgress.value,
          [0, 0.18, 0.36, 0.82, 1],
          [0, 0, 1.8 * u, 1.8 * u, 0],
        ),
      },
      { scaleY: blink.value },
    ],
  }));

  const armPivotAnim = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(
          pointProgress.value,
          [0, 0.18, 0.36, 0.58, 0.84, 1],
          [-17, -17, -6, 0, 0, -17],
        )}deg`,
      },
    ],
  }));

  const stemAnim = useAnimatedStyle(() => {
    const length = interpolate(
      pointProgress.value,
      [0, 0.2, 0.38, 0.64, 0.82, 1],
      [restLength, restLength, restLength * 1.18, targetLength, targetLength, restLength],
    );
    return {
      transform: [{ scaleY: Math.max(0.01, (length - handHeight + 6 * u) / stemHeight) }],
    };
  });

  const handAnim = useAnimatedStyle(() => {
    const length = interpolate(
      pointProgress.value,
      [0, 0.2, 0.38, 0.64, 0.69, 0.74, 0.82, 1],
      [
        restLength,
        restLength,
        restLength * 1.18,
        targetLength,
        targetLength + 2 * u,
        targetLength,
        targetLength,
        restLength,
      ],
    );
    return {
      transform: [
        { translateY: length - handHeight },
        {
          scale: interpolate(
            pointProgress.value,
            [0, 0.62, 0.69, 0.75, 1],
            [1, 1, 0.92, 1.03, 1],
          ),
        },
      ],
    };
  });

  const contactRingAnim = useAnimatedStyle(() => ({
    opacity: interpolate(
      pointProgress.value,
      [0, 0.65, 0.69, 0.8, 1],
      [0, 0, 0.75, 0, 0],
    ),
    transform: [
      {
        scale: interpolate(
          pointProgress.value,
          [0, 0.65, 0.69, 0.8, 1],
          [0.55, 0.55, 0.72, 1.65, 1.65],
        ),
      },
    ],
  }));

  return (
    <Animated.View
      testID="welcome-guide"
      pointerEvents="none"
      style={[
        styles.root,
        { width: size, height: Math.max(artHeight, targetY + 12 * u) },
        rootAnim,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        testID="welcome-guide-character"
        style={[
          styles.character,
          { width: size, height: artHeight, transformOrigin: "50% 90%" },
          characterAnim,
        ]}
      >
        <Svg width={size} height={artHeight} viewBox="0 0 100 112">
          <Defs>
            <LinearGradient id="guideAura" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={WHITE} stopOpacity="0.28" />
              <Stop offset="1" stopColor={WHITE} stopOpacity="0.04" />
            </LinearGradient>
            <LinearGradient id="guideFace" x1="0" y1="0" x2="0.9" y2="1">
              <Stop offset="0" stopColor="#FFE7D4" />
              <Stop offset="0.72" stopColor={FACE} />
              <Stop offset="1" stopColor={FACE_SHADE} />
            </LinearGradient>
            <LinearGradient id="guideUniform" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={primaryColor} />
              <Stop offset="1" stopColor={primaryDarkColor} />
            </LinearGradient>
          </Defs>

          <Circle cx="50" cy="48" r="45" fill="url(#guideAura)" />
          <Ellipse cx="50" cy="108" rx="30" ry="4" fill="#21173B" opacity="0.18" />

          {/* backpack and resting arm */}
          <Path d="M24 70 C13 73 13 99 20 105 L30 103 L31 73 Z" fill={primaryDarkColor} />
          <Path d="M27 68 C18 71 16 90 20 99" fill="none" stroke={FACE_SHADE} strokeWidth="8" strokeLinecap="round" />

          {/* torso, shirt, collar and tie */}
          <Path d="M27 65 C31 58 39 55 50 55 C61 55 70 59 75 67 L79 111 L21 111 Z" fill="url(#guideUniform)" />
          <Path d="M38 57 L50 64 L62 57 L65 72 L35 72 Z" fill="#F7FAFF" />
          <Path d="M39 58 L49 65 L42 72 L34 63 Z" fill={WHITE} />
          <Path d="M61 58 L51 65 L58 72 L66 63 Z" fill="#EEF3FF" />
          <Path d="M50 64 L55 71 L51 91 L45 71 Z" fill={TIE} />
          <Rect x="31" y="78" width="12" height="9" rx="2" fill={WHITE} opacity="0.22" />
          <Path d="M33 80 H41" stroke={WHITE} strokeWidth="1.4" opacity="0.6" />
          <Circle cx="64" cy="80" r="1.3" fill={WHITE} opacity="0.7" />
          <Circle cx="64" cy="88" r="1.3" fill={WHITE} opacity="0.7" />

          {/* ears and face */}
          <Ellipse cx="25" cy="36" rx="6" ry="8" fill={FACE_SHADE} />
          <Ellipse cx="75" cy="36" rx="6" ry="8" fill={FACE_SHADE} />
          <Path d="M27 17 C32 6 68 4 74 20 L72 42 C69 55 61 61 50 61 C38 61 29 54 27 42 Z" fill="url(#guideFace)" />

          {/* sculpted hair with highlight */}
          <Path d="M25 29 C24 14 34 5 50 5 C65 5 76 14 75 31 C69 24 64 19 58 17 C51 24 40 27 25 29 Z" fill={HAIR} />
          <Path d="M30 20 C38 8 55 8 67 16 C56 13 48 16 42 22 C38 25 33 27 27 27 Z" fill={HAIR_LIGHT} />
          <Path d="M58 9 C67 12 72 18 73 25" fill="none" stroke="#57506E" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />

          {/* eye whites, brows, nose, smile and blush */}
          <Ellipse cx="41" cy="36" rx="6" ry="7" fill={WHITE} />
          <Ellipse cx="59" cy="36" rx="6" ry="7" fill={WHITE} />
          <Path d="M35 29 Q41 25 47 29" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <Path d="M53 29 Q59 25 65 29" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <Path d="M49 38 Q47 43 51 43" fill="none" stroke={FACE_SHADE} strokeWidth="1.5" strokeLinecap="round" />
          <Path d="M42 48 Q50 55 59 47" fill="#A34E42" stroke="#8B4138" strokeWidth="1.2" strokeLinecap="round" />
          <Path d="M45 49 Q50 52 56 48" fill={WHITE} />
          <Ellipse cx="34" cy="45" rx="5" ry="2.3" fill="#F28D8D" opacity="0.35" />
          <Ellipse cx="66" cy="45" rx="5" ry="2.3" fill="#F28D8D" opacity="0.35" />
        </Svg>

        <Animated.View style={[styles.pupil, { left: 38.5 * u, top: 33 * u, width: 5 * u, height: 6 * u, borderRadius: 3 * u }, pupilAnim]}>
          <View style={[styles.eyeGlint, { width: 1.5 * u, height: 1.5 * u, borderRadius: u }]} />
        </Animated.View>
        <Animated.View style={[styles.pupil, { left: 56.5 * u, top: 33 * u, width: 5 * u, height: 6 * u, borderRadius: 3 * u }, pupilAnim]}>
          <View style={[styles.eyeGlint, { width: 1.5 * u, height: 1.5 * u, borderRadius: u }]} />
        </Animated.View>
      </Animated.View>

      {/* Shoulder-to-target arm. Only the stem scales; the hand stays crisp. */}
      <Animated.View
        testID="welcome-guide-arm"
        style={[
          styles.armPivot,
          {
            left: (SHOULDER_X - 6.5) * u,
            top: shoulderY,
            width: 13 * u,
            height: targetLength + 4 * u,
            transformOrigin: "50% 0%",
          },
          armPivotAnim,
        ]}
      >
        <View
          style={[
            styles.sleeve,
            {
              width: 13 * u,
              height: 18 * u,
              borderRadius: 7 * u,
              backgroundColor: primaryDarkColor,
            },
          ]}
        />
        <Animated.View
          testID="welcome-guide-stem"
          style={[
            styles.armStem,
            {
              top: 11 * u,
              left: 2.5 * u,
              width: 8 * u,
              height: stemHeight,
              borderRadius: 5 * u,
              backgroundColor: FACE,
              transformOrigin: "50% 0%",
            },
            stemAnim,
          ]}
        />
        <Animated.View
          testID="welcome-guide-hand"
          style={[
            styles.hand,
            { left: -1 * u, width: 15 * u, height: handHeight },
            handAnim,
          ]}
        >
          <View
            style={{
              width: 15 * u,
              height: 15 * u,
              borderRadius: 8 * u,
              backgroundColor: FACE,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: FACE_SHADE,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 9 * u,
              left: 5 * u,
              width: 5 * u,
              height: 14 * u,
              borderRadius: 3 * u,
              backgroundColor: FACE,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: FACE_SHADE,
            }}
          />
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          styles.contactRing,
          {
            left: SHOULDER_X * u - 11 * u,
            top: targetY - 11 * u,
            width: 22 * u,
            height: 22 * u,
            borderRadius: 11 * u,
            borderColor: WHITE,
          },
          contactRingAnim,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    overflow: "visible",
  },
  character: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 2,
  },
  pupil: {
    position: "absolute",
    zIndex: 4,
    backgroundColor: INK,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    ...Platform.select({ web: { willChange: "transform" as const } }),
  },
  eyeGlint: {
    marginLeft: "18%",
    marginTop: "14%",
    backgroundColor: WHITE,
  },
  armPivot: {
    position: "absolute",
    zIndex: 5,
  },
  sleeve: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  armStem: {
    position: "absolute",
    zIndex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FACE_SHADE,
  },
  hand: {
    position: "absolute",
    top: 0,
    zIndex: 3,
  },
  contactRing: {
    position: "absolute",
    zIndex: 7,
    borderWidth: 2,
  },
});

export const WelcomeGuideDoodle = memo(WelcomeGuideDoodleInner);
export default WelcomeGuideDoodle;
