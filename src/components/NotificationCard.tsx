import React, { useCallback, useMemo, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Pressable,
    Platform,
    ActionSheetIOS,
    Alert,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    withDelay,
    runOnJS,
    interpolate,
    Extrapolation,
    Easing,
    FadeIn,
    SlideInRight,
    SlideOutLeft,
} from 'react-native-reanimated';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

/* ──────────────────────────────────────────────────────────────────────────
 *  NotificationCard — SchoolIMS Dark Luxury Design System
 *  Maps to 15 user-facing notification types, each backed by one or more
 *  real `event_type` values from SupabaseBackend/services/notificationEventConfig.js
 * ────────────────────────────────────────────────────────────────────────── */

export type NotificationType =
    | 'ATTENDANCE_ABSENT'
    | 'ATTENDANCE_PRESENT'
    | 'DIARY'
    | 'RESULTS'
    | 'COMPLAINT'
    | 'LMS'
    | 'TIMETABLE'
    | 'NOTICE'
    | 'FEE_DUE'
    | 'FEE_PAID'
    | 'LEAVE'
    | 'EXPENSE'
    | 'PAYROLL'
    | 'SAFETY'
    | 'BUS';

interface TypeMeta {
    label: string;
    accent: string;
    bgTint: string;
    iconColor: string;
    badgeColor: string;
    emoji: string;
    iconName: string;
}

export const NOTIFICATION_TYPE_MAP: Record<NotificationType, TypeMeta> = {
    ATTENDANCE_ABSENT: {
        label: 'Attendance',
        accent: '#FF5A6E',
        bgTint: 'rgba(255, 90, 110, 0.10)',
        iconColor: '#FF8A97',
        badgeColor: '#FF5A6E',
        emoji: '🚫',
        iconName: 'user-x',
    },
    ATTENDANCE_PRESENT: {
        label: 'Check-in',
        accent: '#3DDC97',
        bgTint: 'rgba(61, 220, 151, 0.10)',
        iconColor: '#5DE4A8',
        badgeColor: '#2FC283',
        emoji: '✅',
        iconName: 'check-circle-2',
    },
    DIARY: {
        label: 'Diary',
        accent: '#4EA8FF',
        bgTint: 'rgba(78, 168, 255, 0.10)',
        iconColor: '#7CBFFF',
        badgeColor: '#2F8BE8',
        emoji: '📓',
        iconName: 'book-open',
    },
    RESULTS: {
        label: 'Results',
        accent: '#B37BFF',
        bgTint: 'rgba(179, 123, 255, 0.12)',
        iconColor: '#C49CFF',
        badgeColor: '#9D5CFF',
        emoji: '🏆',
        iconName: 'award',
    },
    COMPLAINT: {
        label: 'Complaint',
        accent: '#FF7A45',
        bgTint: 'rgba(255, 122, 69, 0.10)',
        iconColor: '#FF9D75',
        badgeColor: '#E85E26',
        emoji: '⚠️',
        iconName: 'alert-octagon',
    },
    LMS: {
        label: 'Lesson',
        accent: '#FF6FD8',
        bgTint: 'rgba(255, 111, 216, 0.10)',
        iconColor: '#FF95E2',
        badgeColor: '#E04FB8',
        emoji: '📚',
        iconName: 'book-marked',
    },
    TIMETABLE: {
        label: 'Schedule',
        accent: '#4ADCC8',
        bgTint: 'rgba(74, 220, 200, 0.10)',
        iconColor: '#6DE5D4',
        badgeColor: '#2EB8A6',
        emoji: '📅',
        iconName: 'calendar-clock',
    },
    NOTICE: {
        label: 'Notice',
        accent: '#7C8CFF',
        bgTint: 'rgba(124, 140, 255, 0.10)',
        iconColor: '#9AA6FF',
        badgeColor: '#5C70F0',
        emoji: '📢',
        iconName: 'megaphone',
    },
    FEE_DUE: {
        label: 'Fees',
        accent: '#FF3D5A',
        bgTint: 'rgba(255, 61, 90, 0.12)',
        iconColor: '#FF6E84',
        badgeColor: '#E11E3B',
        emoji: '💳',
        iconName: 'indian-rupee',
    },
    FEE_PAID: {
        label: 'Payment',
        accent: '#3DDC97',
        bgTint: 'rgba(61, 220, 151, 0.10)',
        iconColor: '#5DE4A8',
        badgeColor: '#2FC283',
        emoji: '💚',
        iconName: 'badge-check',
    },
    LEAVE: {
        label: 'Leave',
        accent: '#FFB44A',
        bgTint: 'rgba(255, 180, 74, 0.10)',
        iconColor: '#FFC77A',
        badgeColor: '#E89626',
        emoji: '🗓️',
        iconName: 'calendar-check',
    },
    EXPENSE: {
        label: 'Expense',
        accent: '#D4B24A',
        bgTint: 'rgba(212, 178, 74, 0.10)',
        iconColor: '#E0C470',
        badgeColor: '#B8932A',
        emoji: '🧾',
        iconName: 'receipt',
    },
    PAYROLL: {
        label: 'Salary',
        accent: '#2FC283',
        bgTint: 'rgba(47, 194, 131, 0.10)',
        iconColor: '#5BD49F',
        badgeColor: '#1FA66C',
        emoji: '💼',
        iconName: 'wallet',
    },
    SAFETY: {
        label: 'Safety',
        accent: '#FF2D55',
        bgTint: 'rgba(255, 45, 85, 0.14)',
        iconColor: '#FF607E',
        badgeColor: '#E60032',
        emoji: '🛡️',
        iconName: 'shield-alert',
    },
    BUS: {
        label: 'Transport',
        accent: '#FFD24A',
        bgTint: 'rgba(255, 210, 74, 0.10)',
        iconColor: '#FFDF7A',
        badgeColor: '#E0B020',
        emoji: '🚌',
        iconName: 'bus',
    },
};

