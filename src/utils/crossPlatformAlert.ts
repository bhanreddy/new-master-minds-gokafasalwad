import { Alert, Platform } from 'react-native';
import { showAlert } from '../components/CustomAlert';

export type AlertButtonRN = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Drop-in replacement for Alert.alert that works on web.
 * RN Web's Alert.alert does not show UI and never invokes button onPress — breaks approve/confirm flows.
 * Uses CustomAlert (requires CustomAlertProvider in app/_layout).
 */
export function alertCompat(title: string, message?: string, buttons?: AlertButtonRN[]): void {
  if (Platform.OS === 'web') {
    void showAlert({
      type: buttons && buttons.length > 1 ? 'confirm' : 'info',
      title,
      message: message ?? '',
      buttons:
        buttons && buttons.length > 0
          ? buttons.map((b) => ({
              text: b.text,
              style: b.style,
              onPress: b.onPress,
            }))
          : undefined,
    });
    return;
  }
  if (buttons && buttons.length > 0) {
    Alert.alert(title, message ?? '', buttons);
  } else if (message !== undefined) {
    Alert.alert(title, message);
  } else {
    Alert.alert(title);
  }
}
