import { Tabs } from 'expo-router';
import React from 'react';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { useTranslation } from 'react-i18next';
import { useFeatures } from '@/src/hooks/useFeatures';
import StudentBottomDock from '@/src/components/StudentBottomDock';

export { ErrorBoundary } from '@/src/components/ErrorBoundary';

export default function TabLayout() {
    const { t } = useTranslation();
    const { isEnabled } = useFeatures();
    useRequireRole('student', 'parent');

    return (
        <Tabs
            tabBar={(props) => <StudentBottomDock {...props} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    headerShown: false,
                    tabBarLabel: t('dashboard.home', 'Home'),
                }}
            />

            <Tabs.Screen
                name="timetable"
                options={{
                    headerShown: false,
                    // href:null removes the tab button when disabled; the route guard
                    // on the screen still redirects deep-links to Home.
                    href: isEnabled('nav.time_table') ? undefined : null,
                    tabBarLabel: t('timetable.title', 'TimeTable'),
                }}
            />
            <Tabs.Screen
                name="fees"
                options={{
                    headerShown: false,
                    href: isEnabled('nav.fees') ? undefined : null,
                    tabBarLabel: t('fees', 'Fees'),
                }}
            />
            <Tabs.Screen
                name="results"
                options={{
                    headerShown: false,
                    href: isEnabled('nav.results') ? undefined : null,
                    tabBarLabel: t('menu.results', 'Results'),
                }}
            />

        </Tabs>
    );
}
