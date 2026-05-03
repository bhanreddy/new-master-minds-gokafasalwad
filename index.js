import 'react-native-gesture-handler';
import './src/services/notificationManager';
import { notificationManager } from './src/services/notificationManager';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

// Background handler MUST be registered at the JS entry point.
// When the app is killed, Android starts a headless JS task that runs index.js.
// If this handler is registered later (e.g. in _layout.tsx), the headless task
// may never load the React component tree, and background notifications will be lost.
if (Platform.OS !== 'web') {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    await notificationManager.displayNotification(remoteMessage, 'background');
  });
}

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }) => {
  if (error) {
    console.error('Background notification task error:', error);
    return;
  }
  // data.notification is the received notification
  // Do NOT update UI here — only fire local side effects (e.g., badge count, local DB writes)
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);

import 'expo-router/entry';
