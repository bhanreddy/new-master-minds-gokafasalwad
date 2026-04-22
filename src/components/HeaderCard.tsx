import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { SCHOOL_CONFIG } from '../constants/schoolConfig';
import { useTheme } from '../hooks/useTheme';

interface HeaderCardProps {
    studentName: string;
    classSec: string;
    rollNo: string;
}

const { width } = Dimensions.get('window');

const HeaderCard: React.FC<HeaderCardProps> = ({
    studentName,
    classSec,
    rollNo,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const shimmerX = useSharedValue(-width);
    const pulse = useSharedValue(1);

    useEffect(() => {
        shimmerX.value = withRepeat(
            withTiming(width * 1.5, {
                duration: 3000,
                easing: Easing.linear,
            }),
            -1,
            false
        );

        pulse.value = withRepeat(
            withTiming(1.5, {
                duration: 1500,
                easing: Easing.out(Easing.ease),
            }),
            -1,
            true
        );
    }, []);


    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: 0.22,
    }));

    const styles = useMemo(() => StyleSheet.create({
        wrapper: {
            marginHorizontal: theme.spacing.xl,
            marginTop: theme.spacing.xl,
        },
        card: {
            padding: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
            backgroundColor: 'transparent',
        },
        glassOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            borderTopLeftRadius: theme.shape.borderRadiusXL + 4,
            borderTopRightRadius: theme.shape.borderRadiusXL + 4,
        },
        shimmer: {
            ...StyleSheet.absoluteFillObject,
            transform: [{ skewX: '-18deg' }],
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
            borderColor: 'rgba(255,255,255,0.1)'
        },
        avatar: {
            width: '100%',
            height: '100%',
            borderRadius: theme.shape.borderRadiusXL - 2,
            backgroundColor: '#1E1042',
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
        divider: {
            width: 1,
            height: 14,
            backgroundColor: 'rgba(255,255,255,0.25)',
            marginHorizontal: 11,
        },
    }), [theme]);

    return (
        <Animated.View
            entering={FadeInDown.duration(700).springify()}
            style={styles.wrapper}
        >
            <View style={styles.card}>
                <View style={[styles.schoolBadge, { marginTop: theme.spacing.lg }]}>
                    <View style={styles.logoContainer}>
                        <Image source={SCHOOL_CONFIG.logo} style={styles.schoolLogo} />
                    </View>
                    <Text style={styles.schoolName} numberOfLines={1}>
                        {t('schoolRibbon.brandName', { defaultValue: SCHOOL_CONFIG.name })}
                    </Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatarGlow} />
                        <View style={styles.avatarBorder}>
                            <Image
                                source={{
                                    uri: 'https://cdn-icons-png.flaticon.com/512/4333/4333609.png',
                                }}
                                style={styles.avatar}
                            />
                        </View>

                        <View style={styles.status}>
                            <Animated.View style={[styles.statusPulse, pulseStyle]} />
                            <View style={styles.statusDot} />
                        </View>
                    </View>

                    <View style={styles.info}>
                        <Text style={styles.studentName} numberOfLines={1}>
                            {studentName?.replace(/\s+/g, ' ')}
                        </Text>

                        <View style={styles.metaRow}>
                            <View style={styles.metaPill}>
                                <Ionicons name="layers" size={13} color="#67E8F9" />
                                <Text style={styles.metaText}>{classSec}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.metaPill}>
                                <Ionicons name="id-card" size={13} color="#67E8F9" />
                                <Text style={styles.metaText}>{t('rollValue', { value: rollNo }) || `Roll ${rollNo}`}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

export default HeaderCard;
