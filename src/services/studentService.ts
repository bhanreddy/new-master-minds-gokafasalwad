import { api } from './apiClient';
import type {
    Student,
    StudentEnrollment,
    AttendanceResponse,
    FeeResponse,
    Parent,
    AttendanceSummary,
} from '../types/models';

/** Aggregated payload from GET /student/dashboard (one HTTP call for the student home tab). */
export interface StudentDashboardResponse {
    profile: Student;
    notices: unknown[];
    attendance: {
        summary: AttendanceSummary | null;
        latest_record: { attendance_date: string; status: string } | null;
    };
    upcoming_fee: unknown | null;
    timetable_today: unknown[];
}

// API Request/Response types matching Backend logic
export interface CreateStudentRequest {
    first_name: string;
    middle_name?: string;
    last_name: string;
    dob?: string;
    gender_id: number;
    admission_no: string;
    admission_date: string;
    status_id: number;
    category_id: number;
    religion_id: number;
    blood_group_id: number;
    email?: string;
    phone?: string;
    password?: string;
    role_code?: string;
    class_id: string;
    section_id: string;
    academic_year_id: string;
    parents?: Parent[];
}

export interface UpdateStudentRequest {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    password?: string;
}

export const StudentService = {
    /**
     * Get paginated list of students
     */
    getAll: async <T = Student>(params?: {
        search?: string;
        limit?: number;
        page?: number;
        class_id?: string;
        section_id?: string;
        status_id?: number | string;
        sort_by?: 'name' | 'roll_number' | 'admission_no';
        sort_order?: 'asc' | 'desc';
    }): Promise<{ data: T[]; meta?: { total: number; page: number; limit: number; total_pages: number } }> => {
        return api.get<{ data: T[]; meta?: any }>('/students', params);
    },

    /**
     * Get all available student statuses
     */
    getStatuses: async (): Promise<{ id: number; name: string }[]> => {
        return api.get<{ id: number; name: string }[]>('/students/statuses');
    },

    /**
     * Search students by name or admission number
     */
    search: async (query: string): Promise<Student[]> => {
        const response = await api.get<{ data: Student[] }>('/students', { search: query, limit: 5 });
        // Handle both array response and { data: [] } response formats from paginated API
        if (Array.isArray(response)) return response;
        return response.data || [];
    },

    /**
     * Get single student with full details
     */
    getById: async (id: string): Promise<Student> => {
        return api.get<Student>(`/students/${id}`);
    },

    /**
     * Get current student profile (My Profile)
     */
    getProfile: async (): Promise<Student> => {
        return api.get<Student>('/students/profile/me');
    },

    getDashboard: async (): Promise<StudentDashboardResponse> => {
        return api.get<StudentDashboardResponse>('/student/dashboard');
    },

    /**
     * Create new student
     */
    create: async (data: CreateStudentRequest): Promise<Student> => {
        return api.post<Student>('/students', data);
    },

    /**
     * Update student
     */
    update: async (id: string, data: UpdateStudentRequest): Promise<Student> => {
        return api.put<Student>(`/students/${id}`, data);
    },

    /**
     * Get student enrollments
     */
    getEnrollments: async (id: string): Promise<StudentEnrollment[]> => {
        return api.get<StudentEnrollment[]>(`/students/${id}/enrollments`);
    },

    /**
     * Get student attendance with summary
     */
    getAttendance: async (
        id: string,
        params?: { from_date?: string; to_date?: string; limit?: number }
    ): Promise<AttendanceResponse> => {
        return api.get<AttendanceResponse>(`/students/${id}/attendance`, params);
    },

    /**
     * Get student fees
     */
    getFees: async (id: string, params?: { page?: number; limit?: number; academic_year_id?: string }): Promise<FeeResponse & { meta?: { total: number; page: number; limit: number; total_pages: number } }> => {
        return api.get(`/students/${id}/fees`, params);
    },

    /**
     * Get students without active enrollment
     */
    getUnenrolledStudents: async (academicYearId?: number): Promise<Student[]> => {
        let url = '/students/unenrolled';
        if (academicYearId) {
            url += `?academic_year_id=${academicYearId}`;
        }
        return api.get<Student[]>(url);
    },

    /**
     * Manuall Enroll Student
     */
    enrollStudent: async (studentId: number, data: { class_id: number, section_id: number, academic_year_id?: number }): Promise<any> => {
        return api.post<any>(`/students/${studentId}/enrollments`, data);
    },

    /**
     * Delete a student
     */
    delete: async (id: string): Promise<any> => {
        return api.delete(`/students/${id}`);
    },

    /**
     * Get student results (Typed as any for now, strict type available in backend check)
     */
    getResults: async (id: string): Promise<any> => {
        return api.get<any>(`/students/${id}/results`);
    },
};
