import { Stack } from 'expo-router';
import React from 'react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

export { ErrorBoundary } from '../../src/components/ErrorBoundary';

/**
 * Groups all `/Screen/*` routes so a single error boundary isolates failures from the root navigator.
 */
export default function ScreenSectionLayout() {
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent'}, headerShown: false }} />
    </ErrorBoundary>
  );
}
