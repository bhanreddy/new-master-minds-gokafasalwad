import { api } from './apiClient';
import { Platform } from 'react-native';
import type {
    Student,
    StudentEnrollment,
    AttendanceResponse,
    FeeResponse,
    Parent,
    AttendanceSummary,
} from '../types/models';
import { sortStudentFeesByConfiguredOrder } from '../utils/feeOrdering';
import { prepareStudentPhoto, STUDENT_PHOTO_MAX_BYTES } from '../utils/studentPhoto';

/** Aggregated payload from GET /student/dashboard (one HTTP call for the student home tab). */
export interface StudentDashboardResponse {
    profile: Student;
    notices: unknown[];
    attendance: {
        summary: AttendanceSummary | null;
        latest_record: {
            attendance_date: string;
            status: string;
            morning_status?: string | null;
            afternoon_status?: string | null;
        } | null;
    };
    upcoming_fee: unknown | null;
    timetable_today: unknown[];
}

// API Request/Response types matching Backend logic
export interface CreateStudentRequest {
    first_name: string;
    middle_name?: string;
    last_name?: string | null;
    dob?: string;
    gender_id: number;
    admission_no: string;
    pen_number?: string;
    apar_number?: string | null;
    village?: string | null;
    aadhaar_number?: string | null;
    tc_number?: string | null;
    previous_school?: boolean | null;
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
    middle_name?: string;
    last_name?: string | null;
    dob?: string;
    gender_id?: number;
    admission_no?: string;
    pen_number?: string;
    apar_number?: string | null;
    village?: string | null;
    aadhaar_number?: string | null;
    tc_number?: string | null;
    previous_school?: boolean | null;
    admission_date?: string;
    status_id?: number;
    category_id?: number;
    religion_id?: number;
    blood_group_id?: number;
    phone?: string;
    email?: string;
    password?: string;
    role_code?: string;
    class_id?: string;
    section_id?: string;
    academic_year_id?: string;
    parents?: Parent[];
}

export interface SaveStudentResponse {
    message?: string;
    student: Student;
}

export interface StudentPhotoResponse {
    message?: string;
    photo_url: string | null;
    photo_size_bytes?: number;
}

export interface StudentHardDeletePreview {
    has_fee_records: boolean;
    fee_record_count: number;
    active_fee_record_count: number;
    payment_transaction_count: number;
    receipt_count: number;
    related_financial_record_count: number;
    total_due: number;
    total_discount: number;
    total_paid: number;
    balance: number;
}

export interface AdmissionNumberSuggestion {
    type: 'dummy' | 'permanent';
    current_max: string;
    next_number: string;
    next_admission_no: string;
}

async function buildStudentPhotoFormData(uri: string): Promise<FormData> {
    let processedUri = uri;
    try {
        const processed = await prepareStudentPhoto(uri);
        if (processed.sizeBytes > STUDENT_PHOTO_MAX_BYTES) {
            throw new Error('Student photo is still larger than 100 KB after compression.');
        }
        processedUri = processed.uri;
    } catch {
        // Some platform-specific formats cannot be decoded by the Expo client.
        // Send the original in that case: the backend is the final authority and
        // will reject invalid images or store a normalised JPEG <= 100 KiB.
    }

    const formData = new FormData();
    if (Platform.OS === 'web') {
        const response = await fetch(processedUri);
        const blob = await response.blob();
        if (processedUri !== uri && blob.size > STUDENT_PHOTO_MAX_BYTES) {
            throw new Error('Student photo exceeds the 100 KB upload limit after compression.');
        }
        formData.append('photo', blob, 'student-avatar.jpg');
    } else {
        formData.append('photo', {
            uri: processedUri,
            name: 'student-avatar.jpg',
            type: 'image/jpeg',
        } as any);
    }
    return formData;
}

export interface StudentListParams {
    search?: string;
    limit?: number;
    page?: number;
    class_id?: string;
    section_id?: string;
    academic_year_id?: string;
    status_id?: number | string;
    /** Exact generated admission-number format to include. */
    admission_type?: 'dummy' | 'permanent';
    /** Active roster, retained passed-out/withdrawn archive, or all records. */
    lifecycle?: 'active' | 'archived' | 'all';
    sort_by?: 'name' | 'roll_number' | 'admission_no';
    sort_order?: 'asc' | 'desc';
}

