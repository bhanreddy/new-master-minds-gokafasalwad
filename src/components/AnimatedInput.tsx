import React, { useEffect, useState, useMemo } from 'react';
import { TextInput, TextInputProps, StyleSheet, View, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring } from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../hooks/useTheme';

interface AnimatedInputProps extends TextInputProps {
    icon?: (props: { color: string }) => React.ReactNode;
    rightAccessory?: React.ReactNode;
    error?: boolean;
    accentColor?: string;
}

const AnimatedInput: React.FC<AnimatedInputProps> = ({ icon, rightAccessory, error, accentColor, onFocus, onBlur, style, ...rest }) => {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const shakeOffset = useSharedValue(0);

    const effectiveAccentColor = accentColor || theme.colors.primary;

    useEffect(() => {
        if (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            shakeOffset.value = withSequence(
                withTiming(-10, { duration: 50 }),
                withSpring(0, { damping: 3, stiffness: 500 })
            );
        }
    }, [error]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: shakeOffset.value }],
            borderColor: error ? theme.colors.danger : (isFocused ? effectiveAccentColor : theme.colors.border),
            borderWidth: isFocused ? 2 : 1,
            backgroundColor: theme.colors.surface,
            shadowColor: isFocused ? effectiveAccentColor : 'transparent',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isFocused ? 0.15 : 0,
            shadowRadius: 12,
            elevation: isFocused ? 4 : 0,
        };
    });

    const handleFocus = (e: any) => {
        setIsFocused(true);
        if (onFocus) onFocus(e);
    };

    const handleBlur = (e: any) => {
        setIsFocused(false);
        if (onBlur) onBlur(e);
    };

    const iconColor = error ? theme.colors.danger : (isFocused ? effectiveAccentColor : theme.colors.textMuted);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: theme.shape.borderRadiusLG,
            height: 60,
            paddingHorizontal: theme.spacing.xl,
            ...Platform.select({
                web: {
                    outlineWidth: 0,
                    outlineStyle: 'none',
                    width: '100%',
                    maxWidth: 480,
                    boxSizing: 'border-box',
                } as any,
                default: {},
            }),
        },
        input: {
            flex: 1,
            fontSize: theme.typography.fontSizeLG - 1,
            fontWeight: '600',
            color: theme.colors.textStrong,
            height: 52,
            paddingVertical: Platform.select({ web: 14, default: undefined }),
            ...Platform.select({
                web: {
                    outlineWidth: 0,
                    outlineStyle: 'none',
                } as any,
                default: {},
            }),
        },
        rightAccessory: {
            marginLeft: theme.spacing.sm + 2,
        }
    }), [theme]);

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            {icon && icon({ color: iconColor })}
            <TextInput
                style={[styles.input, style]}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholderTextColor={theme.colors.textMuted}
                autoComplete="off"
                // @ts-ignore — importantForAutofill is Android-only but safe to pass
                importantForAutofill="no"
                {...rest}
            />
            {rightAccessory && <View style={styles.rightAccessory}>{rightAccessory}</View>}
        </Animated.View>
    );
};

export default AnimatedInput;
