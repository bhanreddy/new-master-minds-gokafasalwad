import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Switch } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from '../utils/haptics';
import { isTelugu as isTeluguCheck } from '../utils/lang';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolateColor, interpolate, useAnimatedStyle, Extrapolation, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import MenuOverlay from './MenuOverlay';
import { Shadows, Radii, Spacing } from '../theme/themes';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCHOOL_NAME } from '../constants/school';

interface StudentHeaderProps {
    onMenuPress?: () => void;
    scrollY?: SharedValue<number>;
    menuUserType?: 'student' | 'staff' | 'driver';
}

const isWeb = Platform.OS === 'web';

const StudentHeader: React.FC<StudentHeaderProps & { showBackButton?: boolean, title?: string, showSettingsButton?: boolean }> = ({ onMenuPress, showBackButton = false, title, showSettingsButton = true, scrollY, menuUserType = 'student' }) => {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const { t, i18n } = useTranslation();
    const [isTeluguLang, setIsTeluguLang] = useState(isTeluguCheck(i18n.language));
    const [menuVisible, setMenuVisible] = useState(false);
    const insets = useSafeAreaInsets();

    React.useEffect(() => {
        setIsTeluguLang(isTeluguCheck(i18n.language));
    }, [i18n.language]);

    const toggleLanguage = async () => {
        const newLang = isTeluguLang ? 'en' : 'te';
        setIsTeluguLang(!isTeluguLang);
        i18n.changeLanguage(newLang);
        await AsyncStorage.setItem('appLanguage', newLang);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleMenuPress = () => {
        if (onMenuPress) {
            onMenuPress();
        } else {
            setMenuVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleTabPress = (tabName: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (tabName === 'Diary') {
            router.push('/Screen/diary' as any);
        } else if (tabName === 'LMS') {
            router.push('/Screen/lms' as any);
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
            return isDark
                ? { backgroundColor: 'transparent', borderBottomColor: 'transparent', shadowOpacity: 0 }
                : { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0', shadowOpacity: 0.1 };
        }

        const bgEnd = isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.95)';
        const borderEnd = isDark ? 'rgba(51,65,85,0.95)' : 'rgba(226,232,240,1)';
        const bgColor = interpolateColor(
            scrollY.value,
            [0, 50],
            ['rgba(255,255,255,0)', bgEnd]
        );
        const borderColor = interpolateColor(
            scrollY.value,
            [0, 50],
            [isDark ? 'rgba(51,65,85,0)' : 'rgba(226,232,240,0)', borderEnd]
        );
        const shadowOpacity = interpolate(
            scrollY.value,
            [0, 50],
            [0, 0.1],
            Extrapolation.CLAMP
        );

        return {
            backgroundColor: bgColor,
            borderBottomColor: borderColor,
            shadowOpacity,
        };
    }, [isDark]);

    const isAbsolute = !!scrollY;
    const showNavBack = showBackButton || isWeb;
    const showNavMenu = !showBackButton || isWeb;

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

    const iconColorStyle = useAnimatedStyle(() => {
        if (!scrollY) return { backgroundColor: 'rgba(255,255,255,0.1)' };
        const endBg = isDark ? 'rgba(30,41,59,0.95)' : '#F8FAFC';
        return {
            backgroundColor: interpolateColor(
                scrollY.value,
                [0, 50],
                ['rgba(255,255,255,0.1)', endBg]
            )
        };
    }, [isDark]);

    return (
        <Animated.View style={[
            styles.container,
            { paddingTop: Math.max(insets.top, 36) }, // Guarantee enough space for status bar
            isAbsolute && styles.absoluteHeader,
            animatedStyle
        ]}>
            {!scrollY && (
                <LinearGradient
                    colors={['#05050A', '#13132B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            )}

            {/* Left: native = menu on home, back on subpages; web = both */}
            <View style={[styles.leftNav, showNavBack && showNavMenu && styles.leftNavDual]}>
                {showNavBack ? (
                    <Pressable onPress={handleBack} style={Platform.OS === 'web' && { cursor: 'pointer' }}>
                        <Animated.View style={[styles.iconButton, iconColorStyle]}>
                            <Animated.Text style={fontColorStyle}>
                                <Ionicons name="arrow-back" size={22} color="inherit" />
                            </Animated.Text>
                        </Animated.View>
                    </Pressable>
                ) : null}
                {showNavMenu ? (
                    <Pressable onPress={handleMenuPress} style={Platform.OS === 'web' && { cursor: 'pointer' }}>
                        <Animated.View style={[styles.iconButton, iconColorStyle]}>
                            <Animated.Text style={fontColorStyle}>
                                <Ionicons name="menu" size={22} color="inherit" />
                            </Animated.Text>
                        </Animated.View>
                    </Pressable>
                ) : null}
            </View>

            {/* Center: title (sub-pages) OR school name + Diary/LMS (home). Single flex:1 region avoids overlap with rightActions. */}
            <View style={styles.centerRegion}>
                {title ? (
                    <Animated.Text style={[styles.headerTitle, fontColorStyle]} numberOfLines={1}>
                        {title}
                    </Animated.Text>
                ) : !showBackButton ? (
                    <View style={styles.homeTitleRow}>
                        <Animated.Text style={[styles.headerTitle, styles.headerTitleHome, fontColorStyle]} numberOfLines={1}>
                            {t('schoolRibbon.brandName', { defaultValue: SCHOOL_NAME })}
                        </Animated.Text>
                        <View style={styles.tabsContainer}>
                            <Pressable
                                onPress={() => handleTabPress('Diary')}
                                style={Platform.OS === 'web' && { cursor: 'pointer' }}
                            >
                                <Animated.View style={[styles.tabButton, iconColorStyle]}>
                                    <View style={[styles.tabIconBox, { backgroundColor: 'rgba(3,105,161,0.1)' }]}>
                                        <Ionicons name="book" size={12} color="#0284C7" />
                                    </View>
                                    <Animated.Text style={[styles.tabText, fontColorStyle]}>{t('diary', 'Diary')}</Animated.Text>
                                </Animated.View>
                            </Pressable>

                            <Pressable
                                onPress={() => handleTabPress('LMS')}
                                style={Platform.OS === 'web' && { cursor: 'pointer' }}
                            >
                                <Animated.View style={[styles.tabButton, iconColorStyle]}>
                                    <View style={[styles.tabIconBox, { backgroundColor: 'rgba(22,163,74,0.1)' }]}>
                                        <MaterialIcons name="computer" size={12} color="#16A34A" />
                                    </View>
                                    <Animated.Text style={[styles.tabText, fontColorStyle]}>{t('lMS', 'LMS')}</Animated.Text>
                                </Animated.View>
                            </Pressable>
                        </View>
                    </View>
                ) : null}
            </View>

            <View style={styles.rightActions}>
                {/* Language Switch (Native Toggle) */}
                <View style={styles.langSwitch}>
                    <Text style={[styles.langLabel, !isTeluguLang && styles.langLabelActive]}>En</Text>
                    <Switch
                        value={isTeluguLang}
                        onValueChange={toggleLanguage}
                        trackColor={{ false: 'rgba(255,255,255,0.25)', true: 'rgba(255,255,255,0.25)' }}
                        thumbColor={isTeluguLang ? '#FFFFFF' : '#FFFFFF'}
                        ios_backgroundColor="rgba(255,255,255,0.15)"
                        style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                    />
                    <Text style={[styles.langLabel, isTeluguLang && styles.langLabelActive]}>Te</Text>
                </View>

                {/* Settings Button */}
                {showSettingsButton && (
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/Screen/settings' as any);
                        }}
                        style={[{ padding: 4 }, Platform.OS === 'web' && { cursor: 'pointer' }]}
                    >
                        <Animated.Text style={fontColorStyle}>
                            <Ionicons name="settings-outline" size={20} color="inherit" />
                        </Animated.Text>
                    </Pressable>
                )}
            </View>

            <MenuOverlay visible={menuVisible} onClose={() => setMenuVisible(false)} userType={menuUserType} />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm + 4, // Added more bottom padding
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'transparent',
        ...Shadows.sm,
    },
    leftNav: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    leftNavDual: {
        gap: 6,
    },
    iconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: Radii.sm,
        backgroundColor: '#F8FAFC',
    },
    centerRegion: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    homeTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minWidth: 0,
        maxWidth: '100%',
    },
    tabsContainer: {
        flexDirection: 'row',
        flexShrink: 0,
        gap: Spacing.xs,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.xs + 2,
        paddingVertical: 4,
        borderRadius: Radii.sm,
        backgroundColor: 'transparent',
        gap: 6,
    },
    tabIconBox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
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
        gap: 2,
    },
    langLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 0.3,
    },
    langLabelActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    headerTitleHome: {
        flexShrink: 1,
        marginLeft: 0,
        textAlign: 'center',
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
