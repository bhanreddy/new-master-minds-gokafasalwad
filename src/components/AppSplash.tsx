/**
 * AppSplash.tsx
 * Custom animated splash screen overlay that shows LogoLoader,
 * then fades out and calls onFinish.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import LogoLoader from './LogoLoader';

interface AppSplashProps {
    onFinish: () => void;
}

const SPLASH_BG = '#E6F4FE';

export default function AppSplash({ onFinish }: AppSplashProps) {
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                // Ignore the `finished` boolean because on Android emulators 
                // with animations disabled, this can unexpectedly block completion.
                onFinish();
            });
        }, 1500);

        // Fallback: forcefully finish if animations hang
        const safetyTimer = setTimeout(() => onFinish(), 2500);

        return () => {
             clearTimeout(timer);
             clearTimeout(safetyTimer);
        };
    }, []);

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <LogoLoader size={80} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        backgroundColor: SPLASH_BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
});