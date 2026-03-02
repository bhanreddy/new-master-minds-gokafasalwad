import { Stack } from 'expo-router';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import '../src/i18n';
import { AuthProvider } from '../src/hooks/useAuth';
import { ThemeProvider, ThemeContext } from '../src/context/ThemeContext';
import { ThemeProvider as NavThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useContext } from 'react';

import { useNotifications } from '../src/hooks/useNotifications';
import { useAuthGuard } from '../src/hooks/useAuthGuard';
import { useNotificationObserver } from '../src/hooks/useNotificationObserver';
import { AuthGate } from '../src/components/AuthGate';

export default function Layout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ThemeSyncWrapper />
      </ThemeProvider>
    </AuthProvider>
  );
}

function ThemeSyncWrapper() {
  const { theme, isDark } = useContext(ThemeContext);

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
      notification: theme.colors.notification,
    },
  };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
      <ErrorBoundary>
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
        </AuthGate>
      </ErrorBoundary>
      {/* Auth guard and hooks run AFTER the Stack navigator has mounted */}
      <NavigationReady />
    </NavThemeProvider>
  );
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