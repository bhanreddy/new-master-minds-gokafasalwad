import { api } from './apiClient';

export interface ClassInfo {
    id: string;
    name: string;
    code?: string;
}

export interface Section {
    id: string;
    name: string;
    code?: string;
}

export interface ClassSection {
    id: string;
    class_id: string;
    section_id: string;
    academic_year_id: string;
    class_name: string;
    section_name: string;
    academic_year: string;
    class_teacher_id?: string;
    class_teacher_name?: string;
}

export interface AcademicYear {
    id: string;
    code: string;
    start_date: string;
    end_date: string;
}

export const ClassService = {
    getClasses: async (): Promise<ClassInfo[]> => {
        return api.get<ClassInfo[]>('/academics/classes');
    },

    getSections: async (classId?: number): Promise<Section[]> => {
        const params = classId ? { class_id: classId } : {};
        return api.get<Section[]>('/academics/sections', params);
    },

    getClassSections: async (academicYearId?: string): Promise<ClassSection[]> => {
        return api.get<ClassSection[]>('/academics/class-sections', { academic_year_id: academicYearId });
    },

    getAcademicYears: async (): Promise<AcademicYear[]> => {
        return api.get<AcademicYear[]>('/academics/academic-years');
    },

    getCurrentAcademicYear: async (): Promise<AcademicYear | null> => {
        const years = await api.get<AcademicYear[]>('/academics/academic-years');
        const now = new Date();
        return years.find(y =>
            new Date(y.start_date) <= now && new Date(y.end_date) >= now
        ) || null;
    },

    createClass: async (data: { name: string, code?: string }): Promise<ClassInfo> => {
        return api.post<ClassInfo>('/academics/classes', data);
    },

    createSection: async (data: { name: string, code?: string }): Promise<Section> => {
        return api.post<Section>('/academics/sections', data);
    },

    createAcademicYear: async (data: { code: string, start_date: string, end_date: string }): Promise<AcademicYear> => {
        return api.post<AcademicYear>('/academics/academic-years', data);
    },

    createClassSection: async (data: { class_id: string, section_id: string, academic_year_id: string }): Promise<ClassSection> => {
        return api.post<ClassSection>('/academics/class-sections', data);
    },

    deleteClassSection: async (id: string): Promise<void> => {
        return api.delete(`/academics/class-sections/${id}`);
    },

    deleteClass: async (id: string): Promise<void> => {
        return api.delete(`/academics/classes/${id}`);
    },

    deleteSection: async (id: string): Promise<void> => {
        return api.delete(`/academics/sections/${id}`);
    },

    deleteAcademicYear: async (id: string): Promise<void> => {
        return api.delete(`/academics/academic-years/${id}`);
    },
};
