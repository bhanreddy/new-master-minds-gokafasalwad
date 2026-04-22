import React, { useEffect, useContext, useRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import LogoLoader from '../src/components/LogoLoader';
import { ThemeContext } from '../src/context/ThemeContext';
import { useAuth } from '../src/hooks/useAuth';

const getHomeRoute = (role: string) => {
  switch (role) {
    case 'admin': return '/admin/dashboard';
    case 'accountant': return '/accounts/dashboard';
    case 'staff':
    case 'teacher': return '/staff/dashboard';
    case 'driver': return '/driver/dashboard';
    default: return '/(tabs)/home';
  }
};

export default function AnimatedSplash() {
  const router = useRouter();
  const { theme, isDark } = useContext(ThemeContext);
  const { user, loading } = useAuth();

  // --- Refs to hold the latest values so timer callbacks never see stale data ---
  const loadingRef = useRef(loading);
  const userRef = useRef(user);
  loadingRef.current = loading;
  userRef.current = user;

  const hasNavigated = useRef(false);

  // Navigate based on latest auth state (reads refs, never stale)
  const doNavigate = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    const currentUser = userRef.current;
    if (currentUser) {
      const roleCode =
        typeof currentUser?.role === 'object' && currentUser?.role !== null
          ? (currentUser.role as any).code
          : currentUser?.role;

      if (roleCode === 'student' && currentUser.has_student_profile === false) {
        router.replace('/no-profile');
      } else if ((roleCode === 'staff' || roleCode === 'teacher') && currentUser.has_staff_profile === false) {
        router.replace('/no-profile');
      } else {
        router.replace(getHomeRoute(roleCode));
      }
    } else {
      router.replace('/welcome');
    }
  }, [router]);

  // Hard safety timeout: force-navigate if nothing else worked after 8s
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (!hasNavigated.current) {
        if (__DEV__) console.warn('[AnimatedSplash] Safety timeout — forcing navigation');
        doNavigate();
      }
    }, 8000);

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [doNavigate]);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }
      ]}
    >
      <LogoLoader 
        size={160} 
        color={isDark ? '#FFFFFF' : '#000000'} 
        isReady={!loading}
        onLogoRevealed={doNavigate}
      />
    </View>
  );
}
