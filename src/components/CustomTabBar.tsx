import React, { useEffect, useMemo } from 'react';
import { View, Pressable, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../hooks/useTheme';

const { width } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TabItem {
    id: string;
    icon: any;
    route: string;
    isMain?: boolean;
}

const DEFAULT_TABS: TabItem[] = [
    {
        id: 'home',
        icon: (props: any) => <Ionicons name="home" size={24} {...props} />,
        route: '/staff/dashboard',
    },
];

interface CustomTabBarProps {
    tabs?: TabItem[];
}

const TabBarItem = ({ tab, isActive, onPress }: { tab: TabItem, isActive: boolean, onPress: () => void }) => {
    const { theme } = useTheme();
    const scale = useSharedValue(isActive ? 1.15 : 1);
    const dotScale = useSharedValue(isActive ? 1 : 0);

    useEffect(() => {
        scale.value = withSpring(isActive ? 1.15 : 1, { damping: 12, stiffness: 200 });
        dotScale.value = withSpring(isActive ? 1 : 0, { damping: 12, stiffness: 200 });
    }, [isActive]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSpring(0.9, { damping: 15 }, () => {
            scale.value = withSpring(isActive ? 1.15 : 1, { damping: 12, stiffness: 200 });
        });
        onPress();
    }

    const animIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const animDotStyle = useAnimatedStyle(() => ({
        transform: [{ scale: dotScale.value }],
        opacity: dotScale.value,
    }));

    const IconComponent = tab.icon;

    return (
        <Pressable
            style={[{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' }, Platform.OS === 'web' && { cursor: 'pointer' }]}
            onPress={handlePress}
        >
            <Animated.View style={animIconStyle}>
                <IconComponent color={isActive ? theme.colors.secondary : theme.colors.navIconInactive} />
            </Animated.View>
            <Animated.View style={[{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.colors.secondary, position: 'absolute', bottom: 8 }, animDotStyle]} />
        </Pressable>
    );
};

export const CustomTabBar: React.FC<CustomTabBarProps> = ({ tabs = DEFAULT_TABS }) => {
    const { theme } = useTheme();
    const router = useRouter();
    const pathname = usePathname();

    const handlePress = (route: string) => {
        if (route) {
            router.push(route as any);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: {
            position: 'absolute',
            bottom: theme.spacing.xl,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 100,
        },
        bar: {
            flexDirection: 'row',
            backgroundColor: theme.colors.surface,
            width: width * 0.9,
            height: 60,
            borderRadius: theme.shape.borderRadiusFull,
            justifyContent: 'space-around',
            alignItems: 'center',
            ...theme.shadows.md,
            paddingHorizontal: theme.spacing.lg,
        },
    }), [theme]);

    return (
        <View style={styles.container}>
            <View style={styles.bar}>
                {tabs.map((tab) => {
                    const isActive = pathname === tab.route || pathname.startsWith(tab.route + '/');
                    return (
                        <TabBarItem
                            key={tab.id}
                            tab={tab}
                            isActive={isActive}
                            onPress={() => handlePress(tab.route)}
                        />
                    );
                })}
            </View>
        </View>
    );
};
