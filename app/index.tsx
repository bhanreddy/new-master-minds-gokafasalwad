import React, { useEffect, useContext, useState } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Redirect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import LogoLoader from '../src/components/LogoLoader';
import { ThemeContext } from '../src/context/ThemeContext';
import { useAuth } from '../src/hooks/useAuth';

const { width, height } = Dimensions.get('window');

// ─── Route helper ────────────────────────────────────────────────────────────

const getHomeRoute = (role: string) => {
  switch (role) {
    case 'admin': return '/admin/dashboard';
    case 'accountant': return '/accounts/dashboard';
    case 'staff':
    case 'teacher': return '/staff/dashboard';
    case 'driver': return '/driver/dashboard';
    default: return '/(tabs)/home';
  }
};

/** Where a cold start should land, given the restored auth state. */
const resolveTarget = (user: ReturnType<typeof useAuth>['user']): string => {
  if (!user) return '/welcome';

  const roleCode =
    typeof user.role === 'object' && user.role !== null
      ? (user.role as any).code
      : user.role;

  if (roleCode === 'student' && user.has_student_profile === false) {
    return '/no-profile';
  }
  if ((roleCode === 'staff' || roleCode === 'teacher') && user.has_staff_profile === false) {
    return '/no-profile';
  }
  return getHomeRoute(roleCode);
};

// ─── Ambient Orb ─────────────────────────────────────────────────────────────

type OrbProps = {
  size: number;
  x: number;
  y: number;
  color: string;
  duration: number;
  delay: number;
  floatRange?: number;
};

const AmbientOrb = ({ size, x, y, color, duration, delay, floatRange = 28 }: OrbProps) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-floatRange, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(floatRange, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration * 0.6 }),
          withTiming(0.5, { duration: duration * 0.4 }),
        ),
        -1,
        true,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: x,
          top: y,
        },
        style,
      ]}
    />
  );
};

// ─── Glow Halo ───────────────────────────────────────────────────────────────

const GlowHalo = ({ isDark }: { isDark: boolean }) => {
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.92, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2200 }),
        withTiming(0.4, { duration: 2200 }),
      ),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: isDark ? '#3D5AFE' : '#C8B97A',
        },
        style,
      ]}
    />
  );
};

// ─── Bottom Badge ─────────────────────────────────────────────────────────────

const BottomBadge = ({ isDark }: { isDark: boolean }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(600, withTiming(1, { duration: 1000 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const textColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(80,70,50,0.45)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(120,100,60,0.2)';

  return (
    <Animated.View style={[styles.bottomBadge, style]}>
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
      <Text style={[styles.poweredLabel, { color: textColor }]}>
        Powered by{' '}
        <Text style={[styles.brandText, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(80,70,50,0.65)' }]}>
          NexSyrus
        </Text>
      </Text>
    </Animated.View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AnimatedSplash() {
  const { theme, isDark } = useContext(ThemeContext);
  const { user, loading, authChecked } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // Safety net: if auth init ever hangs, navigate with whatever state we have.
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (__DEV__) console.warn('[AnimatedSplash] Safety timeout — forcing navigation');
      setTimedOut(true);
    }, 8000);
    return () => clearTimeout(safetyTimer);
  }, []);

  // Navigate the moment the stored session is read — no animation gating.
  // Declarative Redirect is safe here even on the very first render pass.
  if ((authChecked && !loading) || timedOut) {
    return <Redirect href={resolveTarget(user) as any} />;
  }

  // ── Gradient palettes ────────────────────────────────────────────────────
  const bgGradient = isDark
    ? ['#0A0C14', '#111520', '#0D1018'] as const
    : ['#FEFDF8', '#F9F5EC', '#F2EDE0'] as const;

  // ── Orb config ───────────────────────────────────────────────────────────
  const orbs: OrbProps[] = isDark
    ? [
      { size: 320, x: -100, y: height * 0.05, color: 'rgba(61,90,254,0.12)', duration: 5200, delay: 0 },
      { size: 240, x: width - 100, y: height * 0.18, color: 'rgba(255,180,50,0.09)', duration: 6400, delay: 700 },
      { size: 280, x: width * 0.2, y: height * 0.62, color: 'rgba(0,200,150,0.08)', duration: 4800, delay: 300 },
      { size: 180, x: width * 0.7, y: height * 0.80, color: 'rgba(160,80,240,0.07)', duration: 5800, delay: 1100 },
    ]
    : [
      { size: 320, x: -100, y: height * 0.05, color: 'rgba(90,110,200,0.07)', duration: 5200, delay: 0 },
      { size: 240, x: width - 100, y: height * 0.18, color: 'rgba(200,170,80,0.09)', duration: 6400, delay: 700 },
      { size: 280, x: width * 0.2, y: height * 0.62, color: 'rgba(0,160,120,0.06)', duration: 4800, delay: 300 },
      { size: 180, x: width * 0.7, y: height * 0.80, color: 'rgba(140,80,200,0.05)', duration: 5800, delay: 1100 },
    ];

  return (
    <LinearGradient
      colors={bgGradient}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={StyleSheet.absoluteFill}
    >
      {/* Ambient floating orbs */}
      {orbs.map((orb, i) => (
        <AmbientOrb key={i} {...orb} />
      ))}

      {/* Horizontal shimmer line — top accent */}
      <View
        style={[
          styles.topAccentLine,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(120,90,30,0.08)' },
        ]}
      />

      {/* Center: glow halo + logo */}
      <View style={styles.centerStage}>
        <GlowHalo isDark={isDark} />
        <View style={styles.logoWrapper}>
          <LogoLoader
            size={160}
            color={isDark ? '#FFFFFF' : '#1C1710'}
          />
        </View>
      </View>

      {/* Bottom branding */}
      <BottomBadge isDark={isDark} />
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    // sits on top of the glow halo
    position: 'relative',
    zIndex: 1,
  },
  bottomBadge: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 12,
  },
  divider: {
    width: 40,
    height: 1,
    marginBottom: 12,
  },
  poweredLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '400',
  },
  brandText: {
    fontWeight: '600',
    letterSpacing: 1.6,
  },
});