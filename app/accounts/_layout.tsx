import React from 'react';
import { Stack } from 'expo-router';
import { useRequireRole } from '../../src/hooks/useRequireRole';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

export default function AccountsLayout() {
    useRequireRole('accountant', 'admin', 'principal');

    return (
        <ErrorBoundary>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            />
        </ErrorBoundary>
    );
}
