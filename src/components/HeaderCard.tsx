import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
    withSequence,
    Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { SCHOOL_CONFIG } from '../constants/schoolConfig';
import { useTheme } from '../hooks/useTheme';
import { useQuickAccountSwitch } from '../hooks/useQuickAccountSwitch';
import QuickAccountPickerSheet from './QuickAccountPickerSheet';
import * as Haptics from '../utils/haptics';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/4333/4333609.png';
const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 480;

interface HeaderCardProps {
    studentName: string;
    classSec: string;
    rollNo: string;
    photoUrl?: string | null;
    onAccountSwitched?: () => void | Promise<void>;
}

const { width } = Dimensions.get('window');

const HeaderCard: React.FC<HeaderCardProps> = ({
    studentName,
    classSec,
    rollNo,
    photoUrl,
    onAccountSwitched,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const pulse = useSharedValue(1);
    const cardScale = useSharedValue(1);
    const avatarScale = useSharedValue(1);
    const contentOpacity = useSharedValue(1);
    const hintOpacity = useSharedValue(0.72);
    const lastTapRef = useRef(0);
    const longPressTriggeredRef = useRef(false);
    const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

    const {
        accounts,
        activeId,
        sheetOpen,
        switching,
        switchToNext,
        switchTo,
        openSheet,
        closeSheet,
    } = useQuickAccountSwitch(onAccountSwitched);

    useEffect(() => {
        pulse.value = withRepeat(
            withTiming(1.5, {
                duration: 1500,
                easing: Easing.out(Easing.ease),
            }),
            -1,
            true
        );
        hintOpacity.value = withRepeat(
            withSequence(
                withTiming(0.95, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.55, { duration: 1800, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
        );
    }, [hintOpacity, pulse]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: 0.22,
    }));

    const cardAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
    }));

    const avatarAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: avatarScale.value }],
    }));

    const contentAnimStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
    }));

    const hintAnimStyle = useAnimatedStyle(() => ({
        opacity: hintOpacity.value,
    }));

    const playSwitchAnimation = useCallback(() => {
        avatarScale.value = withSequence(
            withSpring(0.88, { damping: 14, stiffness: 280 }),
            withSpring(1.06, { damping: 10, stiffness: 220 }),
            withSpring(1, { damping: 14, stiffness: 180 })
        );
        contentOpacity.value = withSequence(
            withTiming(0.55, { duration: 90 }),
            withTiming(1, { duration: 220 })
        );
    }, [avatarScale, contentOpacity]);

    const handleAvatarPress = useCallback(() => {
        if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
        }
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0;
            avatarScale.value = withSequence(
                withSpring(0.92, { damping: 16, stiffness: 400 }),
                withSpring(1, { damping: 12, stiffness: 260 })
            );
            void (async () => {
                setBusyUserId(activeId);
                const switched = await switchToNext();
                if (switched) playSwitchAnimation();
                setBusyUserId(null);
            })();
        } else {
            lastTapRef.current = now;
        }
    }, [activeId, avatarScale, playSwitchAnimation, switchToNext]);

    const handleCardLongPress = useCallback(() => {
        longPressTriggeredRef.current = true;
        cardScale.value = withSequence(
            withSpring(0.975, { damping: 18, stiffness: 320 }),
            withSpring(1, { damping: 14, stiffness: 200 })
        );
        void openSheet();
    }, [cardScale, openSheet]);

    const handleCardPressIn = useCallback(() => {
        cardScale.value = withSpring(0.985, { damping: 20, stiffness: 400 });
    }, [cardScale]);

    const handleCardPressOut = useCallback(() => {
        cardScale.value = withSpring(1, { damping: 16, stiffness: 260 });
    }, [cardScale]);

    const handleSelectAccount = useCallback(
        async (userId: string) => {
            setBusyUserId(userId);
            const ok = await switchTo(userId);
            if (ok) playSwitchAnimation();
            setBusyUserId(null);
        },
        [playSwitchAnimation, switchTo]
    );

    const avatarUri = photoUrl || FALLBACK_AVATAR;
    const accountCount = accounts.length;

    const styles = useMemo(() => StyleSheet.create({
        wrapper: {
            marginHorizontal: theme.spacing.xl,
            marginTop: theme.spacing.xl,
        },
        cardShell: {
            borderRadius: theme.shape.borderRadiusXL + 6,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 18,
            elevation: 6,
        },
        cardGloss: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '42%',
            borderTopLeftRadius: theme.shape.borderRadiusXL + 6,
            borderTopRightRadius: theme.shape.borderRadiusXL + 6,
        },
        card: {
            padding: theme.spacing.md,
            paddingBottom: theme.spacing.lg + 2,
        },
        schoolBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignSelf: 'flex-start',
            paddingHorizontal: theme.spacing.sm + 2,
            paddingVertical: 5,
            borderRadius: theme.shape.borderRadiusFull,
            marginBottom: theme.spacing.sm,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
        },
        logoContainer: {
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.25)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 2,
        },
        schoolLogo: {
            width: 18,
            height: 18,
            resizeMode: 'contain',
        },
        schoolName: {
            color: theme.colors.surface,
            fontWeight: '700',
            fontSize: theme.typography.fontSizeXS + 1,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            maxWidth: width * 0.5,
        },
        content: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xl + 2,
        },
        avatarWrap: {
            position: 'relative',
        },
        avatarPress: {
            borderRadius: theme.shape.borderRadiusXL + 2,
        },
        avatarGlow: {
            position: 'absolute',
            width: 74,
            height: 74,
            borderRadius: theme.shape.borderRadiusXL + 4,
            backgroundColor: '#06B6D4',
            opacity: 0.15,
            top: -3,
            left: -3,
            shadowColor: '#06B6D4',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 4,
        },
        avatarBorder: {
            width: 68,
            height: 68,
            borderRadius: theme.shape.borderRadiusXL + 2,
            padding: 2,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
        },
        avatar: {
            width: '100%',
            height: '100%',
            borderRadius: theme.shape.borderRadiusXL - 2,
            backgroundColor: '#1E1042',
        },
        switchHint: {
            position: 'absolute',
            top: -7,
            right: -7,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            paddingHorizontal: 5,
            backgroundColor: 'rgba(99,102,241,0.92)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.28)',
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius: 4,
        },
        switchHintCount: {
            color: '#fff',
            fontSize: 9,
            fontWeight: '800',
        },
        status: {
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 18,
            height: 18,
            justifyContent: 'center',
            alignItems: 'center',
        },
        statusPulse: {
            position: 'absolute',
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.colors.success,
        },
        statusDot: {
            width: 13,
            height: 13,
            borderRadius: 7,
            backgroundColor: theme.colors.success,
            borderWidth: 2.5,
            borderColor: '#3B0764',
        },
        info: {
            flex: 1,
        },
        studentName: {
            color: theme.colors.surface,
            fontSize: 26,
            fontWeight: '800',
            letterSpacing: 0.3,
            marginBottom: theme.spacing.xs,
            textShadowColor: 'rgba(0,0,0,0.15)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
        },
        metaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
        },
        metaPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: 'rgba(255,255,255,0.08)',
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.shape.borderRadiusXS,
        },
        metaText: {
            color: 'rgba(255,255,255,0.9)',
            fontWeight: '600',
            fontSize: theme.typography.fontSizeXS + 1,
            letterSpacing: 0.2,
        },
        gestureRow: {
            marginTop: theme.spacing.sm,
        },
        gestureHint: {
            color: 'rgba(255,255,255,0.42)',
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0.15,
        },
    }), [theme]);

    return (
        <>
            <Animated.View
                entering={FadeInDown.duration(700).springify()}
                style={styles.wrapper}
            >
                <Animated.View style={[styles.cardShell, cardAnimStyle]}>
                    <LinearGradient
                        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.cardGloss}
                        pointerEvents="none"
                    />

                    <Pressable
                        style={styles.card}
                        delayLongPress={LONG_PRESS_MS}
                        onLongPress={handleCardLongPress}
                        onPressIn={handleCardPressIn}
                        onPressOut={handleCardPressOut}
                        android_disableSound
                    >
                        <View style={[styles.schoolBadge, { marginTop: theme.spacing.sm }]}>
                            <View style={styles.logoContainer}>
                                <Image source={SCHOOL_CONFIG.logo} style={styles.schoolLogo} />
                            </View>
                            <Text style={styles.schoolName} numberOfLines={1}>
                                {t('schoolRibbon.brandName', { defaultValue: SCHOOL_CONFIG.name })}
                            </Text>
                        </View>

                        <Animated.View style={[styles.content, contentAnimStyle]}>
                            <Pressable
                                onPress={handleAvatarPress}
                                onLongPress={handleCardLongPress}
                                delayLongPress={LONG_PRESS_MS}
                                style={styles.avatarPress}
                                hitSlop={6}
                                android_disableSound
                            >
                                <Animated.View style={[styles.avatarWrap, avatarAnimStyle]}>
                                    <View style={styles.avatarGlow} />
                                    <View style={styles.avatarBorder}>
                                        <Image
                                            source={{ uri: avatarUri }}
                                            style={styles.avatar}
                                        />
                                    </View>

                                    {accountCount > 0 && (
                                        <View style={styles.switchHint}>
                                            <Ionicons name="swap-horizontal" size={10} color="#fff" />
                                            {accountCount > 1 && (
                                                <Text style={styles.switchHintCount}>{accountCount}</Text>
                                            )}
                                        </View>
                                    )}

                                    <View style={styles.status}>
                                        <Animated.View style={[styles.statusPulse, pulseStyle]} />
                                        <View style={styles.statusDot} />
                                    </View>
                                </Animated.View>
                            </Pressable>

                            <View style={styles.info}>
                                <Text style={styles.studentName} numberOfLines={1}>
                                    {studentName?.replace(/\s+/g, ' ')}
                                </Text>

                                <View style={styles.metaRow}>
                                    <View style={styles.metaPill}>
                                        <Ionicons name="layers" size={13} color="#67E8F9" />
                                        <Text style={styles.metaText}>{classSec}</Text>
                                    </View>
                                    <View style={styles.metaPill}>
                                        <Ionicons name="id-card" size={13} color="#67E8F9" />
                                        <Text style={styles.metaText}>{t('rollValue', { value: rollNo }) || `Roll ${rollNo}`}</Text>
                                    </View>
                                </View>

                                {accountCount > 1 && (
                                    <Animated.View style={[styles.gestureRow, hintAnimStyle]}>
                                        <Text style={styles.gestureHint}>
                                            Hold card to switch · double-tap photo to cycle
                                        </Text>
                                    </Animated.View>
                                )}
                            </View>
                        </Animated.View>
                    </Pressable>
                </Animated.View>
            </Animated.View>

            <QuickAccountPickerSheet
                visible={sheetOpen}
                accounts={accounts}
                activeId={activeId}
                switching={switching}
                busyUserId={busyUserId}
                onClose={closeSheet}
                onSelect={handleSelectAccount}
            />
        </>
    );
};

export default HeaderCard;
