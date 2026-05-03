import { api, setTokens, clearTokens } from './apiClient';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    session: {
        access_token: string;
        refresh_token: string;
    };
    user: {
        id: string;
        email: string;
    };
}

export interface CurrentUser {
    id: string;
    internal_id: string;
    display_name: string;
    email?: string;
    photo_url?: string;
    roles: string[];
    permissions: string[];
}

export const BackendAuthService = {
    /**
     * Login with email and password
     */
    login: async (email: string, password: string): Promise<void> => {
        const response = await api.post<LoginResponse>('/auth/login', {
            email,
            password,
        });

        // Store tokens
        await setTokens(response.session.access_token, response.session.refresh_token);
    },

    /**
     * Logout
     */
    logout: async (): Promise<void> => {
        try {
            await api.post<void>('/auth/logout');
        } finally {
            // Clear tokens even if API call fails
            await clearTokens();
        }
    },

    /**
     * Get current authenticated user
     */
    getCurrentUser: async (): Promise<CurrentUser> => {
        return api.get<CurrentUser>('/auth/me');
    },

    /**
     * Forgot password
     */
    forgotPassword: async (email: string): Promise<{ message: string }> => {
        return api.post<{ message: string }>('/auth/forgot-password', { email });
    },

    /**
     * Reset password
     */
    resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
        return api.post<{ message: string }>('/auth/reset-password', {
            token,
            password,
        });
    },

    /**
     * Check if user has permission
     */
    hasPermission: (user: CurrentUser, permission: string): boolean => {
        return user.permissions.includes(permission) || user.roles.includes('admin');
    },

    /**
     * Check if user has any of the specified roles
     */
    hasAnyRole: (user: CurrentUser, roles: string[]): boolean => {
        return roles.some(role => user.roles.includes(role));
    },
};
