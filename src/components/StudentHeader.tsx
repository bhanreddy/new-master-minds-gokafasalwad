import React, { useState } from 'react';
import { View, StyleSheet, Platform, ViewStyle, TextStyle, Image } from 'react-native';
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
import LanguageToggle from './LanguageToggle';
import { Shadows, Spacing } from '../theme/themes';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCHOOL_CONFIG, schoolColorWithAlpha } from '../constants/schoolConfig';

/** Brand violet used to tint every clay puck's shadow across the app. */
const CLAY_ACCENT = '#7C6BB8';
const GOLD = SCHOOL_CONFIG.theme.accent;

/** Short school label for the center brand pill (first meaningful word). */
const SCHOOL_BRAND =
    SCHOOL_CONFIG.name.split(/\s+/).find((w) => w.length > 2 && !/^school$/i.test(w))
    ?? SCHOOL_CONFIG.name.split(/\s+/)[0]
    ?? 'School';

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

    const brandSubStyle = useAnimatedStyle(() => {
        if (!scrollY) return { color: schoolColorWithAlpha(GOLD, 0.92) };
        return {
            color: interpolateColor(
                scrollY.value,
                [0, 50],
                [schoolColorWithAlpha(GOLD, 0.92), isDark ? '#F09822' : '#B45309']
            ),
        };
    }, [isDark]);

    const brandPillStyle = useAnimatedStyle(() => {
        if (!scrollY) {
            return {
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.14)',
            };
        }
        return {
            backgroundColor: interpolateColor(
                scrollY.value,
                [0, 50],
                ['rgba(255,255,255,0.08)', isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,107,184,0.10)']
            ),
            borderColor: interpolateColor(
                scrollY.value,
                [0, 50],
                ['rgba(255,255,255,0.14)', schoolColorWithAlpha(CLAY_ACCENT, isDark ? 0.28 : 0.22)]
            ),
        };
    }, [isDark]);

    // Without scrollY this header always uses the cosmic navy gradient, even
    // while the app is in light mode. Base the toggle contrast on its actual
    // surface instead of the global theme.
    const languageOnDarkSurface = !scrollY || isDark;

    // Solid fills (no LinearGradient / elevation) — Android otherwise paints a
    // white rectangle over the inactive segment.
    const langSwitch = (
        <LanguageToggle
            language={isTeluguLang ? 'te' : 'en'}
            onLanguageChange={setLanguage}
            darkBackground={languageOnDarkSurface}
            trackColor={languageOnDarkSurface ? 'rgba(116,101,184,0.24)' : 'rgba(124,107,184,0.14)'}
            borderColor={languageOnDarkSurface ? 'rgba(222,216,255,0.30)' : 'rgba(124,107,184,0.28)'}
            activeBackgroundColor={languageOnDarkSurface ? '#7568CF' : '#6B5CC4'}
            activeLabelColor="#FFFFFF"
            inactiveLabelColor={languageOnDarkSurface ? '#E9E5FF' : 'rgba(55,48,107,0.72)'}
        />
    );

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

            {/* Left: Te/En first, then nav controls — keeps language one-thumb reachable. */}
            <View style={[styles.sideRegion, styles.leftRegion]}>
                {langSwitch}
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

            {/* Center: page title when present; otherwise a compact school brand. */}
            <View style={styles.centerRegion} pointerEvents="none">
                {title ? (
                    <Animated.Text style={[styles.headerTitle, fontColorStyle, titleStyleOverride]} numberOfLines={1}>
                        {title}
                    </Animated.Text>
                ) : (
                    <Animated.View style={[styles.brandPill, brandPillStyle]}>
                        <View style={styles.brandLogoWrap}>
                            <Image source={SCHOOL_CONFIG.logo} style={styles.brandLogo} />
                        </View>
                        <View style={styles.brandCopy}>
                            <Animated.Text style={[styles.brandName, fontColorStyle]} numberOfLines={1}>
                                {SCHOOL_BRAND}
                            </Animated.Text>
                            <Animated.Text style={[styles.brandTag, brandSubStyle]} numberOfLines={1}>
                                {SCHOOL_CONFIG.tagline}
                            </Animated.Text>
                        </View>
                    </Animated.View>
                )}
            </View>

            <View style={[styles.sideRegion, styles.rightRegion]}>
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
    sideRegion: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 88,
    },
    leftRegion: {
        justifyContent: 'flex-start',
        flexShrink: 0,
    },
    rightRegion: {
        justifyContent: 'flex-end',
        flexShrink: 0,
    },
    centerRegion: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    brandPill: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: '100%',
        gap: 8,
        paddingVertical: 4,
        paddingLeft: 4,
        paddingRight: 12,
        borderRadius: 999,
        borderWidth: 1,
        overflow: 'hidden',
    },
    brandLogoWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: schoolColorWithAlpha(GOLD, 0.45),
    },
    brandLogo: {
        width: 18,
        height: 18,
        resizeMode: 'contain',
    },
    brandCopy: {
        flexShrink: 1,
        minWidth: 0,
        gap: 1,
    },
    brandName: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    brandTag: {
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.2,
        opacity: 0.95,
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
