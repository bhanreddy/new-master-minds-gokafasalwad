/**
 * Premium form-reactive login guide.
 *
 * The illustration is static SVG (crisp on native and web); Reanimated only
 * drives transforms and opacity on lightweight View overlays. Each auth state
 * has a distinct pose while password privacy remains the first priority.
 */
import React, { memo, useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
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
} from 'react-native-svg';
import type { LoginFormDoodleProps } from './doodleTypes';

const FACE = '#FFD9BE';
const FACE_SHADE = '#F1B48B';
const HAIR = '#24213A';
const HAIR_LIGHT = '#433D5E';
const INK = '#25243A';
const WHITE = '#FFFFFF';
const TIE = '#F2A23A';
const ERROR = '#D94C5B';
const SUCCESS = '#2EAA76';

const POSE = { duration: 220, easing: Easing.out(Easing.cubic) } as const;
const EYES_SHUT = { duration: 95, easing: Easing.out(Easing.quad) } as const;
const EYES_OPEN = { duration: 190, easing: Easing.out(Easing.quad) } as const;
const ARM_SPRING = { damping: 15, stiffness: 185, mass: 0.85 } as const;

function LoginFormDoodleInner({
  state,
  size,
  primaryColor,
  primaryDarkColor,
  motionEnabled,
}: LoginFormDoodleProps) {
  const u = size / 100;
  const height = size * 1.18;

  const eyeOpen = useSharedValue(1);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const tilt = useSharedValue(0);
  const mouth = useSharedValue(0); // -1 concern · 0 smile · 1 celebration
  const handsCover = useSharedValue(0);
  const peek = useSharedValue(0);
  const pointDown = useSharedValue(0);
  const celebrate = useSharedValue(0);
  const busyVisible = useSharedValue(0);
  const busySpin = useSharedValue(0);
  const errorPulse = useSharedValue(0);
  const bounce = useSharedValue(0);
  const shake = useSharedValue(0);
  const blink = useSharedValue(1);
  const breath = useSharedValue(0);
  const wave = useSharedValue(0);

  useEffect(() => {
    if (!motionEnabled) {
      blink.value = 1;
      breath.value = 0;
      return;
    }

    blink.value = withRepeat(
      withSequence(
        withDelay(3200, withTiming(0.06, { duration: 65 })),
        withTiming(1, { duration: 100 }),
        withDelay(170, withTiming(0.08, { duration: 55 })),
        withTiming(1, { duration: 95 }),
      ),
      -1,
      false,
    );
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1550, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1550, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(blink);
      cancelAnimation(breath);
      blink.value = 1;
      breath.value = 0;
    };
  }, [blink, breath, motionEnabled]);

  useEffect(() => {
    const pose = motionEnabled ? POSE : { duration: 0 };
    const open = motionEnabled ? EYES_OPEN : { duration: 0 };
    const shut = motionEnabled ? EYES_SHUT : { duration: 0 };
    const armTo = (value: number) => {
      handsCover.value = motionEnabled
        ? withSpring(value, ARM_SPRING)
        : withTiming(value, { duration: 0 });
    };

    cancelAnimation(busySpin);
    cancelAnimation(wave);
    busySpin.value = 0;
    busyVisible.value = withTiming(0, pose);
    celebrate.value = withTiming(0, pose);
    errorPulse.value = withTiming(0, pose);
    peek.value = withTiming(0, pose);
    pointDown.value = withTiming(0, pose);
    wave.value = 0;
    bounce.value = withTiming(0, pose);
    shake.value = withTiming(0, pose);

    switch (state) {
      case 'usernameActive':
        eyeOpen.value = withTiming(1, open);
        armTo(0);
        lookX.value = withTiming(-0.45, pose);
        lookY.value = withTiming(0.85, pose);
        tilt.value = withTiming(-4, pose);
        mouth.value = withTiming(0, pose);
        pointDown.value = withTiming(1, pose);
        break;
      case 'passwordHidden':
        // Lids close before the arms arrive. The pose never exposes the field.
        eyeOpen.value = withTiming(0, shut);
        lookX.value = withTiming(0, pose);
        lookY.value = withTiming(0, pose);
        tilt.value = withTiming(0, pose);
        mouth.value = withTiming(0, pose);
        armTo(1);
        break;
      case 'passwordVisible':
        eyeOpen.value = withTiming(1, open);
        armTo(0);
        lookX.value = withTiming(0.35, pose);
        lookY.value = withTiming(0.9, pose);
        tilt.value = withTiming(3, pose);
        mouth.value = withTiming(0, pose);
        peek.value = withTiming(1, pose);
        break;
      case 'submitting':
        eyeOpen.value = withTiming(0.62, pose);
        armTo(0);
        lookX.value = withTiming(0, pose);
        lookY.value = withTiming(0.65, pose);
        tilt.value = withTiming(0, pose);
        mouth.value = withTiming(0, pose);
        busyVisible.value = withTiming(1, pose);
        if (motionEnabled) {
          busySpin.value = withRepeat(
            withTiming(1, { duration: 1050, easing: Easing.linear }),
            -1,
            false,
          );
        }
        break;
      case 'success':
        eyeOpen.value = withTiming(1, open);
        armTo(0);
        lookX.value = withTiming(0, pose);
        lookY.value = withTiming(0, pose);
        tilt.value = withTiming(0, pose);
        mouth.value = withTiming(1, pose);
        celebrate.value = motionEnabled
          ? withSpring(1, { damping: 11, stiffness: 170 })
          : withTiming(1, { duration: 0 });
        if (motionEnabled) {
          bounce.value = withSequence(
            withTiming(-9 * u, { duration: 135, easing: Easing.out(Easing.quad) }),
            withSpring(0, { damping: 8, stiffness: 220 }),
          );
        }
        break;
      case 'error':
        eyeOpen.value = withTiming(1, open);
        armTo(0);
        lookX.value = withTiming(0, pose);
        lookY.value = withTiming(0.35, pose);
        tilt.value = withTiming(0, pose);
        mouth.value = withTiming(-1, pose);
        errorPulse.value = motionEnabled
          ? withSequence(
              withTiming(1, { duration: 130 }),
              withDelay(650, withTiming(0.15, { duration: 280 })),
            )
          : withTiming(1, { duration: 0 });
        if (motionEnabled) {
          shake.value = withSequence(
            withTiming(-5 * u, { duration: 55 }),
            withTiming(5 * u, { duration: 65 }),
            withTiming(-3.5 * u, { duration: 60 }),
            withTiming(2.5 * u, { duration: 60 }),
            withTiming(0, { duration: 90 }),
          );
        }
        break;
      case 'idle':
      default:
        eyeOpen.value = withTiming(1, open);
        armTo(0);
        lookX.value = withTiming(0, pose);
        lookY.value = withTiming(0, pose);
        tilt.value = withTiming(0, pose);
        mouth.value = withTiming(0, pose);
        if (motionEnabled) {
          wave.value = withRepeat(
            withSequence(
              withDelay(4200, withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) })),
              withTiming(0.55, { duration: 150 }),
              withTiming(1, { duration: 150 }),
              withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) }),
            ),
            -1,
            false,
          );
        }
        break;
    }
  }, [
    state,
    motionEnabled,
    u,
    eyeOpen,
    lookX,
    lookY,
    tilt,
    mouth,
    handsCover,
    peek,
    pointDown,
    celebrate,
    busyVisible,
    busySpin,
    errorPulse,
    bounce,
    shake,
    wave,
  ]);

  useEffect(() => () => {
    cancelAnimation(busySpin);
    cancelAnimation(wave);
    cancelAnimation(bounce);
    cancelAnimation(shake);
  }, [bounce, busySpin, shake, wave]);

  const rootAnim = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value },
      {
        translateY:
          interpolate(breath.value, [0, 1], [0, -2.2 * u]) + bounce.value,
      },
    ],
  }));

  const characterAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value}deg` }],
  }));

  const eyeShellAnim = useAnimatedStyle(() => ({
    transform: [
      { scaleY: Math.max(eyeOpen.value * blink.value, 0.06) },
    ],
  }));

  const pupilAnim = useAnimatedStyle(() => ({
    transform: [
      { translateX: lookX.value * 2.5 * u },
      { translateY: lookY.value * 2.2 * u },
    ],
  }));

  const leftArmAnim = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${
          interpolate(handsCover.value, [0, 1], [12, -155]) +
          interpolate(celebrate.value, [0, 1], [0, 129]) +
          interpolate(pointDown.value, [0, 1], [0, -24])
        }deg`,
      },
    ],
  }));

  const rightArmAnim = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${
          interpolate(handsCover.value, [0, 1], [-12, 155]) +
          interpolate(peek.value, [0, 1], [0, 178]) +
          interpolate(celebrate.value, [0, 1], [0, -129]) +
          interpolate(wave.value, [0, 0.55, 1], [0, -120, -138])
        }deg`,
      },
    ],
  }));

  const mouthNeutralAnim = useAnimatedStyle(() => ({
    opacity: 1 - Math.abs(mouth.value),
  }));
  const mouthHappyAnim = useAnimatedStyle(() => ({
    opacity: Math.max(mouth.value, 0),
    transform: [{ scale: interpolate(mouth.value, [0, 1], [0.75, 1]) }],
  }));
  const mouthConcernedAnim = useAnimatedStyle(() => ({
    opacity: Math.max(-mouth.value, 0),
  }));

  const busyAnim = useAnimatedStyle(() => ({
    opacity: busyVisible.value,
    transform: [
      { rotate: `${busySpin.value * 360}deg` },
      { scale: interpolate(busyVisible.value, [0, 1], [0.82, 1]) },
    ],
  }));

  const successAnim = useAnimatedStyle(() => ({
    opacity: celebrate.value,
    transform: [
      { scale: interpolate(celebrate.value, [0, 1], [0.5, 1]) },
      { translateY: interpolate(celebrate.value, [0, 1], [7 * u, 0]) },
    ],
  }));

  const errorAnim = useAnimatedStyle(() => ({
    opacity: errorPulse.value,
    transform: [{ scale: interpolate(errorPulse.value, [0, 1], [0.65, 1]) }],
  }));

  const Eye = ({ left }: { left: number }) => (
    <Animated.View
      style={[
        styles.eyeShell,
        {
          left: left * u,
          top: 30.5 * u,
          width: 13 * u,
          height: 15 * u,
          borderRadius: 7 * u,
          transformOrigin: '50% 50%',
        },
        eyeShellAnim,
      ]}
    >
      <Animated.View
        style={[
          styles.pupil,
          {
            left: 4 * u,
            top: 4.5 * u,
            width: 5 * u,
            height: 6 * u,
            borderRadius: 3 * u,
          },
          pupilAnim,
        ]}
      >
        <View style={[styles.eyeGlint, { width: 1.5 * u, height: 1.5 * u, borderRadius: u }]} />
      </Animated.View>
    </Animated.View>
  );

  const Arm = ({ side }: { side: 'left' | 'right' }) => (
    <Animated.View
      testID={`login-doodle-${side}-arm`}
      style={[
        styles.arm,
        {
          left: side === 'left' ? 22 * u : 64 * u,
          top: 68 * u,
          width: 14 * u,
          height: 38 * u,
          transformOrigin: '50% 0%',
        },
        side === 'left' ? leftArmAnim : rightArmAnim,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 14 * u,
          height: 14 * u,
          borderRadius: 7 * u,
          backgroundColor: primaryDarkColor,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.2)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 9 * u,
          left: 3 * u,
          width: 8 * u,
          height: 19 * u,
          borderRadius: 5 * u,
          backgroundColor: FACE,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: FACE_SHADE,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0.5 * u,
          left: -0.5 * u,
          width: 15 * u,
          height: 15 * u,
          borderRadius: 8 * u,
          backgroundColor: FACE,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: FACE_SHADE,
        }}
      >
        <View style={[styles.fingerLine, { top: 4 * u, left: 3 * u, width: 9 * u }]} />
        <View style={[styles.fingerLine, { top: 7 * u, left: 3.5 * u, width: 8 * u }]} />
      </View>
    </Animated.View>
  );

  return (
    <Animated.View
      testID="login-doodle"
      pointerEvents="none"
      style={[{ width: size, height, overflow: 'visible' }, rootAnim]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        testID="login-doodle-busy-ring"
        style={[
          styles.busyRing,
          {
            left: 6 * u,
            top: 0,
            width: 88 * u,
            height: 88 * u,
            borderRadius: 44 * u,
            borderColor: primaryColor,
          },
          busyAnim,
        ]}
      >
        <View style={[styles.busyDot, { top: -2 * u, left: 40 * u, width: 8 * u, height: 8 * u, borderRadius: 4 * u, backgroundColor: primaryColor }]} />
        <View style={[styles.busyDot, { right: 2 * u, top: 17 * u, width: 5 * u, height: 5 * u, borderRadius: 3 * u, backgroundColor: primaryDarkColor }]} />
      </Animated.View>

      <Animated.View
        style={[
          styles.character,
          { width: size, height, transformOrigin: '50% 88%' },
          characterAnim,
        ]}
      >
        <Svg width={size} height={height} viewBox="0 0 100 118">
          <Defs>
            <LinearGradient id="loginAura" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={primaryColor} stopOpacity="0.2" />
              <Stop offset="1" stopColor={primaryColor} stopOpacity="0.02" />
            </LinearGradient>
            <LinearGradient id="loginFace" x1="0" y1="0" x2="0.9" y2="1">
              <Stop offset="0" stopColor="#FFE8D7" />
              <Stop offset="0.72" stopColor={FACE} />
              <Stop offset="1" stopColor={FACE_SHADE} />
            </LinearGradient>
            <LinearGradient id="loginUniform" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={primaryColor} />
              <Stop offset="1" stopColor={primaryDarkColor} />
            </LinearGradient>
          </Defs>

          <Circle cx="50" cy="47" r="44" fill="url(#loginAura)" />
          <Ellipse cx="50" cy="113" rx="31" ry="4" fill="#21173B" opacity="0.17" />
          <Path d="M23 72 C15 75 15 101 21 108 L31 105 L32 72 Z" fill={primaryDarkColor} opacity="0.85" />

          <Path d="M27 66 C32 59 40 56 50 56 C61 56 70 60 75 68 L80 114 L20 114 Z" fill="url(#loginUniform)" />
          <Path d="M38 58 L50 65 L62 58 L65 74 L35 74 Z" fill="#F7FAFF" />
          <Path d="M39 59 L49 66 L42 73 L34 64 Z" fill={WHITE} />
          <Path d="M61 59 L51 66 L58 73 L66 64 Z" fill="#EAF0FF" />
          <Path d="M50 65 L55 72 L51 94 L45 72 Z" fill={TIE} />
          <Rect x="30" y="81" width="13" height="10" rx="2" fill={WHITE} opacity="0.2" />
          <Path d="M32 83 H41" stroke={WHITE} strokeWidth="1.4" opacity="0.65" />
          <Circle cx="65" cy="82" r="1.3" fill={WHITE} opacity="0.7" />
          <Circle cx="65" cy="90" r="1.3" fill={WHITE} opacity="0.7" />

          <Ellipse cx="25" cy="37" rx="6" ry="8" fill={FACE_SHADE} />
          <Ellipse cx="75" cy="37" rx="6" ry="8" fill={FACE_SHADE} />
          <Path d="M27 18 C32 7 68 5 74 21 L72 43 C69 56 61 62 50 62 C38 62 29 55 27 43 Z" fill="url(#loginFace)" />

          <Path d="M25 30 C24 15 34 6 50 6 C65 6 76 15 75 32 C69 25 64 20 58 18 C51 25 40 28 25 30 Z" fill={HAIR} />
          <Path d="M30 21 C38 9 55 9 67 17 C56 14 48 17 42 23 C38 26 33 28 27 28 Z" fill={HAIR_LIGHT} />
          <Path d="M58 10 C67 13 72 19 73 26" fill="none" stroke="#5E5778" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />

          <Path d="M35 30 Q41 26 47 30" fill="none" stroke={INK} strokeWidth="2.1" strokeLinecap="round" />
          <Path d="M53 30 Q59 26 65 30" fill="none" stroke={INK} strokeWidth="2.1" strokeLinecap="round" />
          <Path d="M49 40 Q47 45 51 45" fill="none" stroke={FACE_SHADE} strokeWidth="1.5" strokeLinecap="round" />
          <Ellipse cx="34" cy="47" rx="5" ry="2.3" fill="#F28D8D" opacity="0.35" />
          <Ellipse cx="66" cy="47" rx="5" ry="2.3" fill="#F28D8D" opacity="0.35" />
        </Svg>

        <Eye left={34.5} />
        <Eye left={52.5} />

        <Animated.View style={[styles.mouth, { left: 41 * u, top: 49 * u, width: 18 * u, height: 11 * u }, mouthNeutralAnim]}>
          <Svg width="100%" height="100%" viewBox="0 0 18 11">
            <Path d="M2 2 Q9 10 16 2" fill="none" stroke="#9A4B3B" strokeWidth="2.2" strokeLinecap="round" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.mouth, { left: 40 * u, top: 48 * u, width: 20 * u, height: 13 * u }, mouthHappyAnim]}>
          <Svg width="100%" height="100%" viewBox="0 0 20 13">
            <Path d="M2 2 Q10 14 18 2 Q10 8 2 2" fill="#8D3F35" />
            <Path d="M5 3 Q10 6 15 3" fill={WHITE} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.mouth, { left: 43 * u, top: 53 * u, width: 14 * u, height: 8 * u }, mouthConcernedAnim]}>
          <Svg width="100%" height="100%" viewBox="0 0 14 8">
            <Path d="M1 7 Q7 0 13 7" fill="none" stroke="#9A4B3B" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </Animated.View>

      <Arm side="left" />
      <Arm side="right" />

      <Animated.View style={[styles.successBadge, { right: -1 * u, top: 12 * u, width: 27 * u, height: 27 * u, borderRadius: 14 * u }, successAnim]}>
        <Text style={[styles.successMark, { fontSize: 16 * u }]}>✓</Text>
      </Animated.View>
      <Animated.View style={[styles.errorBadge, { right: 1 * u, top: 15 * u, width: 24 * u, height: 24 * u, borderRadius: 12 * u }, errorAnim]}>
        <Text style={[styles.errorMark, { fontSize: 15 * u }]}>!</Text>
      </Animated.View>

      <Animated.View style={[styles.confettiLayer, successAnim]}>
        <View style={[styles.confetti, { left: 7 * u, top: 15 * u, width: 4 * u, height: 10 * u, backgroundColor: '#F2A23A', transform: [{ rotate: '-28deg' }] }]} />
        <View style={[styles.confetti, { left: 17 * u, top: 2 * u, width: 7 * u, height: 7 * u, borderRadius: 4 * u, backgroundColor: SUCCESS }]} />
        <View style={[styles.confetti, { right: 11 * u, top: 2 * u, width: 4 * u, height: 10 * u, backgroundColor: '#7C5AC7', transform: [{ rotate: '25deg' }] }]} />
        <View style={[styles.confetti, { right: 2 * u, top: 29 * u, width: 6 * u, height: 6 * u, borderRadius: 3 * u, backgroundColor: '#E95F8A' }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  character: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
  },
  eyeShell: {
    position: 'absolute',
    zIndex: 4,
    overflow: 'hidden',
    backgroundColor: WHITE,
    borderBottomWidth: 1.3,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pupil: {
    position: 'absolute',
    zIndex: 4,
    backgroundColor: INK,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    ...Platform.select({ web: { willChange: 'transform' as const } }),
  },
  eyeGlint: {
    marginLeft: '18%',
    marginTop: '14%',
    backgroundColor: WHITE,
  },
  mouth: {
    position: 'absolute',
    zIndex: 5,
  },
  arm: {
    position: 'absolute',
    zIndex: 7,
  },
  fingerLine: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: FACE_SHADE,
    opacity: 0.8,
  },
  busyRing: {
    position: 'absolute',
    zIndex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0,
  },
  busyDot: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  successBadge: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS,
    borderWidth: 2,
    borderColor: WHITE,
    ...Platform.select({
      ios: { shadowColor: SUCCESS, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 5 },
      web: { boxShadow: '0 5px 14px rgba(46,170,118,0.28)' } as any,
    }),
  },
  successMark: {
    color: WHITE,
    fontWeight: '900',
    lineHeight: 20,
  },
  errorBadge: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ERROR,
    borderWidth: 2,
    borderColor: WHITE,
  },
  errorMark: {
    color: WHITE,
    fontWeight: '900',
    lineHeight: 18,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
  },
  confetti: {
    position: 'absolute',
  },
});

export const LoginFormDoodle = memo(LoginFormDoodleInner);
export default LoginFormDoodle;
