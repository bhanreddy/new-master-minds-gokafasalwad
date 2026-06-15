import { useEffect, useState } from 'react';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_URL } from '../constants/school';
import { compareVersions } from '../utils/versionUtils';

type VersionCheckResponse = {
  minimum_version?: string;
  force_update_enabled?: boolean;
};

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

export function useVersionCheck() {
  const [checking, setChecking] = useState(true);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    let mounted = true;

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

        if (!result.ok) {
          if (mounted) setUpdateRequired(false);
          return;
        }

        const response = await result.json() as VersionCheckResponse;
        const forceUpdateEnabled = Boolean(response?.force_update_enabled);

        if (!forceUpdateEnabled) {
          if (mounted) setUpdateRequired(false);
          return;
        }

        const currentVersion =
          Application.nativeApplicationVersion ||
          Constants.expoConfig?.version ||
          '0.0.0';
        const minimumVersion = response?.minimum_version || '0.0.0';

        if (mounted) {
          setUpdateRequired(compareVersions(currentVersion, minimumVersion) < 0);
        }
      } catch {
        if (mounted) setUpdateRequired(false);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    checkVersion();

    return () => {
      mounted = false;
    };
  }, []);

  return { updateRequired, checking };
}
