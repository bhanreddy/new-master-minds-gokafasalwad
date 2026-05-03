
import { api } from './apiClient';

export interface ExamSummary {
    exam_type: string;
    exam_count: number;
    last_exam_date: string;
}

export interface ExamListEntry {
    id: string;
    name: string;
    name_te?: string;
    exam_type: string;
    start_date: string;
    end_date: string;
    status: string;
    academic_year: string;
    subjects_count: number;
    total_obtained: number;
    total_max: number;
    percentage: number;
}

export interface SubjectResult {
    subject: string;
    subject_te?: string;
    name_te?: string;
    marks_obtained: number;
    max_marks: number;
    passing_marks: number;
    is_absent: boolean;
    percentage: number;
    passed: boolean;
}

export interface StudentResultDetail {
    exam_id: string;
    exam_name: string;
    exam_name_te?: string;
    exam_type: string;
    subjects: SubjectResult[];
    total_obtained: number;
    total_max: number;
    percentage: number;
}

export const ResultService = {
    /**
     * Get summary of exam results for a student, grouped by exam type
     */
    getSummary: async (studentId: string, academicYearId?: string): Promise<ExamSummary[]> => {
        let url = `/results/summary/student/${studentId}`;
        if (academicYearId) {
            url += `?academic_year_id=${academicYearId}`;
        }
        return api.get<ExamSummary[]>(url);
    },

    /**
     * Get list of exams for a specific type
     */
    getExamList: async (studentId: string, examType: string, academicYearId?: string): Promise<ExamListEntry[]> => {
        let url = `/results/list/student/${studentId}?exam_type=${examType}`;
        if (academicYearId) {
            url += `&academic_year_id=${academicYearId}`;
        }
        return api.get<ExamListEntry[]>(url);
    },

    /**
     * Get detailed result for a specific exam
     */
    getStudentResult: async (studentId: string, examId: string): Promise<{ student: any, results: StudentResultDetail[] }> => {
        return api.get<{ student: any, results: StudentResultDetail[] }>(`/results/student/${studentId}?exam_id=${examId}`);
    }
};
