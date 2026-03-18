import { Stack } from 'expo-router';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { validateBuildConfig } from '../src/constants/school';
import '../src/i18n';
import { AuthService } from '../src/services/authService';
import { AuthProvider } from '../src/hooks/useAuth';
import { ThemeProvider, ThemeContext } from '../src/context/ThemeContext';
import { ThemeProvider as NavThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useContext, useState, useEffect } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { useNotifications } from '../src/hooks/useNotifications';
import { useAuthGuard } from '../src/hooks/useAuthGuard';
import { useNotificationObserver } from '../src/hooks/useNotificationObserver';
import { AuthGate } from '../src/components/AuthGate';
import { useSchoolHeader } from '../src/hooks/useSchoolHeader';

// NOTE: setNotificationHandler is set once in notificationManager.ts (module-level).
// NOTE: setBackgroundMessageHandler is registered in index.js (the JS entry point)
//       so it fires even when the app is killed and Android starts a headless JS task.

import { useFonts } from 'expo-font';
import { FontAwesome5 } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import AppSplash from '../src/components/AppSplash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [loaded, error] = useFonts({
    ...FontAwesome5.font
  });

  const [appReady, setAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [buildConfigError, setBuildConfigError] = useState<string | null>(null);

  // Validate build configuration on startup
  useEffect(() => {
    try {
      validateBuildConfig();
    } catch (e: any) {
      setBuildConfigError(e.message);
    }
  }, []);
  useEffect(() => {
    const clearOldCache = async () => {
      const keys = await AsyncStorage.getAllKeys();
      const stale = keys.filter((k) => k.startsWith('mlkit_tx_') || k.startsWith('tx_cache_'));
      if (stale.length > 0) await AsyncStorage.multiRemove(stale);
    };
    clearOldCache();

    // Cache invalidation based on app version updates
    const checkAppVersion = async () => {
      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      const storedVersion = await AsyncStorage.getItem('app_version');
      if (storedVersion && storedVersion !== currentVersion) {
        // App updated, clear all offline caches starting with @app_
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter((k) => k.startsWith('@app_'));
        if (cacheKeys.length > 0) {
          await AsyncStorage.multiRemove(cacheKeys);
        }
        if (__DEV__) console.log(`[Cache Invalidation] Flushed cache for new version ${currentVersion}`);
        // FIX 4 APPLIED — Version bump explicitly clears data cache only, never auth keys
      }
      await AsyncStorage.setItem('app_version', currentVersion);
    };
    checkAppVersion();

    // Note: scheduleMidnightCheck was removed from AuthService if it existed
  }, []);

  useEffect(() => {
    if (loaded || error) {
      setAppReady(true);
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!appReady) {
    return null;
  }

  if (buildConfigError && __DEV__) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffebe6', padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#DE350B', marginBottom: 12 }}>
          Build Configuration Error
        </Text>
        <ScrollView style={{ backgroundColor: 'white', padding: 16, borderRadius: 8, maxHeight: 300 }}>
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#172B4D' }}>
            {buildConfigError}
          </Text>
        </ScrollView>
        <Text style={{ marginTop: 24, fontSize: 16, color: '#42526E', textAlign: 'center' }}>
          Please fix your .env file and restart the bundler (e.g. npx expo start --clear).
        </Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <ThemeSyncWrapper />
        {showCustomSplash && (
          <AppSplash onFinish={() => setShowCustomSplash(false)} />
        )}
      </ThemeProvider>
    </AuthProvider>);

}

function ThemeSyncWrapper() {
  const { theme, isDark } = useContext(ThemeContext);
  const getSchoolHeader = useSchoolHeader();

  // Convert our custom theme to React Navigation theme format
  const baseNavTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseNavTheme,
    dark: isDark,
    colors: {
      ...baseNavTheme.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.notification
    }
  };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
      <ErrorBoundary>
        <AuthGate>
          <Stack
            screenOptions={{
              ...getSchoolHeader(),
              headerShown: false, // Default to false but provide the options for screens that opt-in
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.colors.background }
            }} />

        </AuthGate>
      </ErrorBoundary>
      {/* Auth guard and hooks run AFTER the Stack navigator has mounted */}
      <NavigationReady />

      {/* Global Animated Splash Screen Overlay removed - now native AnimatedSplash handles this */}
    </NavThemeProvider>);

}

/**
 * This component runs hooks that depend on React Navigation being fully mounted.
 * It must render AFTER the Stack navigator, not before.
 * Renders nothing visually.
 */
function NavigationReady() {
  useAuthGuard();
  useNotifications();
  useNotificationObserver();
  return null;
}