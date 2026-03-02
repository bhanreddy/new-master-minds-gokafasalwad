import { useEffect } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, getInitialNotification, onNotificationOpenedApp } from '@react-native-firebase/messaging';
import { useRouter } from 'expo-router';
import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './useAuth';

// Global variable to store deep link if user is not logged in
let PendingNavigation: string | null = null;

export function useNotificationObserver() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (Platform.OS === 'web') return;

        let isMounted = true;
        const app = getApp();
        const msg = getMessaging(app);

        // 1. Handle Initial Launch from Killed State
        const checkInitialNotification = async () => {
            const remoteMessage = await getInitialNotification(msg);
            if (remoteMessage && isMounted) {
                const deepLink = remoteMessage.data?.deepLink as string | undefined;
                if (deepLink) {
                    console.log('[NotificationObserver] Found initial deep link:', deepLink);
                    handleDeepLink(deepLink);
                }
            }
        };

        checkInitialNotification();

        // 2. Handle Background Taps (app was in background, user tapped notification)
        const unsubscribe = onNotificationOpenedApp(msg, (remoteMessage) => {
            const deepLink = remoteMessage.data?.deepLink as string | undefined;
            if (deepLink) {
                console.log('[NotificationObserver] Received deep link tap:', deepLink);
                handleDeepLink(deepLink);
            }
        });

        // 4. Handle Expo Notifications (Cold Start from killed state)
        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response && isMounted) {
                const data = response.notification.request.content.data;
                const deepLink = data?.deepLink || data?.url || data?.screen;
                if (deepLink) {
                    console.log('[NotificationObserver] Found Expo initial deep link:', deepLink);
                    handleDeepLink(deepLink as string);
                }
            }
        });

        // 5. Handle Expo Notifications (Foreground/Background Taps)
        const expoSubscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            const deepLink = data?.deepLink || data?.url || data?.screen;
            if (deepLink) {
                console.log('[NotificationObserver] Received Expo tap:', deepLink);
                handleDeepLink(deepLink as string);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
            expoSubscription.remove();
        };
    }, []);

    // 3. Watch for Auth State Changes to process pending links
    useEffect(() => {
        if (!loading && user && PendingNavigation) {
            console.log('[NotificationObserver] Processing pending navigation:', PendingNavigation);
            const target = PendingNavigation;
            PendingNavigation = null;
            // Small delay to ensure router is ready/auth guarded and hasn't just replaced the route
            setTimeout(() => {
                Linking.openURL(target).catch(() => {
                    // Fallback to router push if linking fails, ensure valid path by removing protocol and deduping slashes
                    const cleanPath = '/' + target.replace(/^testapp:\/+/, '').replace(/^\/+/, '');
                    router.push(cleanPath as any);
                });
            }, 500);
        }
    }, [user, loading]);

    const handleDeepLink = (path: string) => {
        // Ensure path is properly formatted as a deep link URL
        const formattedPath = path.startsWith('testapp://')
            ? path
            : `testapp://${path.startsWith('/') ? path : `/${path}`}`;

        console.log('[NotificationObserver] Handling deep link:', formattedPath);

        // Always set pending first
        PendingNavigation = formattedPath;

        // If already logged in and not loading, navigate immediately
        if (user && !loading) {
            console.log('[NotificationObserver] User active, queuing navigation with delay to avoid AuthGuard collision.');
            PendingNavigation = null;
            setTimeout(() => {
                Linking.openURL(formattedPath).catch(() => {
                    // Fallback to router push if linking fails
                    const cleanPath = '/' + path.replace(/^testapp:\/+/, '').replace(/^\/+/, '');
                    router.push(cleanPath as any);
                });
            }, 500);
        } else {
            console.log('[NotificationObserver] User not ready, queuing navigation.');
        }
    };
}
