import { api } from './apiClient';

// Reference Data Types
export interface Gender {
    id: number;
    name: string;
}

export interface BloodGroup {
    id: number;
    name: string;
}

export interface Religion {
    id: number;
    name: string;
}

export interface StudentCategory {
    id: number;
    name: string;
}

export interface RelationshipType {
    id: number;
    name: string;
}

export interface StaffDesignation {
    id: number;
    name: string;
}

export interface StudentStatus {
    id: number;
    code: string;
    is_terminal: boolean;
}

export interface Country {
    code: string;
    name: string;
}

// Combined reference data response
export interface ReferenceData {
    genders: Gender[];
    blood_groups: BloodGroup[];
    religions: Religion[];
    student_categories: StudentCategory[];
    relationship_types: RelationshipType[];
    staff_designations: StaffDesignation[];
    student_statuses: StudentStatus[];
    countries?: Country[];
}

// Reference Data Service
export const ReferenceDataService = {
    /**
     * Fetch all reference data at once
     * This should be called on app startup and cached
     */
    getAll: async (): Promise<ReferenceData> => {
        return api.get<ReferenceData>('/config/reference-data');
    },

    // Individual getters (if backend doesn't provide combined endpoint)
    getGenders: async (): Promise<Gender[]> => {
        return api.get<Gender[]>('/reference/genders');
    },

    getBloodGroups: async (): Promise<BloodGroup[]> => {
        return api.get<BloodGroup[]>('/reference/blood-groups');
    },

    getReligions: async (): Promise<Religion[]> => {
        return api.get<Religion[]>('/reference/religions');
    },

    getStudentCategories: async (): Promise<StudentCategory[]> => {
        return api.get<StudentCategory[]>('/reference/student-categories');
    },

    getRelationshipTypes: async (): Promise<RelationshipType[]> => {
        return api.get<RelationshipType[]>('/reference/relationship-types');
    },

    getStaffDesignations: async (): Promise<StaffDesignation[]> => {
        return api.get<StaffDesignation[]>('/reference/staff-designations');
    },

    getStudentStatuses: async (): Promise<StudentStatus[]> => {
        return api.get<StudentStatus[]>('/reference/student-statuses');
    },
};
