import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isTelugu } from '../utils/lang';
import * as Haptics from '../utils/haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const ACTIVE_BG = '#5B4DB5';

type Props = {
  style?: StyleProp<ViewStyle>;
  /** Improves contrast when the control is placed over navy, black, or imagery. */
  darkBackground?: boolean;
  trackColor?: string;
  borderColor?: string;
  activeBackgroundColor?: string;
  activeLabelColor?: string;
  inactiveLabelColor?: string;
  inactiveLabelStyle?: StyleProp<TextStyle>;
  /** When provided, skips the built-in i18n switch (caller owns language state). */
  language?: 'en' | 'te';
  onLanguageChange?: (language: 'en' | 'te') => void | Promise<void>;
};

const OPTIONS = [
  { code: 'en' as const, label: 'EN', accessibilityLabel: 'English' },
  { code: 'te' as const, label: 'తెలుగు', accessibilityLabel: 'Telugu' },
] as const;

/**
 * EN / తె segmented control.
 *
 * Android-safe: one absolute thumb (never per-option backgrounds), no elevation,
 * no android_ripple (RippleDrawable paints a permanent purple fill on Android).
 */
const LanguageToggle: React.FC<Props> = ({
  style,
  darkBackground = false,
  trackColor,
  borderColor,
  activeBackgroundColor,
  activeLabelColor,
  inactiveLabelColor,
  inactiveLabelStyle,
  language,
  onLanguageChange,
}) => {
  const { i18n } = useTranslation();
  const isTeluguLang = language != null ? language === 'te' : isTelugu(i18n.language);
  const thumbX = useSharedValue(isTeluguLang ? OPTION_WIDTH : 0);
  const resolvedTrackColor =
    trackColor ??
    (darkBackground ? 'rgba(116,101,184,0.24)' : 'rgba(124,107,184,0.12)');
  const resolvedBorderColor =
    borderColor ??
    (darkBackground ? 'rgba(222,216,255,0.30)' : 'rgba(124,107,184,0.22)');
  const resolvedActiveBackgroundColor =
    activeBackgroundColor ?? (darkBackground ? '#7568CF' : ACTIVE_BG);
  const resolvedActiveLabelColor = activeLabelColor ?? '#FFFFFF';
  const resolvedInactiveLabelColor =
    inactiveLabelColor ??
    (darkBackground ? '#E9E5FF' : 'rgba(55,48,107,0.62)');

  useEffect(() => {
    thumbX.value = withSpring(isTeluguLang ? OPTION_WIDTH : 0, {
      damping: 17,
      stiffness: 210,
      mass: 0.72,
      overshootClamping: false,
    });
  }, [isTeluguLang, thumbX]);

  const thumbMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const setLanguage = useCallback(
    async (next: 'en' | 'te') => {
      const nextIsTelugu = next === 'te';
      if (nextIsTelugu === isTeluguLang) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (onLanguageChange) {
        await onLanguageChange(next);
        return;
      }

      await Promise.all([
        i18n.changeLanguage(next),
        AsyncStorage.setItem('appLanguage', next),
      ]);
    },
    [i18n, isTeluguLang, onLanguageChange],
  );

  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.track,
        darkBackground && styles.trackDark,
        {
          backgroundColor: resolvedTrackColor,
          borderColor: resolvedBorderColor,
        },
        style,
      ]}
    >
      {darkBackground ? (
        <View pointerEvents="none" style={styles.darkTrackHighlight} />
      ) : null}

      {/* Single thumb — avoids Android painting fills on every Pressable */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          darkBackground && styles.thumbDark,
          { backgroundColor: resolvedActiveBackgroundColor },
          thumbMotionStyle,
        ]}
      >
        <View style={styles.thumbHighlight} />
      </Animated.View>

      {OPTIONS.map(({ code, label, accessibilityLabel }) => {
        const isActive = code === (isTeluguLang ? 'te' : 'en');

        return (
          <Pressable
            key={code}
            accessibilityRole="radio"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ checked: isActive }}
            hitSlop={6}
            onPress={() => void setLanguage(code)}
            // Critical: disable ripple. On Android it replaces the view background
            // with a RippleDrawable that shows as a permanent purple oval.
            android_ripple={null}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
              Platform.OS === 'web' && ({ cursor: 'pointer' } as unknown as ViewStyle),
            ]}
          >
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={[
                styles.label,
                Platform.OS === 'android' && styles.labelAndroid,
                code === 'te' && styles.teluguLabel,
                isActive ? styles.labelActive : styles.labelInactive,
                !isActive && darkBackground && styles.labelInactiveDark,
                {
                  color: isActive
                    ? resolvedActiveLabelColor
                    : resolvedInactiveLabelColor,
                },
                !isActive && inactiveLabelStyle,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const OPTION_WIDTH = 48;
const OPTION_HEIGHT = 30;
const TRACK_PAD = 3;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: TRACK_PAD,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: OPTION_HEIGHT + TRACK_PAD * 2,
    // No elevation / shadow — Android draws opaque white/purple under translucent elevated views.
  },
  trackDark: {
    // A soft outline keeps the track defined on both flat navy and gradients.
    shadowColor: '#A99CF6',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  darkTrackHighlight: {
    position: 'absolute',
    top: 1,
    left: 11,
    right: 11,
    height: 1,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    width: OPTION_WIDTH,
    left: TRACK_PAD,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  thumbDark: {
    borderColor: 'rgba(255,255,255,0.42)',
  },
  thumbHighlight: {
    position: 'absolute',
    top: 1,
    left: 8,
    right: 8,
    height: 1,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  option: {
    width: OPTION_WIDTH,
    height: OPTION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  optionPressed: {
    opacity: 0.64,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  teluguLabel: {
    fontSize: 10.5,
    letterSpacing: 0,
    fontWeight: '700',
  },
  labelAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  labelActive: {
    opacity: 1,
  },
  labelInactive: {
    opacity: 1,
  },
  labelInactiveDark: {
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default LanguageToggle;