export interface StudentListPage<T = Student> {
    data: T[];
    meta?: { total: number; page: number; limit: number; total_pages: number };
}

export const StudentService = {
    /**
     * Get paginated list of students
     */
    getAll: async <T = Student>(params?: StudentListParams): Promise<StudentListPage<T>> => {
        return api.get<StudentListPage<T>>('/students', params);
    },

    /** Fetch every page for complete user directories and full-dataset searches. */
    getAllPages: async <T = Student>(params?: Omit<StudentListParams, 'page'>): Promise<T[]> => {
        const limit = Math.min(100, Math.max(1, params?.limit ?? 100));
        const allRows: T[] = [];
        let page = 1;

        while (true) {
            const res = await api.get<StudentListPage<T> | T[]>('/students', {
                ...params,
                page,
                limit,
            });
            const rows = Array.isArray(res) ? res as T[] : res?.data ?? [];
            allRows.push(...rows);

            // A bare array is only possible with a legacy backend and represents
            // the complete response because it has no pagination metadata.
            if (Array.isArray(res)) break;

            const totalPages = Number(res?.meta?.total_pages) || 1;
            const total = Number(res?.meta?.total) || allRows.length;
            if (page >= totalPages || allRows.length >= total || rows.length === 0) break;
            page += 1;
        }

        return allRows;
    },

    /**
     * Get all available student statuses
     */
    getStatuses: async (): Promise<{ id: number; name: string; code: string }[]> => {
        return api.get<{ id: number; name: string; code: string }[]>('/students/statuses');
    },

    /** Get the next school-scoped generated admission number for a selected type. */
    getNextAdmissionNumber: async (
        type: 'dummy' | 'permanent',
    ): Promise<AdmissionNumberSuggestion> => {
        return api.get<AdmissionNumberSuggestion>('/students/admission-number/next', { type });
    },

    /**
     * Search students by name or admission number
     */
    search: async (
        query: string,
        limit = 5,
        options: { lifecycle?: StudentListParams['lifecycle'] } = { lifecycle: 'active' },
    ): Promise<Student[]> => {
        const response = await api.get<{ data: Student[] }>('/students', {
            search: query,
            limit,
            lifecycle: options.lifecycle ?? 'active',
        });
        // Handle both array response and { data: [] } response formats from paginated API
        if (Array.isArray(response)) return response;
        return response.data || [];
    },

    /**
     * Resolve a student from a name, admission number, or UUID.
     * Returns null when ambiguous (multiple partial matches).
     */
    resolveByQuery: async (query: string): Promise<Student | null> => {
        const resolution = await StudentService.resolveSearchQuery(query);
        return resolution.status === 'found' ? resolution.student : null;
    },

    /**
     * Resolve a search query, distinguishing exact matches from ambiguous ones.
     */
    resolveSearchQuery: async (
        query: string,
    ): Promise<
        | { status: 'found'; student: Student }
        | { status: 'ambiguous'; students: Student[] }
        | { status: 'not_found' }
    > => {
        const trimmed = query.trim();
        if (!trimmed) return { status: 'not_found' };

        const results = await StudentService.search(trimmed);
        if (results.length > 0) {
            const normalized = trimmed.toLowerCase();
            const exactAdmissionMatches = results.filter((s) => s.admission_no === trimmed);
            if (exactAdmissionMatches.length === 1) {
                return { status: 'found', student: exactAdmissionMatches[0] };
            }
            if (exactAdmissionMatches.length > 1) {
                return { status: 'ambiguous', students: exactAdmissionMatches };
            }

            const exactNameMatches = results.filter((s) => {
                const displayName = s.display_name?.toLowerCase() ?? '';
                const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ').trim().toLowerCase();
                return displayName === normalized || fullName === normalized;
            });
            if (exactNameMatches.length === 1) {
                return { status: 'found', student: exactNameMatches[0] };
            }
            if (exactNameMatches.length > 1) {
                return { status: 'ambiguous', students: exactNameMatches };
            }

            if (results.length === 1) return { status: 'found', student: results[0] };

            return { status: 'ambiguous', students: results };
        }

        try {
            const student = await StudentService.getById(trimmed);
            return { status: 'found', student };
        } catch {
            return { status: 'not_found' };
        }
    },

    /**
     * Get single student with full details
     */
    /** Get single student with full details (silent for certificate flows). */
    getById: async (id: string, options?: { silent?: boolean }): Promise<Student> => {
        return api.get<Student>(`/students/${id}`, undefined, options);
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
    create: async (data: CreateStudentRequest): Promise<SaveStudentResponse> => {
        return api.post<SaveStudentResponse>('/students', data);
    },

    /**
     * Update student
     */
    update: async (id: string, data: UpdateStudentRequest): Promise<{ message?: string; student?: Student; success?: boolean }> => {
        return api.put<{ message?: string; student?: Student; success?: boolean }>(`/students/${id}`, data);
    },

    /**
     * Upload/replace a student's photo. This is deliberately separate from the
     * self-service /users/me/photo route so an operator never overwrites their
     * own profile while editing a student.
     */
    uploadPhoto: async (id: string, uri: string): Promise<string> => {
        const formData = await buildStudentPhotoFormData(uri);
        const result = await api.uploadFormData<StudentPhotoResponse>(`/students/${id}/photo`, formData, {
            timeoutMs: 60000,
        });
        return result.photo_url || '';
    },

    removePhoto: async (id: string): Promise<void> => {
        await api.delete(`/students/${id}/photo`);
    },

    /**
     * Get student enrollments
     */
    getEnrollments: async (id: string, options?: { silent?: boolean }): Promise<StudentEnrollment[]> => {
        return api.get<StudentEnrollment[]>(`/students/${id}/enrollments`, undefined, options);
    },

    getParents: async (id: string, options?: { silent?: boolean }): Promise<Parent[]> => {
        return api.get<Parent[]>(`/students/${id}/parents`, undefined, options);
    },

    /**
     * Get student attendance with summary
     */
    getAttendance: async (
        id: string,
        params?: { from_date?: string; to_date?: string; limit?: number },
        options?: { silent?: boolean },
    ): Promise<AttendanceResponse> => {
        return api.get<AttendanceResponse>(`/students/${id}/attendance`, params, options);
    },

    /**
     * Get student fees
     */
    getFees: async (id: string, params?: { page?: number; limit?: number; academic_year_id?: string }): Promise<FeeResponse & { meta?: { total: number; page: number; limit: number; total_pages: number } }> => {
        const result = await api.get<FeeResponse & { meta?: { total: number; page: number; limit: number; total_pages: number } }>(
            `/students/${id}/fees`,
            params,
        );
        return {
            ...result,
            fees: sortStudentFeesByConfiguredOrder(result.fees || []),
        };
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
     * Check for fee/payment history before starting the permanent-delete flow.
     */
    getHardDeletePreview: async (id: string): Promise<StudentHardDeletePreview> => {
        return api.get<StudentHardDeletePreview>(`/students/${id}/hard-delete-preview`, undefined, { silent: true });
    },

    /**
     * PERMANENTLY delete a student and ALL of their data (fees, receipts, marks,
     * attendance, transport, parent links, login accounts…). Irreversible.
     * Requires explicit confirmation — the caller must have run the multi-step
     * confirmation flow before invoking this.
     */
    hardDelete: async (id: string, confirmFeeDeletion = false): Promise<{ stats?: Record<string, number>; authFailures?: unknown[] }> => {
        return api.post(
            `/students/${id}/hard-delete`,
            {
                confirm: true,
                confirm_fee_deletion: confirmFeeDeletion,
            },
            { silent: true },
        );
    },

    /**
     * Get student results (Typed as any for now, strict type available in backend check)
     */
    getResults: async (id: string, academicYearId?: string): Promise<any> => {
        return api.get<any>(`/students/${id}/results`, academicYearId
            ? { academic_year_id: academicYearId }
            : undefined);
    },
};
