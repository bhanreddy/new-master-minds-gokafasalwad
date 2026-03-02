import { api } from './apiClient';
import { Notice, NoticeAudience, Complaint } from '../types/models';
export { Notice, NoticeAudience, Complaint };

// ============================================================================
// COMPLAINTS
// ============================================================================

export interface CreateComplaintRequest {
    title: string;
    description: string;
    category?: string;
    priority?: string;
    raised_for_student_id?: string;
}

export const ComplaintService = {
    getAll: async (params?: { status?: string }): Promise<Complaint[]> => {
        return api.get<Complaint[]>('/complaints', params);
    },

    getById: async (id: string): Promise<Complaint> => {
        return api.get<Complaint>(`/complaints/${id}`);
    },

    getStudentComplaints: async (studentId: string): Promise<Complaint[]> => {
        return api.get<Complaint[]>('/complaints', { raised_for_student_id: studentId });
    },

    create: async (data: CreateComplaintRequest): Promise<Complaint> => {
        return api.post<Complaint>('/complaints', data);
    },

    update: async (id: string, data: Partial<Complaint>): Promise<Complaint> => {
        return api.put<Complaint>(`/complaints/${id}`, data);
    },

    delete: async (id: string): Promise<void> => {
        return api.delete<void>(`/complaints/${id}`);
    },
};

// ============================================================================
// NOTICES
// ============================================================================



export interface CreateNoticeRequest {
    title: string;
    content: string;
    audience: NoticeAudience;
    target_class_id?: string;
    priority?: string;
    is_pinned?: boolean;
    publish_at?: string;
    expires_at?: string;
}

export const NoticeService = {
    getAll: async (params?: { audience?: NoticeAudience }): Promise<Notice[]> => {
        return api.get<Notice[]>('/notices', params);
    },

    getById: async (id: string): Promise<Notice> => {
        return api.get<Notice>(`/notices/${id}`);
    },

    create: async (data: CreateNoticeRequest): Promise<Notice> => {
        return api.post<Notice>('/notices', data);
    },

    update: async (id: string, data: Partial<Notice>): Promise<Notice> => {
        return api.put<Notice>(`/notices/${id}`, data);
    },

    delete: async (id: string): Promise<void> => {
        return api.delete<void>(`/notices/${id}`);
    },
};

// ============================================================================
// LEAVES
// ============================================================================

export interface LeaveApplication {
    id: string;
    leave_type: 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'unpaid' | 'other';
    start_date: string;
    end_date: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    applied_by: string;
    approved_by?: string;
    total_days: number;
    created_at: string;
    applicant_name?: string;
    applicant_role?: string;
    reviewed_by_name?: string;
}

export interface CreateLeaveRequest {
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
}

export const LeaveService = {
    getAll: async (params?: { status?: string }): Promise<LeaveApplication[]> => {
        return api.get<LeaveApplication[]>('/leaves', params);
    },

    getById: async (id: string): Promise<LeaveApplication> => {
        return api.get<LeaveApplication>(`/leaves/${id}`);
    },

    create: async (data: CreateLeaveRequest): Promise<LeaveApplication> => {
        return api.post<LeaveApplication>('/leaves', data);
    },

    approve: async (id: string): Promise<LeaveApplication> => {
        return api.put<LeaveApplication>(`/leaves/${id}`, { status: 'approved' });
    },

    reject: async (id: string, remarks?: string): Promise<LeaveApplication> => {
        return api.put<LeaveApplication>(`/leaves/${id}`, { status: 'rejected', remarks });
    },

    cancel: async (id: string): Promise<void> => {
        return api.delete<void>(`/leaves/${id}`);
    },
};

// ============================================================================
// DIARY
// ============================================================================

export interface DiaryEntry {
    id: string;
    class_section_id: string;
    entry_date: string;
    subject_id?: string;
    title?: string;
    content: string;
    homework_due_date?: string;
    attachments?: string[];
    subject_name?: string;
    class_name?: string;
    section_name?: string;
    created_by: string;
    created_at: string;
    updated_at?: string;
}

