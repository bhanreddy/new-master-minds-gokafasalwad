import React from 'react';
import type { MaterialTopTabNavigationOptions } from '@react-navigation/material-top-tabs';
import { MaterialTopTabs } from '../../src/layouts/MaterialTopTabs';
import StaffFooter from '../../src/components/StaffFooter';
import { useRequireRole } from '../../src/hooks/useRequireRole';
export { ErrorBoundary } from '../../src/components/ErrorBoundary';

/** Tab options plus parent native-stack fields React Navigation merges upward (e.g. headerShown). */
type StaffTabScreenOptions = MaterialTopTabNavigationOptions & {
    headerShown?: boolean;
};

const dashboardScreenOptions: StaffTabScreenOptions = {
    title: 'Home',
    headerShown: false,
};

export default function StaffLayout() {
    useRequireRole('staff', 'teacher', 'admin');

    return (
        <MaterialTopTabs
            tabBarPosition="bottom"
            tabBar={(props) => <StaffFooter {...props} />}
            screenOptions={{
                swipeEnabled: true,
                animationEnabled: true,
                lazy: true,
            }}
        >
            <MaterialTopTabs.Screen
                name="dashboard"
                options={dashboardScreenOptions}
            />
            <MaterialTopTabs.Screen
                name="manage-students"
                options={{ title: "Attendance" }}
            />
            <MaterialTopTabs.Screen
                name="timetable"
                options={{ title: "Timetable" }}
            />
            <MaterialTopTabs.Screen
                name="results"
                options={{ title: "Results" }}
            />
        </MaterialTopTabs>
    );
}