export interface NotificationCardProps {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    createdAt: string | number | Date;
    unread?: boolean;
    onPress?: (id: string) => void;
    onDismiss?: (id: string) => void;
    onMarkRead?: (id: string) => void;
    onDelete?: (id: string) => void;
    onViewDetails?: (id: string) => void;
}

const SWIPE_THRESHOLD = 110;
const BASE_BG = '#0A0A0F';

function formatRelative(input: string | number | Date): string {
    const then = new Date(input).getTime();
    if (Number.isNaN(then)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diffSec < 45) return 'just now';
    if (diffSec < 90) return '1 min ago';
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(then).toLocaleDateString();
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const NotificationCardInner: React.FC<NotificationCardProps> = ({
    id,
    type,
    title,
    body,
    createdAt,
    unread = false,
    onPress,
    onDismiss,
    onMarkRead,
    onDelete,
    onViewDetails,
}) => {
    const meta = NOTIFICATION_TYPE_MAP[type];

    const translateX = useSharedValue(0);
    const opacity = useSharedValue(1);
    const height = useSharedValue<number | 'auto'>('auto');
    const readOpacity = useSharedValue(unread ? 1 : 0.72);
    const pressScale = useSharedValue(1);
    const rippleOpacity = useSharedValue(0);
    const rippleScale = useSharedValue(0);
    const unreadDotPulse = useSharedValue(unread ? 1 : 0);

    const timestamp = useMemo(() => formatRelative(createdAt), [createdAt]);

    React.useEffect(() => {
        if (unread) {
            unreadDotPulse.value = withSequence(
                withTiming(1.25, { duration: 900, easing: Easing.out(Easing.quad) }),
                withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) })
            );
        } else {
            unreadDotPulse.value = withTiming(0, { duration: 220 });
            readOpacity.value = withTiming(0.72, { duration: 260 });
        }
    }, [unread, unreadDotPulse, readOpacity]);

    const finishDismiss = useCallback(
        (direction: 1 | -1) => {
            if (onDismiss) onDismiss(id);
            translateX.value = direction * 600;
        },
        [id, onDismiss, translateX]
    );

    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onUpdate((e) => {
            translateX.value = e.translationX;
        })
        .onEnd((e) => {
            if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
                const dir = (e.translationX > 0 ? 1 : -1) as 1 | -1;
                translateX.value = withTiming(
                    dir * 600,
                    { duration: 250, easing: Easing.in(Easing.cubic) },
                    () => {
                        opacity.value = withTiming(0, { duration: 120 });
                        runOnJS(finishDismiss)(dir);
                    }
                );
            } else {
                translateX.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
            }
        });

    const longPressGesture = Gesture.LongPress()
        .minDuration(380)
        .onStart(() => {
            runOnJS(openActionSheet)();
        });

    const openActionSheet = useCallback(() => {
        const options = ['Mark as Read', 'View Details', 'Delete', 'Cancel'];
        const cancelButtonIndex = 3;
        const destructiveButtonIndex = 2;

        const handleIndex = (idx?: number) => {
            if (idx === 0) onMarkRead?.(id);
            else if (idx === 1) onViewDetails?.(id);
            else if (idx === 2) onDelete?.(id);
        };

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                { options, cancelButtonIndex, destructiveButtonIndex, userInterfaceStyle: 'dark' },
                handleIndex
            );
        } else {
            Alert.alert(title, 'Choose an action', [
                { text: 'Mark as Read', onPress: () => onMarkRead?.(id) },
                { text: 'View Details', onPress: () => onViewDetails?.(id) },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(id) },
                { text: 'Cancel', style: 'cancel' },
            ]);
        }
    }, [id, title, onMarkRead, onViewDetails, onDelete]);

    const composed = Gesture.Simultaneous(panGesture, longPressGesture);

    const cardAnimatedStyle = useAnimatedStyle(() => {
        const tx = translateX.value;
        const fade = interpolate(
            Math.abs(tx),
            [0, SWIPE_THRESHOLD, 300],
            [1, 0.85, 0],
            Extrapolation.CLAMP
        );
        return {
            opacity: opacity.value * fade * readOpacity.value,
            transform: [{ translateX: tx }, { scale: pressScale.value }],
        };
    });

    const rippleStyle = useAnimatedStyle(() => ({
        opacity: rippleOpacity.value,
        transform: [{ scale: rippleScale.value }],
    }));

    const unreadDotStyle = useAnimatedStyle(() => {
        const pulse = unreadDotPulse.value;
        return {
            opacity: pulse === 0 ? 0 : 1,
            transform: [{ scale: pulse === 0 ? 0 : pulse }],
            shadowOpacity: pulse === 0 ? 0 : 0.9,
        };
    });

    const handlePressIn = () => {
        pressScale.value = withTiming(0.985, { duration: 120 });
        rippleScale.value = 0;
        rippleOpacity.value = 0.35;
        rippleScale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
        rippleOpacity.value = withDelay(
            200,
            withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) })
        );
    };
    const handlePressOut = () => {
        pressScale.value = withTiming(1, { duration: 140 });
    };

    const handlePress = () => {
        if (unread) readOpacity.value = withTiming(0.72, { duration: 300 });
        onPress?.(id);
    };

    return (
        <GestureDetector gesture={composed}>
            <Animated.View
                entering={SlideInRight.duration(300).easing(Easing.out(Easing.cubic))}
                exiting={SlideOutLeft.duration(250).easing(Easing.in(Easing.cubic))}
                style={[styles.wrapper, cardAnimatedStyle]}
            >
                {/* left accent border */}
                <View style={[styles.accentBar, { backgroundColor: meta.accent }]} />

                {/* background tint layer */}
                <LinearGradient
                    colors={[meta.bgTint, 'rgba(18, 18, 26, 0.65)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                {/* glass sheen */}
                <LinearGradient
                    colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />

                <AnimatedPressable
                    android_ripple={{ color: meta.accent + '22', borderless: false }}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={handlePress}
                    style={styles.pressable}
                >
                    {/* tap ripple (iOS + web parity) */}
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.ripple,
                            { backgroundColor: meta.accent + '33' },
                            rippleStyle,
                        ]}
                    />

                    <View style={styles.row}>
                        {/* icon bubble */}
                        <View
                            style={[
                                styles.iconBubble,
                                { backgroundColor: meta.accent + '1F', borderColor: meta.accent + '55' },
                            ]}
                        >
                            <Text style={[styles.iconEmoji, { color: meta.iconColor }]}>
                                {meta.emoji}
                            </Text>
                        </View>

                        <View style={styles.content}>
                            {/* label + timestamp row */}
                            <View style={styles.metaRow}>
                                <View
                                    style={[
                                        styles.pill,
                                        { backgroundColor: meta.badgeColor + '22', borderColor: meta.badgeColor + '66' },
                                    ]}
                                >
                                    <Text style={[styles.pillText, { color: meta.iconColor }]}>
                                        {meta.label}
                                    </Text>
                                </View>
                                <Text style={styles.timestamp}>{timestamp}</Text>
                            </View>

                            {/* title */}
                            <Text numberOfLines={1} style={styles.title}>
                                {title}
                            </Text>

                            {/* body */}
                            <Text numberOfLines={2} style={styles.body}>
                                {body}
                            </Text>
                        </View>

                        {/* unread dot w/ accent glow */}
                        <Animated.View
                            style={[
                                styles.unreadDot,
                                {
                                    backgroundColor: meta.accent,
                                    shadowColor: meta.accent,
                                },
                                unreadDotStyle,
                            ]}
                            entering={FadeIn.duration(200)}
                        />
                    </View>
                </AnimatedPressable>
            </Animated.View>
        </GestureDetector>
    );
};

