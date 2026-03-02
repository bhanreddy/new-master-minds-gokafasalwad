
import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken, onMessage, onTokenRefresh, requestPermission, AuthorizationStatus } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './apiClient';


class NotificationManager {

    private unsubscribeOnMessage?: () => void;
    private unsubscribeOnTokenRefresh?: () => void;

    /**
     * Create all Android notification channels (Default and Custom variants).
     * Must be called before any notification is displayed.
     */
    async createChannels() {
        if (Platform.OS !== 'android') return;

        // Base sets of channels for the 5 categories
        const categories = [
            { id: 'emergency', name: 'Emergency Alerts', sound: 'emergency.wav', priority: Notifications.AndroidNotificationPriority.MAX, vibrate: [0, 500, 500, 500] },
            { id: 'exam', name: 'Exam & Admin Updates', sound: 'exam.wav', priority: Notifications.AndroidNotificationPriority.HIGH, vibrate: [0, 250, 250, 250] },
            { id: 'fee_reminder', name: 'Fee Reminders', sound: 'fee_reminder.wav', priority: Notifications.AndroidNotificationPriority.HIGH, vibrate: [0, 250, 250, 250] },
            { id: 'voice_alert', name: 'General Alerts', sound: 'voice_alert.wav', priority: Notifications.AndroidNotificationPriority.HIGH, vibrate: [0, 250, 250, 250] },
            { id: 'attendance_absent_alert', name: 'Absent Alerts', sound: 'attendance_absent_alert.wav', priority: Notifications.AndroidNotificationPriority.MAX, vibrate: [0, 500, 500, 500] },
        ];

        for (const cat of categories) {
            // 1. Create Default version (No custom sound)
            await Notifications.setNotificationChannelAsync(`${cat.id}_default`, {
                name: `${cat.name} (Default)`,
                importance: Notifications.AndroidImportance.HIGH,
                sound: 'default',
                vibrationPattern: cat.vibrate,
                lightColor: '#FF231F7C',
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            });

            // 2. Create Custom version (With custom bundled .wav sound)
            await Notifications.setNotificationChannelAsync(`${cat.id}_custom`, {
                name: `${cat.name} (Custom)`,
                importance: Notifications.AndroidImportance.MAX, // Max to ensure sound plays
                sound: cat.sound,
                vibrationPattern: cat.vibrate,
                lightColor: '#FF231F7C',
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            });
        }
    }

    async registerForPushNotificationsAsync() {
        let token: string | undefined;

        try {
            // 1. Create channels first
            if (Platform.OS === 'android') {
                await this.createChannels();
            }

            if (Platform.OS === 'web') {
                console.log('Push notifications not supported on web yet.');
                return;
            }

            // 2. Request permission (iOS requires explicit permission; Android auto-grants on API < 33)
            const app = getApp();
            const msg = getMessaging(app);
            const authStatus = await requestPermission(msg);
            const enabled =
                authStatus === AuthorizationStatus.AUTHORIZED ||
                authStatus === AuthorizationStatus.PROVISIONAL;

            if (!enabled) {
                console.warn('Push notification permission not granted!');
                return;
            }

            // 3. Get FCM Token
            token = await getToken(msg);

            if (token) {
                await this.syncToken(token);
            }

            return token;
        } catch (e) {
            console.error('Error in registerForPushNotificationsAsync (safe suppression):', e);
            return undefined; // Gracefully suppress so it doesn't crash the app thread
        }
    }

    async syncToken(token: string) {
        try {
            await api.post('/notifications/register', {
                fcm_token: token,
                platform: Platform.OS
            });
        } catch (error) {
            console.warn('Failed to sync FCM token:', error);
        }
    }

    /**
     * Unregister FCM token from backend.
     *
     * ⚠️ IMPORTANT: Only call this on EXPLICIT user-initiated logout.
     * Do NOT call on:
     *   - Temporary auth failures
     *   - Network disconnections
     *   - Token refresh failures
     *   - Session policy expiry
     *
     * FCM token delivery is independent of access token lifecycle.
     * The backend stores FCM tokens against userId, not against sessions.
     * Notifications must continue to be delivered even if the access token is expired.
     */
    async unregisterPushToken() {
        try {
            await api.post('/notifications/unregister', {}, { silent: true });
        } catch (error) {
            // Silently fail - we are logging out anyway
        }
    }

    setupListeners() {
        if (Platform.OS === 'web') return;

        const app = getApp();
        const msg = getMessaging(app);

        // 1. Foreground: FCM suppresses notification payloads in foreground.
        //    We use expo-notifications to display them manually.
        this.unsubscribeOnMessage = onMessage(msg, async remoteMessage => {
            console.log('FCM Foreground Message:', remoteMessage);

            let channelId = remoteMessage.notification?.android?.channelId || 'voice_alert';

            // Add suffix if missing (fallback for backend)
            if (!channelId.endsWith('_default') && !channelId.endsWith('_custom')) {
                try {
                    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                    const pref = await AsyncStorage.getItem('notification_sound');
                    // 'default' is the default logic, unless they explicitly chose 'custom'
                    const suffix = pref === 'custom' ? '_custom' : '_default';
                    channelId = `${channelId}${suffix}`;
                } catch (err) {
                    channelId = `${channelId}_default`;
                }
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: remoteMessage.notification?.title || '',
                    body: remoteMessage.notification?.body || '',
                    data: remoteMessage.data,
                },
                // Pass channelId inside trigger for Android
                trigger: {
                    channelId,
                } as any,
            });
        });

        // 2. Token Refresh: Re-sync whenever FCM rotates the token
        this.unsubscribeOnTokenRefresh = onTokenRefresh(msg, async newToken => {
            console.log('FCM Token Refreshed:', newToken);
            await this.syncToken(newToken);
        });
    }

    cleanupListeners() {
        if (this.unsubscribeOnMessage) this.unsubscribeOnMessage();
        if (this.unsubscribeOnTokenRefresh) this.unsubscribeOnTokenRefresh();
    }
}

export const notificationManager = new NotificationManager();