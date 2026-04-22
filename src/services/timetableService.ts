import { api } from './apiClient';

export interface TimetableSlot {
    id: string;
    period_number: number;
    start_time: string; // "09:00:00"
    end_time: string;
    subject_id: string;
    subject_name?: string;
    subject_name_te?: string;
    teacher_id?: string;
    teacher_name?: string;
    room_no?: string;
    class_name?: string; // For teacher view
    section_name?: string; // For teacher view
}

export interface CreateSlotRequest {
    class_section_id: string;
    academic_year_id: string;
    period_number: number;
    subject_id: string;
    teacher_id?: string;
    start_time: string;
    end_time: string;
}

export interface Period {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    sort_order: number;
}

export const TimetableService = {
    // Admin: Get slots for a class
    getClassSlots: async (classSectionId: string, academicYearId?: string): Promise<TimetableSlot[]> => {
        return api.get<TimetableSlot[]>(`/timetable/${classSectionId}/slots`, { academic_year_id: academicYearId });
    },

    // Admin: Create slot
    createSlot: async (data: CreateSlotRequest): Promise<TimetableSlot> => {
        return api.post<TimetableSlot>('/timetable', data);
    },

    // Admin: Delete slot
    deleteSlot: async (id: string): Promise<void> => {
        return api.delete(`/timetable/${id}`);
    },

    // Student: Get my timetable
    getMyTimetable: async (): Promise<TimetableSlot[]> => {
        return api.get<TimetableSlot[]>('/timetable/my-timetable');
    },

    // Teacher: Get my schedule
    getTeacherTimetable: async (academicYearId?: string): Promise<TimetableSlot[]> => {
        return api.get<TimetableSlot[]>('/timetable/teacher-timetable', { academic_year_id: academicYearId });
    },

    // Periods Management
    getPeriods: async (): Promise<Period[]> => {
        return api.get<Period[]>('/timetable/periods/list');
    },

    updatePeriods: async (periods: Period[]): Promise<void> => {
        return api.put('/timetable/periods', { periods });
    },

    deletePeriod: async (id: string): Promise<void> => {
        return api.delete(`/timetable/periods/${id}`);
    },

    createPeriod: async (data: { name: string; start_time: string; end_time: string }): Promise<Period> => {
        return api.post<Period>('/timetable/periods/create', data);
    }
};