/**
 * Root export. If you are NOT already rendering a GestureHandlerRootView
 * higher in the tree, wrap your notification list in one (recommended at
 * app root). This export wraps in one defensively only when used standalone.
 */
const NotificationCard: React.FC<NotificationCardProps & { standalone?: boolean }> = ({
    standalone,
    ...props
}) => {
    if (standalone) {
        return (
            <GestureHandlerRootView>
                <NotificationCardInner {...props} />
            </GestureHandlerRootView>
        );
    }
    return <NotificationCardInner {...props} />;
};

export default NotificationCard;

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        marginHorizontal: 14,
        marginVertical: 6,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: BASE_BG,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    accentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        zIndex: 2,
    },
    pressable: {
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 14,
    },
    ripple: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 18,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconBubble: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    iconEmoji: {
        fontSize: 20,
        lineHeight: 22,
    },
    content: {
        flex: 1,
        minWidth: 0,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    pill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    pillText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    timestamp: {
        fontSize: 11,
        color: '#FFFFFF',
        opacity: 0.5,
        letterSpacing: 0.2,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        letterSpacing: -0.1,
        marginBottom: 2,
    },
    body: {
        fontSize: 13,
        fontWeight: '400',
        color: '#FFFFFF',
        opacity: 0.75,
        lineHeight: 18,
    },
    unreadDot: {
        width: 9,
        height: 9,
        borderRadius: 999,
        marginLeft: 10,
        marginTop: 6,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 8,
        elevation: 6,
    },
});
