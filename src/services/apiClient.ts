import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { supabase } from './supabaseConfig';
import NetInfo from '@react-native-community/netinfo';
import { API_URL, SCHOOL_ID } from '../constants/school';
import { showAlert } from '../components/CustomAlert';

/**
 * Cross-platform alert helper.
 * On web, Alert.alert() is a no-op, so we use CustomAlert (showAlert).
 * On native, Alert.alert() works fine and is used as the primary.
 */
function alertFn(title: string, message: string) {
  if (Platform.OS === 'web') {
    showAlert({ type: 'error', title, message });
  } else {
    Alert.alert(title, message);
  }
}

/** school_id for all API requests — from build-time env. Never hardcode. */
const SCHOOL_ID_PARAM = String(SCHOOL_ID);

const getApiBaseUrl = () => {
  const url = API_URL.trim();
  // Web browser: ensure we use localhost (not Android emulator address)
  if (Platform.OS === 'web' && url.includes('10.0.2.2')) {
    return url.replace('10.0.2.2', 'localhost');
  }
  // Android emulator: needs 10.0.2.2 to reach host machine's localhost
  if (Platform.OS === 'android' && url.includes('localhost')) {
    return url.replace('localhost', '10.0.2.2');
  }
  return url;
};

const API_BASE_URL = getApiBaseUrl();

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// ── Token storage helpers ──────────────────────────────────────────────
// Use SecureStore for tokens to guarantee encryption on device.
// Limits are respected since JWT tokens generally won't exceed SecureStore's 2048-byte limit across most identities.
async function tokenGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}
async function tokenSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}
async function tokenDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key).catch(() => { });
  }
}

// Token management
export async function getAccessToken(): Promise<string | null> {
  return await tokenGet(TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await tokenSet(TOKEN_KEY, accessToken);
  await tokenSet(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await tokenDelete(TOKEN_KEY);
  await tokenDelete(REFRESH_TOKEN_KEY);
  // Also clear additional auth fields
  await tokenDelete('user_id').catch(() => { });
  await tokenDelete('user_role').catch(() => { });
  await tokenDelete('session_expiry').catch(() => { });
}

// Global Logout Callback to avoid circular dependency
let logoutCallback: (() => Promise<void>) | null = null;

export const registerLogoutCallback = (fn: () => Promise<void>) => {
  logoutCallback = fn;
};

// Single-flight refresh promise to prevent parallel redundant refreshes
let refreshPromise: Promise<any> | null = null;

// API Error class
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errors?: Record<string, string[]>,
    public requestId?: string,
    public code?: string) {
    super(message);
    this.name = 'APIError';
  }

  // Compatibility getter
  get status() {
    return this.statusCode;
  }
}

// Generic API request function
export interface APIOptions extends RequestInit {
  silent?: boolean;
  _isRetry?: boolean;
  _retryCount?: number; // tracks 503 retry attempts
}

