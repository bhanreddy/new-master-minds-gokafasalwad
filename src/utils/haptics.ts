/**
 * Safe Haptics Proxy — Drop-in replacement for `expo-haptics`.
 *
 * On web, expo-haptics throws UnavailabilityError which crashes event handlers
 * and silently kills button onPress chains. This module re-exports the same API
 * but wraps all calls with a Platform check so they are no-ops on web.
 *
 * Usage:  import * as Haptics from '@/src/utils/haptics';
 *    OR:  import { HapticFeedback } from '@/src/utils/animations';  (high-level helper)
 */
import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

// Re-export types and enums so callers don't need to import expo-haptics directly
export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

export async function impactAsync(
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Medium
): Promise<void> {
  if (Platform.OS !== 'web') {
    return ExpoHaptics.impactAsync(style);
  }
}

export async function notificationAsync(
  type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success
): Promise<void> {
  if (Platform.OS !== 'web') {
    return ExpoHaptics.notificationAsync(type);
  }
}

export async function selectionAsync(): Promise<void> {
  if (Platform.OS !== 'web') {
    return ExpoHaptics.selectionAsync();
  }
}
