
import React from 'react';
import { MaterialTopTabs } from '../../src/layouts/MaterialTopTabs';
import StaffFooter from '../../src/components/StaffFooter';
import { useRequireRole } from '../../src/hooks/useRequireRole';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

export default function StaffLayout() {
    useRequireRole('staff', 'teacher', 'admin');

    return (
        <ErrorBoundary>
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
                    options={{ title: "Home" }}
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
        </ErrorBoundary>
    );
}