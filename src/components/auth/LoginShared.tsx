/**
 * LoginShared — Reusable UI primitives shared across every login screen.
 *
 * Exports:
 *   • DecorRing   — translucent decorative circle for the hero background
 *   • FloatingInput — text input with an animated floating label
 *   • SignInButton  — gradient call-to-action button
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useLoginTheme, type LoginTheme } from '@/src/hooks/useLoginTheme';

// ─── DecorRing ────────────────────────────────────────────────────────────────

interface DecorRingProps {
  size: number;
  x: number;
  y: number;
  color: string;
  borderWidth?: number;
}

export const DecorRing: React.FC<DecorRingProps> = ({
  size,
  x,
  y,
  color,
  borderWidth: bw,
}) => (
  <View
    style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: size / 2,
      left: x,
      top: y,
      ...(bw
        ? { borderWidth: bw, borderColor: color }
        : { backgroundColor: color }),
    }}
    pointerEvents="none"
  />
);

// ─── FloatingInput ────────────────────────────────────────────────────────────

interface FloatingInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  hasError?: boolean;
  errorText?: string;
  delay?: number;
  rightAction?: React.ReactNode;
}

export const FloatingInput: React.FC<FloatingInputProps> = ({
  label,
  value,
  onChangeText,
  icon,
  hasError,
  errorText,
  delay = 0,
  rightAction,
  ...rest
}) => {
  const C = useLoginTheme();
  const s = makeInputStyles(C);

  const focused = useRef(false);
  const anim = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    if (value) anim.value = withTiming(1, { duration: 200 });
  }, [value]);

  const handleFocus = () => {
    focused.current = true;
    anim.value = withTiming(1, { duration: 200 });
  };

  const handleBlur = () => {
    focused.current = false;
    if (!value) anim.value = withTiming(0, { duration: 200 });
  };

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: anim.value === 1 ? -12 : 0 },
      { scale: anim.value === 1 ? 0.78 : 1 },
    ],
    color: interpolateColor(
      anim.value,
      [0, 1],
      [C.inkSoft, hasError ? C.error : C.accent],
    ),
  }));

  const borderColor = hasError
    ? C.error
    : focused.current
    ? C.accent
    : C.borderNeutral;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)}>
      <View
        style={[
          s.inputOuter,
          {
            borderColor,
            backgroundColor: C.surfaceAlt,
            shadowOpacity: focused.current ? 0.08 : 0,
          },
        ]}
      >
        <View style={s.inputIconWrap}>
          <Ionicons
            name={icon}
            size={18}
            color={hasError ? C.error : C.inkSoft}
          />
        </View>
        <View style={s.inputLabelArea}>
          <Animated.Text style={[s.floatingLabel, labelStyle]}>
            {label}
          </Animated.Text>
          <TextInput
            style={s.textInput}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={C.inkGhost}
            {...rest}
          />
        </View>
        {rightAction && <View style={s.inputRightSlot}>{rightAction}</View>}
      </View>
      {hasError && errorText ? (
        <Text style={s.errorLabel}>{errorText}</Text>
      ) : null}
    </Animated.View>
  );
};

const makeInputStyles = (C: LoginTheme) =>
  StyleSheet.create({
    inputOuter: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1.5,
      minHeight: 58,
      paddingHorizontal: 14,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
    },
    inputIconWrap: {
      width: 28,
      alignItems: 'center',
      marginRight: 4,
    },
    inputLabelArea: {
      flex: 1,
      height: 58,
      justifyContent: 'center',
      paddingTop: 14,
    },
    floatingLabel: {
      position: 'absolute',
      left: 0,
      fontSize: 14,
      fontWeight: '500',
      transformOrigin: 'left',
    },
    textInput: {
      fontSize: 15,
      color: C.ink,
      fontWeight: '500',
      paddingVertical: 0,
      height: 26,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    inputRightSlot: {
      paddingLeft: 8,
    },
    errorLabel: {
      fontSize: 11,
      color: C.error,
      marginTop: 5,
      marginLeft: 14,
      fontWeight: '500',
    },
  });

// ─── SignInButton ─────────────────────────────────────────────────────────────

interface SignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  label?: string;
}

export const SignInButton: React.FC<SignInButtonProps> = ({
  onPress,
  loading,
  label = 'Sign In',
}) => {
  const C = useLoginTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={loading}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        ...C.shadow.md,
        shadowColor: C.accentDeep,
      }}
    >
      <LinearGradient
        colors={[C.accent, C.accentDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={btnStyles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={btnStyles.label}>{label}</Text>
            <View style={btnStyles.arrow}>
              <Ionicons name="arrow-forward" size={15} color="#fff" />
            </View>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const btnStyles = StyleSheet.create({
  gradient: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
