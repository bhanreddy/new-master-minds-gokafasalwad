/**
 * CustomToast — Premium notification toasts with glassmorphism,
 * animated icons, gradient accents, and theme-aware styling.
 *
 * Drop-in replacement for the default react-native-toast-message config.
 * Usage: <Toast config={toastConfig} />
 */

import React, { useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  SlideInUp,
} from 'react-native-reanimated';
import * as Haptics from '@/src/utils/haptics';
import { ThemeContext } from '@/src/context/ThemeContext';
import type { ToastConfigParams } from 'react-native-toast-message';

// ─── Type-to-visual mapping ─────────────────────────────────────────────────

interface ToastVisual {
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  glow: string;
  accentLight: string;
  accentDark: string;
}

const TOAST_VISUALS: Record<string, ToastVisual> = {
  success: {
    icon: 'checkmark-circle',
    gradient: ['#10B981', '#059669'],
    glow: 'rgba(16, 185, 129, 0.35)',
    accentLight: '#ECFDF5',
    accentDark: 'rgba(16, 185, 129, 0.15)',
  },
  error: {
    icon: 'alert-circle',
    gradient: ['#EF4444', '#DC2626'],
    glow: 'rgba(239, 68, 68, 0.35)',
    accentLight: '#FEF2F2',
    accentDark: 'rgba(239, 68, 68, 0.15)',
  },
  info: {
    icon: 'information-circle',
    gradient: ['#3B82F6', '#2563EB'],
    glow: 'rgba(59, 130, 246, 0.35)',
    accentLight: '#EFF6FF',
    accentDark: 'rgba(59, 130, 246, 0.15)',
  },
};

// ─── Animated Icon ──────────────────────────────────────────────────────────

function AnimatedToastIcon({ visual, type }: { visual: ToastVisual; type: string }) {
  const scale = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Bouncy entrance
    scale.value = withDelay(80, withSpring(1, { damping: 10, stiffness: 220 }));

    // Gentle pulse for error/info
    if (type !== 'success') {
      pulseScale.value = withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(1.08, { duration: 800 }),
            withTiming(1, { duration: 800 })
          ),
          3,
          true
        )
      );
    }
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulseScale.value }],
  }));

  return (
    <Animated.View style={iconStyle}>
      <LinearGradient
        colors={visual.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconGradient}
      >
        <Ionicons name={visual.icon} size={20} color="#FFF" />
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Toast Body ─────────────────────────────────────────────────────────────

function PremiumToast({ type = 'info', text1, text2, onPress, hide }: ToastConfigParams<any>) {
  const { theme, isDark } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const visual = TOAST_VISUALS[type] || TOAST_VISUALS.info;

  // Haptic feedback on mount
  useEffect(() => {
    if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  // Progress bar animation
  const progressWidth = useSharedValue(100);
  useEffect(() => {
    progressWidth.value = withTiming(0, { duration: 4000 });
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const maxWidth = Math.min(width - 32, 420);
  const bg = isDark ? 'rgba(21, 27, 43, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(16).mass(0.8)}
      style={[
        styles.wrapper,
        {
          maxWidth,
          marginTop: Platform.OS === 'ios' ? insets.top : insets.top + 4,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          if (onPress) onPress();
          hide();
        }}
        style={[
          styles.container,
          {
            backgroundColor: bg,
            borderColor,
          },
        ]}
      >
        {/* Glow orb behind icon */}
        <View style={[styles.glowOrb, { backgroundColor: visual.glow }]} />

        {/* Accent stripe on the left */}
        <LinearGradient
          colors={visual.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.accentStripe}
        />

        {/* Icon */}
        <View style={styles.iconWrap}>
          <AnimatedToastIcon visual={visual} type={type} />
        </View>

        {/* Text content */}
        <View style={styles.textWrap}>
          {text1 ? (
            <Text
              style={[
                styles.title,
                { color: isDark ? '#F1F5F9' : '#0F172A' },
              ]}
              numberOfLines={2}
            >
              {text1}
            </Text>
          ) : null}
          {text2 ? (
            <Text
              style={[
                styles.body,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
              numberOfLines={3}
            >
              {text2}
            </Text>
          ) : null}
        </View>

        {/* Close button */}
        <TouchableOpacity
          onPress={() => hide()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <Ionicons
            name="close"
            size={16}
            color={isDark ? '#64748B' : '#94A3B8'}
          />
        </TouchableOpacity>

        {/* Animated progress bar at bottom */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]}>
            <LinearGradient
              colors={visual.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Config Export ───────────────────────────────────────────────────────────

export const toastConfig = {
  success: (props: ToastConfigParams<any>) => <PremiumToast {...props} />,
  error: (props: ToastConfigParams<any>) => <PremiumToast {...props} />,
  info: (props: ToastConfigParams<any>) => <PremiumToast {...props} />,
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    paddingLeft: 18,
    paddingRight: 12,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
      } as any,
    }),
  },

  // Left accent stripe
  accentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },

  // Background glow orb
  glowOrb: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: -30,
    left: -20,
    opacity: 0.18,
  },

  // Icon
  iconWrap: {
    marginRight: 12,
  },
  iconGradient: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      } as any,
    }),
  },

  // Text
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  body: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    marginTop: 2,
  },

  // Close
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Progress
  progressTrack: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 0,
    height: 2.5,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
});
