import React, { useMemo } from 'react';
import { Text, StyleSheet, Image, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { HapticFeedback, SPRING_BOUNCE } from '../utils/animations';
import { useTheme } from '../hooks/useTheme';

interface GridItemProps {
    title: string;
    icon: any;
    onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const GridItem: React.FC<GridItemProps> = ({ title, icon, onPress }) => {
    const { theme } = useTheme();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.95, SPRING_BOUNCE);
        HapticFeedback.light();
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, SPRING_BOUNCE);
    };

    const styles = useMemo(() => StyleSheet.create({
        item: {
            width: '45%',
            backgroundColor: theme.colors.surface,
            padding: theme.spacing.lg,
            borderRadius: theme.shape.borderRadiusMD,
            marginVertical: theme.spacing.sm + 2,
            alignItems: 'center',
            elevation: 2,
        },
        icon: {
            width: 40,
            height: 40,
            marginBottom: theme.spacing.sm + 2,
            resizeMode: 'contain',
        },
        title: {
            fontSize: theme.typography.fontSizeSM + 1,
            fontWeight: 'bold',
            textAlign: 'center',
            color: theme.colors.textPrimary,
        },
    }), [theme]);

    return (
        <AnimatedPressable
            style={[styles.item, animatedStyle]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Image source={icon} style={styles.icon} />
            <Text style={styles.title}>{title}</Text>
        </AnimatedPressable>
    );
};

export default GridItem;
