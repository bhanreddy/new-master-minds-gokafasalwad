import React, { useEffect, useMemo, useState } from 'react';
import { View, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useRequireRole } from '../../src/hooks/useRequireRole';
export { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { AccountsWebChromeProvider } from '../../src/contexts/AccountsWebChromeContext';
import AdminHeader from '../../src/components/AdminHeader';
import AccountsWebSidebar from '../../src/components/AccountsWebSidebar';
import {
  getAccountsShellTitle,
  isAccountsDashboardPath,
} from '../../src/utils/accountsShellTitles';
import { useTheme } from '../../src/hooks/useTheme';
import { StudentService } from '../../src/services/studentService';

export default function AccountsLayout() {
  useRequireRole('accountant', 'admin', 'principal');

  const { width: windowWidth } = useWindowDimensions();
  const pathname = usePathname();
  const { theme } = useTheme();
  const isWideWeb = Platform.OS === 'web' && windowWidth >= 768;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingEnrollmentBadge, setPendingEnrollmentBadge] = useState(0);

  useEffect(() => {
    if (!isWideWeb) return;
    let alive = true;
    StudentService.getUnenrolledStudents()
      .then((rows) => {
        if (alive) setPendingEnrollmentBadge(Array.isArray(rows) ? rows.length : 0);
      })
      .catch(() => {
        if (alive) setPendingEnrollmentBadge(0);
      });
    return () => {
      alive = false;
    };
  }, [isWideWeb]);

  const chromeValue = useMemo(
    () => ({
      shellActive: isWideWeb,
      sidebarCollapsed,
      setSidebarCollapsed,
    }),
    [isWideWeb, sidebarCollapsed],
  );

  const shellTitle = getAccountsShellTitle(pathname);
  const showBack = !isAccountsDashboardPath(pathname);

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: isWideWeb
          ? { flex: 1, backgroundColor: theme.colors.background }
          : undefined,
      }}
    />
  );

  return (
    <AccountsWebChromeProvider value={chromeValue}>
      {isWideWeb ? (
        <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
          <AdminHeader
            title={shellTitle}
            showBackButton={showBack}
            showMenuButton
            onMenuPress={() => setSidebarCollapsed((c) => !c)}
          />
          <View style={styles.bodyRow}>
            <AccountsWebSidebar
              collapsed={sidebarCollapsed}
              pendingEnrollmentsBadge={pendingEnrollmentBadge}
            />
            <View style={styles.stackCell}>{stack}</View>
          </View>
        </View>
      ) : (
        stack
      )}
    </AccountsWebChromeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bodyRow: { flex: 1, flexDirection: 'row' },
  stackCell: { flex: 1, minWidth: 0, minHeight: 0 },
});