export async function apiRequest<T>(
  endpoint: string,
  options: APIOptions = {})
  : Promise<T> {
  const { silent, _isRetry, _retryCount = 0, ...fetchOptions } = options;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  if (__DEV__) {
    console.log(`[apiClient] ${fetchOptions.method || 'GET'} ${endpoint} — session: ${session ? 'YES' : 'NULL'}, token: ${token ? token.substring(0, 15) + '...' : 'NULL'}`);
  }

  // Add a 60-second timeout to prevent fetch from hanging indefinitely on Android but allow Render backend to wake up
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const method = (fetchOptions.method || 'GET').toUpperCase();

  // SchoolIMS: every request MUST include school_id (GET/DELETE: query; POST/PUT/PATCH: body)
  let finalEndpoint = endpoint;
  let finalBody = fetchOptions.body;

  if (method === 'GET' || method === 'DELETE') {
    const sep = endpoint.includes('?') ? '&' : '?';
    finalEndpoint = `${endpoint}${sep}school_id=${encodeURIComponent(SCHOOL_ID_PARAM)}`;
  } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const parsed = fetchOptions.body ? JSON.parse(fetchOptions.body as string) : {};
    finalBody = JSON.stringify({ school_id: SCHOOL_ID_PARAM, ...parsed });
  }

  const url = `${API_BASE_URL}${finalEndpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      body: finalBody,
      headers,
      // @ts-ignore - React Native setup might not have full AbortSignal types
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const requestId = response.headers.get('x-request-id') || response.headers.get('request-id') || undefined;

    // Handle different status codes
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle unauthorized (401)
      if (response.status === 401) {

        // 1. IGNORE Login/Refresh endpoints (invalid credentials, not session expiry)
        if (endpoint.includes('/login') || endpoint.includes('/refresh')) {
          if (!silent) alertFn('Login Failed', errorData.error || 'Invalid credentials');
          throw new APIError(
            errorData.error || 'Invalid credentials',
            401,
            undefined,
            requestId
          );
        }

        // 2. TOKEN REFRESH LOGIC (Infinity Session)
        // If it's a 401 and NOT a retry, attempt to refresh the session
        if (!_isRetry) {
          if (__DEV__) { }

          try {
            // Try backend refresh FIRST (single source of truth for session validity)
            const storedRefreshToken = await tokenGet(REFRESH_TOKEN_KEY);
            if (storedRefreshToken) {
              try {
                const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ school_id: SCHOOL_ID_PARAM, refresh_token: storedRefreshToken }),
                });
                if (refreshResponse.ok) {
                  const refreshBody = await refreshResponse.json();
                  const refreshData = refreshBody?.data ?? refreshBody;
                  await setTokens(refreshData.token, refreshData.refresh_token);
                  // Sync with Supabase client
                  await supabase.auth.setSession({
                    access_token: refreshData.token,
                    refresh_token: refreshData.refresh_token,
                  });
                  if (__DEV__) { }
                  // Retry the original request with new token
                  return await apiRequest<T>(endpoint, {
                    ...options,
                    _isRetry: true,
                    headers: {
                      ...options.headers,
                      'Authorization': `Bearer ${refreshData.token}`
                    }
                  });
                }
              } catch (backendRefreshErr) {
                if (__DEV__) { }
                // Fall through to Supabase client-side refresh
              }
            }

            // Fallback: Use Supabase client-side refresh (single-flight)
            if (!refreshPromise) {
              refreshPromise = supabase.auth.refreshSession().finally(() => {
                refreshPromise = null;
              });
            }

            const { data, error: refreshError } = await refreshPromise;

            if (!refreshError && data.session) {
              if (__DEV__) { }

              // Update local storage tokens
              await setTokens(data.session.access_token, data.session.refresh_token);

              // Retry the original request with new token
              return await apiRequest<T>(endpoint, {
                ...options,
                _isRetry: true,
                headers: {
                  ...options.headers,
                  'Authorization': `Bearer ${data.session.access_token}`
                }
              });
            } else {

              if (!data?.session) { }
            }
          } catch (refreshErr) {

          }
        }

        // 3. Network-aware logout decision
        // CRITICAL: Do NOT logout if the device is offline

        // Do a fresh active check just in case the cached state is wrong
        const netState = await NetInfo.fetch();
        const isOnline = netState.isConnected && netState.isInternetReachable !== false;

        if (!isOnline) {
          if (__DEV__) { }
          if (silent) return null as T;
          throw new APIError('Network unavailable. Logging suspended.', 0, undefined, requestId);
        }

        // Silent requests (e.g. background token sync) should NOT trigger logout
        if (silent) {
          return null as T;
        }

        // Only trigger logout if we are genuinely online and the token is rejected
        if (logoutCallback) {
          // Small delay to ensure no inflight token writes are happening
          setTimeout(() => {
            logoutCallback?.();
          }, 1000);
        }

        throw new APIError('Session expired. Please login again.', 401, undefined, requestId);
      }

      // Handle Service Unavailable (503) — transient backend timeout
      if (response.status === 503) {
        if (_retryCount < 2) {
          if (__DEV__) { }
          await new Promise((r) => setTimeout(r, 1500));
          return await apiRequest<T>(endpoint, {
            ...options,
            _retryCount: _retryCount + 1
          });
        }
        const message = errorData.error || 'Server temporarily unavailable. Please try again.';
        if (!silent) alertFn('Service Unavailable', message);
        throw new APIError(message, 503, undefined, requestId);
      }

      // Handle validation errors (422) and B1-style 400 (school_id required)
      if (response.status === 422 || response.status === 400) {
        const rawError = errorData.error || errorData.message;
        const message = rawError === 'school_id is required'
          ? 'Tenant context missing. Please restart the app and try again.'
          : (errorData.message || rawError || 'Validation failed');
        if (!silent) {
          alertFn('Error', message);
        }
        throw new APIError(
          message,
          response.status,
          errorData.errors,
          requestId
        );
      }

      // Handle Rate Limit (429)
      if (response.status === 429) {
        const message = errorData.error || errorData.message || 'Rate limit exceeded. Please try again later.';
        if (!silent) alertFn('Too Many Requests', message);

        throw new APIError(message, 429, undefined, requestId);
      }

      // Handle forbidden (403)
      if (response.status === 403) {
        const message = errorData.error || errorData.message || 'Access denied';
        const code = errorData.code;
        if (!silent) alertFn('Access Denied', message);
        throw new APIError(message, 403, undefined, requestId, code);
      }

      // Generic error
      const genericMsg = errorData.message || errorData.error || 'Request failed';

      if (!silent) alertFn('Error', `${genericMsg}\n\nCode: ${response.status}\nID: ${requestId || 'N/A'}`);
      throw new APIError(
        genericMsg,
        response.status,
        undefined,
        requestId
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    const json = await response.json();

    // SchoolIMS F4: validate school_id in response matches build-time tenant
    if (json && typeof json.school_id !== 'undefined' && String(json.school_id) !== SCHOOL_ID_PARAM) {
      throw new APIError('Tenant mismatch — response school_id does not match this app. Abort.', 403);
    }

    // SchoolIMS: unwrap { success, school_id, data } envelope so callers receive payload directly
    if (json && json.success === true && 'data' in json) {
      return json.data as T;
    }

    return json as T;
  } catch (error: any) {
    if (error instanceof APIError) {
      throw error;
    }

    if (error?.name === 'AbortError') {
      if (!silent) alertFn('Network Timeout', 'The server took too long to respond. Please check your internet connection or try again later.');
      throw new APIError('Request timed out. Please try again.');
    }

    // Network error
    if (!silent) alertFn('Network Error', 'Please check your internet connection.');
    throw new APIError('Network error. Please check your connection.');
  }
}

// Helper methods for common HTTP verbs
export const api = {
  get: <T,>(endpoint: string, params?: Record<string, any>, options?: APIOptions): Promise<T> => {
    let queryString = '';
    if (params) {
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined)
      );
      queryString = '?' + new URLSearchParams(cleanParams).toString();
    }
    return apiRequest<T>(`${endpoint}${queryString}`, { method: 'GET', ...options });
  },

  post: <T,>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  },

  put: <T,>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  },

  patch: <T,>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  },

  delete: <T,>(endpoint: string, options?: APIOptions): Promise<T> => {
    return apiRequest<T>(endpoint, { method: 'DELETE', ...options });
  }
};