import React from 'react';
import { MaterialTopTabs } from '../../src/layouts/MaterialTopTabs';
import DriverFooter from '../../src/components/DriverFooter';
import { useRequireRole } from '../../src/hooks/useRequireRole';
import { useTranslation } from 'react-i18next';
export { ErrorBoundary } from '@/src/components/ErrorBoundary';

export default function DriverLayout() {
    // Ensure only drivers can access this segment
    useRequireRole('driver', 'admin');
    const { t } = useTranslation();

    return (
        <MaterialTopTabs
            tabBarPosition="bottom"
            tabBar={(props) => <DriverFooter {...props} />}
            screenOptions={{
                swipeEnabled: true,
                animationEnabled: true,
                lazy: true,
                headerShown: false,
            } as any}
        >
            <MaterialTopTabs.Screen
                name="trip"
                options={{ title: t('driver_ui.trip') }}
            />
            <MaterialTopTabs.Screen
                name="dashboard"
                options={{ title: t('driver_ui.route') }}
            />
            <MaterialTopTabs.Screen
                name="students"
                options={{ title: t('driver_ui.students') }}
            />
            <MaterialTopTabs.Screen
                name="bus-attendance"
                options={{ title: t('driver_ui.bus_attendance') }}
            />
            <MaterialTopTabs.Screen
                name="payslip"
                options={{ title: t('driver_ui.payslip') }}
            />
            <MaterialTopTabs.Screen
                name="profile"
                options={{ title: t('driver_ui.profile') }}
            />
        </MaterialTopTabs>
    );
}