export const DiaryService = {
    getAll: async (params: { class_section_id?: string; entry_date?: string; subject_id?: string }): Promise<DiaryEntry[]> => {
        return api.get<DiaryEntry[]>('/diary', params);
    },

    create: async (data: Omit<DiaryEntry, 'id' | 'created_at'>): Promise<DiaryEntry> => {
        return api.post<DiaryEntry>('/diary', data);
    },

    update: async (id: string, data: Partial<DiaryEntry>): Promise<DiaryEntry> => {
        return api.put<DiaryEntry>(`/diary/${id}`, data);
    },

    delete: async (id: string): Promise<void> => {
        return api.delete<void>(`/diary/${id}`);
    },
};

// ============================================================================
// EVENTS
// ============================================================================

export interface EventItem {
    id: string;
    title: string;
    description: string;
    event_type: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    location: string;
    is_all_day: boolean;
}

export const EventService = {
    getAll: async (params?: { upcoming_only?: boolean; to_date?: string }): Promise<EventItem[]> => {
        return api.get<EventItem[]>('/events', params);
    },
};

// ============================================================================
// TRANSPORT
// ============================================================================

export interface BusItem {
    id: string;
    route_name: string;
    driver_name: string;
    driver_phone: string;
    registration_no: string;
    bus_no: string;
    capacity: number;
    is_active: boolean;
}

export const TransportService = {
    getAllBuses: async (): Promise<BusItem[]> => {
        return api.get<BusItem[]>('/transport/buses');
    },
};

export interface Subject {
    id: string;
    name: string;
    code?: string;
    description?: string;
}

export interface Exam {
    id: string;
    name: string;
    academic_year_id: string;
    academic_year?: string;
    exam_type: string;
    start_date?: string;
    end_date?: string;
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
}

export interface ResultEntry {
    student_id: string;
    marks: number;
    max_marks?: number;
}

export interface ExamResultUpload {
    class_section_id: string;
    exam_category: string;
    sub_exam: string;
    subject_id?: string;
    max_marks?: number;
    results: ResultEntry[];
}

export const ResultService = {
    // Subjects
    getSubjects: async (): Promise<Subject[]> => {
        return api.get<Subject[]>('/results/subjects');
    },
    createSubject: async (data: { name: string; code?: string; description?: string }): Promise<Subject> => {
        return api.post<Subject>('/results/subjects', data);
    },
    deleteSubject: async (id: string): Promise<void> => {
        return api.delete(`/results/subjects/${id}`);
    },

    // Exams
    getExams: async (params?: { academic_year_id?: string; status?: string }): Promise<Exam[]> => {
        return api.get<Exam[]>('/results/exams', params);
    },
    createExam: async (data: { name: string; academic_year_id: string; exam_type: string; start_date?: string; end_date?: string; status?: string }): Promise<Exam> => {
        return api.post<Exam>('/results/exams', data);
    },
    updateExam: async (id: string, data: Partial<Exam>): Promise<Exam> => {
        return api.put<Exam>(`/results/exams/${id}`, data);
    },
    deleteExam: async (id: string): Promise<void> => {
        return api.delete(`/results/exams/${id}`);
    },

    upload: async (data: ExamResultUpload): Promise<{ success: boolean }> => {
        return api.post<{ success: boolean }>('/results/upload', data);
    },

    getMarks: async (params: { class_section_id: string; exam_category: string; sub_exam: string; subject_id: string }): Promise<{ marks: { student_id: string; marks_obtained: number; is_absent: boolean }[], max_marks: number }> => {
        return api.get<{ marks: { student_id: string; marks_obtained: number; is_absent: boolean }[], max_marks: number }>('/results/marks', params);
    }
};

export interface TeacherClassAssignment {
    class_section_id: string;
    class_id: string; // Added for LMS
    class_name: string;
    section_id: string;
    section_name: string;
    subject_id: string;
    subject_name: string;
    assignment_id: string;
}

export const TeacherService = {
    getMyClasses: async (): Promise<TeacherClassAssignment[]> => {
        return api.get<TeacherClassAssignment[]>('/teachers/me/classes');
    }
};
