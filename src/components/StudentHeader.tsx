import React, { useState } from 'react';
import { View, StyleSheet, Platform, Pressable, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from '../utils/haptics';
import { isTelugu as isTeluguCheck } from '../utils/lang';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolateColor, interpolate, useAnimatedStyle, Extrapolation, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import MenuOverlay from './MenuOverlay';
import ClayIconButton from './ClayIconButton';
import { Shadows, Spacing } from '../theme/themes';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { schoolColorWithAlpha } from '../constants/schoolConfig';

/** Brand violet used to tint every clay puck's shadow across the app. */
const CLAY_ACCENT = '#7C6BB8';

/** Reanimated can wrap the vector icon; it must not be nested inside `Animated.Text` (causes "Text strings must be rendered within a <Text> component" on Android). */

interface StudentHeaderProps {
    onMenuPress?: () => void;
    scrollY?: SharedValue<number>;
    menuUserType?: 'student' | 'staff' | 'driver';
    /** Override container style (e.g. transparent background) */
    style?: ViewStyle;
    /** Override title text style */
    titleStyle?: TextStyle;
}

const isWeb = Platform.OS === 'web';

const StudentHeader: React.FC<StudentHeaderProps & { showBackButton?: boolean, title?: string, showSettingsButton?: boolean, rightAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void } }> = ({ onMenuPress, showBackButton = false, title, showSettingsButton = true, rightAction, scrollY, menuUserType = 'student', style: containerStyleOverride, titleStyle: titleStyleOverride }) => {
    const router = useRouter();
    const { isDark } = useTheme();
    const { i18n } = useTranslation();
    const [isTeluguLang, setIsTeluguLang] = useState(isTeluguCheck(i18n.language));
    const [menuVisible, setMenuVisible] = useState(false);
    const insets = useSafeAreaInsets();
    const { user } = useAuth();

    React.useEffect(() => {
        setIsTeluguLang(isTeluguCheck(i18n.language));
    }, [i18n.language]);

    const setLanguage = async (language: 'en' | 'te') => {
        const nextIsTelugu = language === 'te';
        if (nextIsTelugu === isTeluguLang) return;

        setIsTeluguLang(nextIsTelugu);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await Promise.all([
            i18n.changeLanguage(language),
            AsyncStorage.setItem('appLanguage', language),
        ]);
    };

    const handleMenuPress = () => {
        if (onMenuPress) {
            onMenuPress();
        } else {
            setMenuVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    const animatedStyle = useAnimatedStyle(() => {
        if (!scrollY) {
            /* The cosmic gradient (below) always paints over this — only the lifted shadow matters here. */
            return { backgroundColor: 'transparent', borderBottomColor: 'transparent', shadowOpacity: 0.35 };
        }

        const bgEnd = isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.95)';
        const borderEnd = schoolColorWithAlpha(CLAY_ACCENT, isDark ? 0.4 : 0.2);
        const bgColor = interpolateColor(
            scrollY.value,
            [0, 50],
            ['rgba(255,255,255,0)', bgEnd]
        );
        const borderColor = interpolateColor(
            scrollY.value,
            [0, 50],
            [schoolColorWithAlpha(CLAY_ACCENT, 0), borderEnd]
        );
        const shadowOpacity = interpolate(
            scrollY.value,
            [0, 50],
            [0, isDark ? 0.35 : 0.16],
            Extrapolation.CLAMP
        );

        return {
            backgroundColor: bgColor,
            borderBottomColor: borderColor,
            shadowOpacity,
        };
    }, [isDark]);

    const isAbsolute = !!scrollY;
    /** Driver tabs already have bottom nav — hide redundant web back unless explicitly requested. */
    const showNavBack = menuUserType === 'driver'
      ? showBackButton
      : (showBackButton || isWeb);
    // Student navigation now lives in the bottom dock. Keep the drawer trigger
    // only for driver screens that still use MenuOverlay.
    const showNavMenu = menuUserType !== 'student'
      && (!showBackButton || isWeb || menuUserType === 'driver');

    const fontColorStyle = useAnimatedStyle(() => {
        if (!scrollY) return { color: '#FFFFFF' };
        const end = isDark ? '#F1F5F9' : '#1F2937';
        return {
            color: interpolateColor(
                scrollY.value,
                [0, 50],
                ['#FFFFFF', end]
            )
        };
    }, [isDark]);

    return (
        <Animated.View style={[
            styles.container,
            // On the student tabs the header sits inside a nested SafeAreaProvider
            // (ScreenLayout), so insets.top collapses to ~0 and the header rode up
            // under the school ribbon. The global stackShell already applies the real
            // safe-area offset, so a small fixed floor is all that's needed to clear
            // the ribbon's wave without re-introducing a large gap.
            { paddingTop: isWeb ? 12 : Math.max(insets.top, 16), shadowColor: CLAY_ACCENT },
            isAbsolute && styles.absoluteHeader,
            animatedStyle,
            containerStyleOverride,
        ]}>
            {!scrollY && (
                <LinearGradient
                    colors={['#05050A', '#13132B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            )}

            {/* Left: native = menu on home, back on subpages; web = both.
                Pucks are always dark-clay — the header's brand identity is dark/cosmic
                whether it's overlaying a hero image or scrolled into a solid app bar. */}
            <View style={[styles.leftNav, showNavBack && showNavMenu && styles.leftNavDual]}>
                {showNavBack ? (
                    <ClayIconButton onPress={handleBack} isDark accent={CLAY_ACCENT}>
                        <Ionicons name="arrow-back" size={19} color="#F4F0FB" />
                    </ClayIconButton>
                ) : null}
                {showNavMenu ? (
                    <ClayIconButton onPress={handleMenuPress} isDark accent={CLAY_ACCENT}>
                        <Ionicons name="menu" size={19} color="#F4F0FB" />
                    </ClayIconButton>
                ) : null}
            </View>

            {/* Center: sub-page title. Home quick actions live in the dashboard grid. */}
            <View style={styles.centerRegion}>
                {title && (
                    <Animated.Text style={[styles.headerTitle, fontColorStyle, titleStyleOverride]} numberOfLines={1}>
                        {title}
                    </Animated.Text>
                )}
            </View>

            <View style={styles.rightActions}>
                {/* Compact segmented language control with an unambiguous active state. */}
                <View
                    accessibilityRole="radiogroup"
                    style={[
                        styles.langSwitch,
                        {
                            backgroundColor: isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(124,107,184,0.12)',
                        },
                    ]}
                >
                    {([
                        { code: 'en' as const, label: 'EN', accessibilityLabel: 'English' },
                        { code: 'te' as const, label: 'తె', accessibilityLabel: 'Telugu' },
                    ]).map(({ code, label, accessibilityLabel }) => {
                        const isActive = code === (isTeluguLang ? 'te' : 'en');

                        return (
                            <Pressable
                                key={code}
                                accessibilityRole="radio"
                                accessibilityLabel={accessibilityLabel}
                                accessibilityState={{ checked: isActive }}
                                hitSlop={4}
                                onPress={() => void setLanguage(code)}
                                style={({ pressed }) => [
                                    styles.langOption,
                                    Platform.OS === 'web' && ({ cursor: 'pointer' } as unknown as ViewStyle),
                                    pressed && styles.langOptionPressed,
                                ]}
                            >
                                {isActive && (
                                    <LinearGradient
                                        colors={['#9486E8', '#6656C7']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.langOptionActive}
                                    />
                                )}
                                <Animated.Text
                                    style={[
                                        styles.langLabelBase,
                                        fontColorStyle,
                                        !isActive && styles.langLabelInactive,
                                        isActive && styles.langLabelActive,
                                    ]}
                                >
                                    {label}
                                </Animated.Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Optional page-specific action (e.g. compose a new message) */}
                {rightAction && (
                    <ClayIconButton
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            rightAction.onPress();
                        }}
                        isDark
                        accent={CLAY_ACCENT}
                        round
                        size={38}
                    >
                        <Ionicons name={rightAction.icon} size={18} color="#F4F0FB" />
                    </ClayIconButton>
                )}

                {/* Settings Button */}
                {showSettingsButton && (
                    <ClayIconButton
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/Screen/settings' as any);
                        }}
                        isDark
                        accent={CLAY_ACCENT}
                        round
                        size={38}
                    >
                        <Ionicons name="settings-outline" size={17} color="#F4F0FB" />
                    </ClayIconButton>
                )}
            </View>

            {menuUserType !== 'student' && (
                <MenuOverlay visible={menuVisible} onClose={() => setMenuVisible(false)} userType={menuUserType} photoUrl={user?.photoUrl} />
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'transparent',
        borderBottomLeftRadius: 26,
        borderBottomRightRadius: 26,
        overflow: 'hidden',
        ...Shadows.sm,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
    },
    leftNav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    leftNavDual: {
        gap: 10,
    },
    centerRegion: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    rightActions: {
        flexShrink: 0,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingRight: Spacing.xs,
    },
    langSwitch: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 3,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(148,134,232,0.32)',
        shadowColor: CLAY_ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 3,
    },
    langOption: {
        width: 36,
        height: 30,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    langOptionPressed: {
        opacity: 0.84,
        transform: [{ scale: 0.96 }],
    },
    langOptionActive: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.34)',
    },
    langLabelBase: {
        fontSize: 10.5,
        fontWeight: '800',
        letterSpacing: 0.55,
    },
    langLabelInactive: {
        opacity: 0.52,
    },
    langLabelActive: {
        color: '#FFFFFF',
        opacity: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    absoluteHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
});

export default StudentHeader;
