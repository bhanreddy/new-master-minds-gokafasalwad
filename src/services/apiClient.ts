import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { supabase } from './supabaseConfig';
import { SessionManager } from './sessionManager';
import NetInfo from '@react-native-community/netinfo';

const getApiBaseUrl = () => {
    let url = (process.env.EXPO_PUBLIC_API_URL || 'https://supabasebackend-c442.onrender.com/api/v1').trim();
    if (Platform.OS === 'web' && url.includes('10.0.2.2')) {
        url = url.replace('10.0.2.2', 'localhost');
    }
    return url;
};

const API_BASE_URL = getApiBaseUrl();
console.log('DEBUG: API_BASE_URL is:', API_BASE_URL);

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Token management
export async function getAccessToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
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
        public requestId?: string
    ) {
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
    options: APIOptions = {}
): Promise<T> {
    const { silent, _isRetry, _retryCount = 0, ...fetchOptions } = options;
    const token = await getAccessToken();

    // Add a 60-second timeout to prevent fetch from hanging indefinitely on Android but allow Render backend to wake up
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers as Record<string, string>),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            headers,
            // @ts-ignore - React Native setup might not have full AbortSignal types
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const requestId = response.headers.get('x-request-id') || response.headers.get('request-id') || undefined;

        // Handle different status codes
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Handle unauthorized (401)
            if (response.status === 401) {
                console.log(`[API] 401 Unauthorized at ${endpoint}. Request ID: ${requestId}`);
                console.log(`[API] 401 Error Body:`, JSON.stringify(errorData));

                // 1. IGNORE Login/Refresh endpoints (invalid credentials, not session expiry)
                if (endpoint.includes('/login') || endpoint.includes('/refresh')) {
                    if (!silent) Alert.alert('Login Failed', errorData.error || 'Invalid credentials');
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
                    if (__DEV__) console.log('[API] Attempting token refresh after 401...');

                    try {
                        // Use single-flight promise to avoid duplicate refreshes
                        if (!refreshPromise) {
                            refreshPromise = supabase.auth.refreshSession().finally(() => {
                                refreshPromise = null;
                            });
                        }

                        const { data, error: refreshError } = await refreshPromise;

                        if (!refreshError && data.session) {
                            if (__DEV__) console.log('[API] Token refresh successful. Retrying original request.');

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
                            console.error('[API] Refresh failed:', refreshError);
                            if (!data?.session) console.error('[API] No session returned after refresh.');
                        }
                    } catch (refreshErr) {
                        console.error('[API] Unexpected error during token refresh:', refreshErr);
                    }
                }

                // 3. Network-aware logout decision
                // CRITICAL: Do NOT logout if the device is offline

                // Do a fresh active check just in case the cached state is wrong
                const netState = await NetInfo.fetch();
                const isOnline = netState.isConnected && netState.isInternetReachable !== false;

                if (!isOnline) {
                    if (__DEV__) console.log('[API] Device offline — suppressing 401 logout, keeping session alive');
                    if (silent) return null as T;
                    throw new APIError('Network unavailable. Logging suspended.', 0, undefined, requestId);
                }

                // Only trigger logout if we are genuinely online and the token is rejected
                if (logoutCallback) {
                    if (!silent) console.warn('[API] Session expired or refresh failed, triggering global logout.');
                    // Small delay to ensure no inflight token writes are happening
                    setTimeout(() => {
                        logoutCallback?.();
                    }, 1000);
                }

                if (silent) {
                    return null as T;
                }

                throw new APIError('Session expired. Please login again.', 401, undefined, requestId);
            }

            // Handle Service Unavailable (503) — transient backend timeout
            if (response.status === 503) {
                if (_retryCount < 2) {
                    if (__DEV__) console.log(`[API] 503 Service Unavailable at ${endpoint}. Retrying (${_retryCount + 1}/2)...`);
                    await new Promise(r => setTimeout(r, 1500));
                    return await apiRequest<T>(endpoint, {
                        ...options,
                        _retryCount: _retryCount + 1,
                    });
                }
                const message = errorData.error || 'Server temporarily unavailable. Please try again.';
                if (!silent) Alert.alert('Service Unavailable', message);
                throw new APIError(message, 503, undefined, requestId);
            }

            // Handle validation errors (422)
            if (response.status === 422 || response.status === 400) {
                const message = errorData.message || errorData.error || 'Validation failed';
                if (!silent) {
                    Alert.alert('Error', message);
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
                if (!silent) Alert.alert('Too Many Requests', message);
                console.warn(`[API] Rate Limited (429): ${message}`);
                throw new APIError(message, 429, undefined, requestId);
            }

            // Handle forbidden (403)
            if (response.status === 403) {
                const message = errorData.error || errorData.message || 'Access denied';
                if (!silent) Alert.alert('Access Denied', message);
                throw new APIError(message, 403, undefined, requestId);
            }

            // Generic error
            const genericMsg = errorData.message || errorData.error || 'Request failed';
            console.error(`[API Error] ${response.status} ${endpoint} (Request ID: ${requestId}):`, errorData);
            if (!silent) Alert.alert('Error', `${genericMsg}\n\nCode: ${response.status}\nID: ${requestId || 'N/A'}`);
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

        return await response.json();
    } catch (error: any) {
        if (error instanceof APIError) {
            throw error;
        }

        if (error?.name === 'AbortError') {
            if (!silent) Alert.alert('Network Timeout', 'The server took too long to respond. Please check your internet connection or try again later.');
            throw new APIError('Request timed out. Please try again.');
        }

        // Network error
        if (!silent) Alert.alert('Network Error', 'Please check your internet connection.');
        throw new APIError('Network error. Please check your connection.');
    }
}

// Helper methods for common HTTP verbs
export const api = {
    get: <T>(endpoint: string, params?: Record<string, any>, options?: APIOptions): Promise<T> => {
        let queryString = '';
        if (params) {
            const cleanParams = Object.fromEntries(
                Object.entries(params).filter(([_, v]) => v !== undefined)
            );
            queryString = '?' + new URLSearchParams(cleanParams).toString();
        }
        return apiRequest<T>(`${endpoint}${queryString}`, { method: 'GET', ...options });
    },

    post: <T>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
        return apiRequest<T>(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
            ...options
        });
    },

    put: <T>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
        return apiRequest<T>(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
            ...options
        });
    },

    patch: <T>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
        return apiRequest<T>(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
            ...options
        });
    },

    delete: <T>(endpoint: string, options?: APIOptions): Promise<T> => {
        return apiRequest<T>(endpoint, { method: 'DELETE', ...options });
    },
};
