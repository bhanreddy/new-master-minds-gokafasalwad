import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useRequireRole } from '../../src/hooks/useRequireRole';
export { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { AccountsWebChromeProvider } from '../../src/contexts/AccountsWebChromeContext';
import AdminHeader from '../../src/components/AdminHeader';
import AccountsWebSidebar, {
  ACCOUNTS_SIDEBAR_NAV,
} from '../../src/components/AccountsWebSidebar';
import DashboardMenuOverlay from '../../src/components/DashboardMenuOverlay';
import {
  getAccountsShellTitle,
  isAccountsDashboardPath,
} from '../../src/utils/accountsShellTitles';
import { useTheme } from '../../src/hooks/useTheme';
import { usePermissions } from '../../src/hooks/usePermissions';
import { StudentService } from '../../src/services/studentService';

export default function AccountsLayout() {
  useRequireRole('accountant', 'admin', 'principal');

  const { width: windowWidth } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { hasPermission } = usePermissions();
  const isWideWeb = Platform.OS === 'web' && windowWidth >= 768;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingEnrollmentBadge, setPendingEnrollmentBadge] = useState(0);

  useEffect(() => {
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
  }, [pathname]);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const chromeValue = useMemo(
    () => ({
      shellActive: isWideWeb,
      sidebarCollapsed,
      setSidebarCollapsed,
      openMobileNav,
    }),
    [isWideWeb, sidebarCollapsed, openMobileNav],
  );

  const mobileNavItems = useMemo(
    () =>
      ACCOUNTS_SIDEBAR_NAV.filter((it) => !it.permission || hasPermission(it.permission)).map(
        (it) => ({
          title: it.title,
          description: it.category,
          icon: it.icon,
          route: it.route,
          gradient: it.gradient,
          category: it.category,
          badge:
            it.route === '/accounts/pending-enrollments' && pendingEnrollmentBadge > 0
              ? pendingEnrollmentBadge
              : undefined,
        }),
      ),
    [hasPermission, pendingEnrollmentBadge],
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
        <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
          {stack}
          <DashboardMenuOverlay
            isOpen={mobileNavOpen}
            onClose={closeMobileNav}
            items={mobileNavItems}
            activeRoute={pathname}
            onItemPress={(route) => {
              closeMobileNav();
              router.push(route as any);
            }}
          />
        </View>
      )}
    </AccountsWebChromeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bodyRow: { flex: 1, flexDirection: 'row' },
  stackCell: { flex: 1, minWidth: 0, minHeight: 0 },
});
