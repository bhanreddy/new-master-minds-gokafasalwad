import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../hooks/useTheme';

interface PremiumCardProps {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    colors: [string, string, ...string[]];
    onPress: () => void;
    index?: number;
}

const SPRING_CONFIG = { damping: 18, stiffness: 180, mass: 0.7 };

const PremiumCard = ({ title, icon, colors, onPress, index = 0 }: PremiumCardProps) => {
    const { theme } = useTheme();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.97, SPRING_CONFIG);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, SPRING_CONFIG);
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    const styles = useMemo(() => StyleSheet.create({
        container: {
            width: '50%',
            padding: theme.spacing.xs + 2,
        },
        cardWrapper: {
            flex: 1,
            borderRadius: theme.shape.borderRadiusXL,
            backgroundColor: theme.colors.surface,
            ...theme.shadows.md,
        },
        gradient: {
            flex: 1,
            borderRadius: theme.shape.borderRadiusXL,
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.sm + 2,
            height: 112,
            justifyContent: 'space-between',
            overflow: 'hidden',
        },
        iconContainer: {
            width: 44,
            height: 44,
            borderRadius: theme.shape.borderRadiusMD,
            backgroundColor: theme.colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            ...theme.shadows.sm,
        },
        title: {
            fontSize: theme.typography.fontSizeXS,
            fontWeight: '600',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: theme.colors.textStrong,
            lineHeight: 19,
        },
    }), [theme]);

    return (
        <Animated.View
            entering={FadeInUp.delay(60 + index * 50).duration(450).springify()}
            style={styles.container}
        >
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={{ flex: 1 }}
            >
                <Animated.View style={[styles.cardWrapper, animatedStyle]}>
                    <LinearGradient
                        colors={colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.7, y: 1 }}
                        style={styles.gradient}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name={icon} size={26} color={theme.colors.textStrong} />
                        </View>

                        <Text style={styles.title} numberOfLines={2}>
                            {title}
                        </Text>
                    </LinearGradient>
                </Animated.View>
            </Pressable>
        </Animated.View>
    );
};

export default PremiumCard;
