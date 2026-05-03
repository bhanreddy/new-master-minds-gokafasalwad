import React, { useMemo } from 'react';
import { Text, StyleSheet, StyleProp, ViewStyle, TextStyle, Pressable, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { HapticFeedback, SPRING_BOUNCE } from '../utils/animations';
import { useTheme } from '../hooks/useTheme';

interface CustomButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'danger';
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CustomButton: React.FC<CustomButtonProps> = ({ title, onPress, variant = 'primary', style, textStyle, disabled }) => {
    const { theme } = useTheme();
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.96, SPRING_BOUNCE);
        opacity.value = withSpring(0.9, SPRING_BOUNCE);
        HapticFeedback.light();
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, SPRING_BOUNCE);
        opacity.value = withSpring(1, SPRING_BOUNCE);
    };

    const backgroundColor = variant === 'danger' ? theme.colors.danger : theme.colors.primary;

    const styles = useMemo(() => StyleSheet.create({
        button: {
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.xl,
            borderRadius: theme.shape.borderRadiusSM,
            alignItems: 'center',
            justifyContent: 'center',
        },
        text: {
            color: theme.colors.surface,
            fontWeight: 'bold',
            fontSize: theme.typography.fontSizeLG,
        },
    }), [theme]);

    return (
        <AnimatedPressable
            style={[styles.button, { backgroundColor }, style, animatedStyle, disabled && { opacity: 0.6 }, Platform.OS === 'web' && { cursor: disabled ? 'not-allowed' : 'pointer' }]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
        >
            <Text style={[styles.text, textStyle]}>{title}</Text>
        </AnimatedPressable>
    );
};

export default CustomButton;
