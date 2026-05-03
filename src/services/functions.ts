import { api } from './apiClient';

/**
 * Functions service for admin operations like creating/updating users
 * These call server-side endpoints that use Supabase Admin API
 */

export interface CreateUserRequest {
    email: string;
    password: string;
    name: string;
    role: 'staff' | 'student' | 'teacher' | 'admin';
    phone?: string;
    designation?: string;
    department?: string;
    salary?: string;
}

export interface UpdateUserRequest {
    id: string;
    email?: string;
    name?: string;
    role?: string;
    phone?: string;
    designation?: string;
    department?: string;
    salary?: string;
}

export interface UserResponse {
    id: string;
    email: string;
    name: string;
    role: string;
}

export const Functions = {
    /**
     * Create a new staff member via admin API
     */
    createStaff: async (data: CreateUserRequest): Promise<UserResponse> => {
        return api.post<UserResponse>('/users', {
            ...data,
            role: 'staff',
        });
    },

    /**
     * Update an existing staff member
     */
    updateStaff: async (data: UpdateUserRequest): Promise<UserResponse> => {
        const { id, ...updateData } = data;
        return api.put<UserResponse>(`/users/${id}`, updateData);
    },

    /**
     * Create a new student via admin API
     */
    createStudent: async (data: CreateUserRequest): Promise<UserResponse> => {
        return api.post<UserResponse>('/users', {
            ...data,
            role: 'student',
        });
    },

    /**
     * Update an existing student
     */
    updateStudent: async (data: UpdateUserRequest): Promise<UserResponse> => {
        const { id, ...updateData } = data;
        return api.put<UserResponse>(`/users/${id}`, updateData);
    },

    /**
     * Create a new teacher via admin API
     */
    createTeacher: async (data: CreateUserRequest): Promise<UserResponse> => {
        return api.post<UserResponse>('/users', {
            ...data,
            role: 'teacher',
        });
    },

    /**
     * Update an existing teacher
     */
    updateTeacher: async (data: UpdateUserRequest): Promise<UserResponse> => {
        const { id, ...updateData } = data;
        return api.put<UserResponse>(`/users/${id}`, updateData);
    },

    /**
     * Delete a user by ID
     */
    deleteUser: async (id: string): Promise<void> => {
        return api.delete<void>(`/users/${id}`);
    },
};
