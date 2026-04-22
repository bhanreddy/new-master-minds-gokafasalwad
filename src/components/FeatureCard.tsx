import React, { useMemo } from 'react';
import { Pressable, View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from 'phosphor-react-native/src/icons/User';
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle';
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { Bed } from 'phosphor-react-native/src/icons/Bed';
import { Bus } from 'phosphor-react-native/src/icons/Bus';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { Flask } from 'phosphor-react-native/src/icons/Flask';
import { FileText } from 'phosphor-react-native/src/icons/FileText';
import { IconProps } from 'phosphor-react-native';
import { HapticFeedback } from '../utils/animations';
import { useTheme } from '../hooks/useTheme';

const { width } = Dimensions.get('window');
const padding = 20;
const gap = 16;
const CARD_WIDTH = (width - (padding * 2) - gap) / 2;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IconMap = {
    User,
    WarningCircle,
    ChatCircleDots,
    Bed,
    Bus,
    Heart,
    Flask,
    FileText,
};

export type IconName = keyof typeof IconMap;

interface FeatureCardProps {
    title: string;
    icon: IconName;
    colors: [string, string, ...string[]];
    badgeCount?: number;
    isPrimary?: boolean;
    priority?: 'high' | 'medium' | 'low'; // Added priority level
    onPress: () => void;
}

export default function FeatureCard({ title, icon, colors, badgeCount, priority = 'medium', isPrimary, onPress }: FeatureCardProps) {
    const { theme } = useTheme();
    const scale = useSharedValue(1);
    const shadowOp = useSharedValue(0.05);
    const shadowY = useSharedValue(6);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            shadowOpacity: shadowOp.value,
            shadowOffset: { width: 0, height: shadowY.value },
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
        shadowOp.value = withSpring(0.02, { damping: 15, stiffness: 300 });
        shadowY.value = withSpring(2, { damping: 15, stiffness: 300 });
        HapticFeedback.light();
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        shadowOp.value = withSpring(0.08, { damping: 15, stiffness: 200 });
        shadowY.value = withSpring(6, { damping: 15, stiffness: 200 });
    };

    const IconComponent = IconMap[icon] as React.ElementType<IconProps>;

    const styles = useMemo(() => StyleSheet.create({
        container: {
            width: CARD_WIDTH,
            height: 72,
            borderRadius: theme.shape.borderRadiusXL,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.8)',
            ...theme.shadows.md,
            overflow: 'hidden',
        },
        cardInner: {
            flex: 1,
            flexDirection: 'row',
            padding: theme.spacing.sm + 2,
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: theme.spacing.sm + 2,
            zIndex: 1,
            backgroundColor: 'transparent',
        },
        iconBoxShadowWrap: {
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 3,
            borderRadius: theme.shape.borderRadiusLG,
        },
        iconBox: {
            width: 48,
            height: 48,
            borderRadius: theme.shape.borderRadiusLG,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.3)',
            overflow: 'hidden',
        },
        glassHighlight: {
            position: 'absolute',
            top: 0, left: 0, right: 0, height: 32,
            backgroundColor: 'rgba(255,255,255,0.15)',
        },
        badge: {
            position: 'absolute',
            top: -6,
            right: -6,
            backgroundColor: theme.colors.danger,
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.xs,
            borderWidth: 2,
            borderColor: theme.colors.surface,
        },
        badgeText: {
            color: theme.colors.surface,
            fontSize: 10,
            fontWeight: '800',
        },
        textContainer: {
            flex: 1,
            justifyContent: 'center',
            paddingRight: theme.spacing.sm,
            overflow: 'hidden',
        },
        title: {
            fontSize: theme.typography.fontSizeXS + 1,
            lineHeight: 16,
            fontWeight: '600',
            color: theme.colors.textPrimary,
            letterSpacing: -0.2,
            flexShrink: 1,
        },
        titlePrimary: {
            fontSize: theme.typography.fontSizeSM,
            lineHeight: 16,
            fontWeight: '800',
            color: theme.colors.textStrong,
            letterSpacing: -0.2,
        },
    }), [theme]);

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[styles.container, animatedStyle, Platform.OS === 'web' && { cursor: 'pointer' }]}
        >
            <LinearGradient
                colors={[colors[0] + '33', colors[1] + '1A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            <View style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: colors[0], opacity: 0.05 }
            ]} />

            <View style={styles.cardInner}>
                <View style={[styles.iconBoxShadowWrap, { shadowColor: colors[0] }]}>
                    <LinearGradient
                        colors={colors as [string, string, ...string[]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.iconBox,
                            priority === 'high' && { borderColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1.5 },
                            priority === 'low' && { opacity: 0.85 }
                        ]}
                    >
                        <View style={[
                            styles.glassHighlight,
                            priority === 'high' && { backgroundColor: 'rgba(255,255,255,0.25)' }
                        ]} />
                        {IconComponent && <IconComponent size={24} color={theme.colors.surface} weight="fill" />}
                        {!!badgeCount && badgeCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                            </View>
                        )}
                    </LinearGradient>
                </View>
                <View style={styles.textContainer}>
                    <Text
                        style={[
                            styles.title,
                            isPrimary && styles.titlePrimary,
                            priority === 'low' && { color: theme.colors.textSecondary }
                        ]}
                    >
                        {title}
                    </Text>
                </View>
            </View>
        </AnimatedPressable>
    );
}
