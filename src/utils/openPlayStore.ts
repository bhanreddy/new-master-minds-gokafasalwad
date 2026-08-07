import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { alertCompat } from './crossPlatformAlert';

/** Play Store listing URL — `{packageName}` is filled from app.json `expo.android.package`. */
const PLAY_STORE_URL_TEMPLATE =
  'https://play.google.com/store/apps/details?id={packageName}';

/**
 * Android applicationId from Expo config (app.json), with runtime fallback.
 * Per-school builds swap package via app.template.json → app.json.
 */
export function getAndroidPackageName(): string {
  return (
    Constants.expoConfig?.android?.package ||
    Application.applicationId ||
    ''
  );
}

export function getPlayStoreUrl(packageName = getAndroidPackageName()): string {
  return PLAY_STORE_URL_TEMPLATE.replace('{packageName}', packageName);
}

/** Opens this build's Play Store listing (market:// on Android, https fallback). */
export async function openPlayStore(): Promise<void> {
  const packageName = getAndroidPackageName();
  if (!packageName) {
    console.warn('[openPlayStore] No Android package name in app.json / Application');
    return;
  }

  const httpsUrl = getPlayStoreUrl(packageName);
  const marketUrl = `market://details?id=${packageName}`;

  try {
    if (Platform.OS === 'android') {
      const canOpenMarket = await Linking.canOpenURL(marketUrl);
      if (canOpenMarket) {
        await Linking.openURL(marketUrl);
        return;
      }
    }
    await Linking.openURL(httpsUrl);
  } catch {
    await Linking.openURL(httpsUrl);
  }
}

/**
 * After a successful multi-student action: thank the user and invite a Play Store review.
 */
export function promptAppReviewAfterSuccess(
  title: string,
  successMessage: string,
): void {
  alertCompat(
    title,
    `${successMessage}\n\nEnjoying the app? A quick Play Store review helps other schools find us.`,
    [
      { text: 'Maybe later', style: 'cancel' },
      {
        text: 'Rate on Play Store',
        onPress: () => {
          void openPlayStore();
        },
      },
    ],
  );
}
