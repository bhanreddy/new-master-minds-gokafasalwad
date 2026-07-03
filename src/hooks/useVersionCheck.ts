import { useEffect, useState } from 'react';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/school';
import { compareVersions } from '../utils/versionUtils';

type VersionCheckResponse = {
  minimum_version?: string;
  force_update_enabled?: boolean;
};

type CachedVersionCheck = {
  updateRequired: boolean;
  minimumVersion: string;
  checkedAt: number;
};

// Deliberately NOT under the '@app_' prefix: the version-bump flush in
// _layout.tsx clears '@app_*' keys, but a force-update flag must survive that.
const VERSION_CHECK_CACHE_KEY = 'version_check_result';

function getApiBaseUrl() {
  const url = API_URL.trim();
  if (Platform.OS === 'web' && url.includes('10.0.2.2')) {
    return url.replace('10.0.2.2', 'localhost');
  }
  if (Platform.OS === 'android' && url.includes('localhost')) {
    return url.replace('localhost', '10.0.2.2');
  }
  return url;
}

function getCurrentVersion() {
  return (
    Application.nativeApplicationVersion ||
    Constants.expoConfig?.version ||
    '0.0.0'
  );
}

/**
 * Non-blocking version check. The last server verdict is cached so a
 * previously-flagged force-update blocks instantly (even offline); the
 * network check runs in the background and updates state + cache.
 * `checking` is kept for API compatibility but callers must not gate
 * first render on it.
 */
export function useVersionCheck() {
  const [checking, setChecking] = useState(true);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function applyCachedVerdict() {
      try {
        const raw = await AsyncStorage.getItem(VERSION_CHECK_CACHE_KEY);
        if (!raw) return;
        const cached = JSON.parse(raw) as CachedVersionCheck;
        // Re-evaluate against the current version: an app update may satisfy
        // the cached minimum without waiting for the network round trip.
        const stillRequired = cached.updateRequired
          && compareVersions(getCurrentVersion(), cached.minimumVersion) < 0;
        if (mounted && stillRequired) setUpdateRequired(true);
      } catch {
        AsyncStorage.removeItem(VERSION_CHECK_CACHE_KEY).catch(() => {});
      }
    }

    async function checkVersion() {
      const schoolId = process.env.EXPO_PUBLIC_SCHOOL_ID;
      if (!schoolId) {
        if (mounted) {
          setUpdateRequired(false);
          setChecking(false);
        }
        return;
      }

      try {
        const apiBaseUrl = getApiBaseUrl();
        if (!apiBaseUrl) {
          if (mounted) setUpdateRequired(false);
          return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const baseUrl = apiBaseUrl.replace(/\/$/, '');
        const separator = baseUrl.includes('?') ? '&' : '?';
        const result = await fetch(
          `${baseUrl}/app/version-check${separator}school_id=${encodeURIComponent(schoolId)}`,
          { signal: controller.signal },
        ).finally(() => clearTimeout(timeoutId));

        if (!result.ok) return;

        const response = await result.json() as VersionCheckResponse;
        const forceUpdateEnabled = Boolean(response?.force_update_enabled);
        const minimumVersion = response?.minimum_version || '0.0.0';
        const required = forceUpdateEnabled
          && compareVersions(getCurrentVersion(), minimumVersion) < 0;

        if (mounted) setUpdateRequired(required);
        AsyncStorage.setItem(VERSION_CHECK_CACHE_KEY, JSON.stringify({
          updateRequired: required,
          minimumVersion,
          checkedAt: Date.now(),
        } satisfies CachedVersionCheck)).catch(() => {});
      } catch {
        // Network failure: keep whatever the cached verdict said.
      } finally {
        if (mounted) setChecking(false);
      }
    }

    applyCachedVerdict();
    checkVersion();

    return () => {
      mounted = false;
    };
  }, []);

  return { updateRequired, checking };
}
