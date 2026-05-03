/**
 * AppSplash.tsx
 * Custom animated splash screen overlay that shows LogoLoader,
 * then fades out and calls onFinish.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import LogoLoader from './LogoLoader';

interface AppSplashProps {
    onFinish: () => void;
}

const SPLASH_BG = '#E6F4FE';

export default function AppSplash({ onFinish }: AppSplashProps) {
    const opacity = useRef(new Animated.Value(1)).current;
    const [finished, setFinished] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                // Ignore the `finished` boolean because on Android emulators 
                // with animations disabled, this can unexpectedly block completion.
                // Drop out of the tree immediately so the full-screen z-index layer
                // cannot intercept clicks on web while the parent state update batches.
                setFinished(true);
                onFinish();
            });
        }, 1500);

        // Fallback: forcefully finish if animations hang (still remove hit target on web)
        const safetyTimer = setTimeout(() => {
            setFinished(true);
            onFinish();
        }, 2500);

        return () => {
             clearTimeout(timer);
             clearTimeout(safetyTimer);
        };
    }, []);

    if (finished) return null;

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