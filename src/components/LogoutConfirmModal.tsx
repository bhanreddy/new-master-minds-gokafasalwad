import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    Platform,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    Extrapolation,
    runOnJS,
} from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../hooks/useTheme';

interface Props {
    visible: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

const LogoutConfirmModal: React.FC<Props> = ({
    visible,
    onCancel,
    onConfirm,
}) => {
    const { theme } = useTheme();
    const [isMounted, setIsMounted] = useState(visible);
    const progress = useSharedValue(0);

    const closeAnimations = useCallback((callback?: () => void) => {
        progress.value = withTiming(0, { duration: 250 }, (finished) => {
            if (finished) {
                runOnJS(setIsMounted)(false);
                if (callback) runOnJS(callback)();
            }
        });
    }, [progress]);

    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            progress.value = withSpring(1, { damping: 15, stiffness: 200, mass: 0.8 });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (isMounted) {
            closeAnimations();
        }
    }, [visible]);

    const handleCancel = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        closeAnimations(onCancel);
    };

    const handleConfirm = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        closeAnimations(onConfirm);
    };

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    }));

    const modalStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: interpolate(progress.value, [0, 1], [200, 0], Extrapolation.CLAMP) },
            { scale: interpolate(progress.value, [0, 1], [0.95, 1], Extrapolation.CLAMP) }
        ],
        opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.5, 1], Extrapolation.CLAMP),
    }));

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        overlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.4)',
        },
        box: {
            width: '85%',
            backgroundColor: theme.colors.surface,
            borderRadius: theme.shape.borderRadiusXL,
            paddingVertical: theme.spacing.xxl - 4,
            paddingHorizontal: theme.spacing.xl,
            alignItems: 'center',
            ...theme.shadows.lg,
        },
        title: {
            fontSize: theme.typography.fontSizeXL - 2,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: theme.spacing.xxl - 4,
            color: theme.colors.textStrong,
        },
        buttonRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
            paddingHorizontal: theme.spacing.sm + 2,
            gap: theme.spacing.lg,
        },
        button: {
            flex: 1,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.shape.borderRadiusMD,
            alignItems: 'center',
            justifyContent: 'center',
        },
        noButton: {
            backgroundColor: theme.colors.borderLight,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        yesButton: {
            backgroundColor: '#FEE2E2',
            borderWidth: 1,
            borderColor: '#FECACA',
        },
        noText: {
            fontSize: theme.typography.fontSizeMD,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        yesText: {
            fontSize: theme.typography.fontSizeMD,
            fontWeight: '600',
            color: theme.colors.danger,
        },
    }), [theme]);

    if (!isMounted) return null;

    return (
        <Modal
            transparent
            visible={isMounted}
            animationType="none"
            onRequestClose={handleCancel}
        >
            <View style={styles.container}>
                <Pressable onPress={handleCancel} style={StyleSheet.absoluteFill}>
                    <Animated.View style={[styles.overlay, backdropStyle]} />
                </Pressable>

                <Animated.View style={[styles.box, modalStyle]}>
                    <Text style={styles.title}>
                        Do You Really Want to Log Out?
                    </Text>

                    <View style={styles.buttonRow}>
                        <Pressable
                            style={[styles.button, styles.noButton, Platform.OS === 'web' && { cursor: 'pointer' }]}
                            onPress={handleCancel}
                        >
                            <Text style={styles.noText}>NO</Text>
                        </Pressable>

                        <Pressable
                            style={[styles.button, styles.yesButton, Platform.OS === 'web' && { cursor: 'pointer' }]}
                            onPress={handleConfirm}
                        >
                            <Text style={styles.yesText}>Yes</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

export default LogoutConfirmModal;
