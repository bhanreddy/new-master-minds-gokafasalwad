import { api } from './apiClient';

// --- Types ---

export type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL';

export interface StudentRiskProfile {
    id: string;
    name: string;
    class: string;
    riskLevel: RiskLevel;
    factors: string[]; // e.g., ["Marks ↓ 15%", "Attendance < 75%"]
    trend: number[]; // Last 5 test scores for tiny graph
}

export interface HeatmapData {
    classes: string[];
    subjects: string[];
    data: Record<string, Record<string, number>>;
}

export interface AdminDashboardStats {
    totalStudents: number;
    staffPresent: number;
    totalStaff: number;
    collection: number;
    complaints: number;
    // Add other relevant stats
}

// --- Mock Data (Temporary until Backend Endpoints are ready) ---



export const AdminService = {
    /**
     * Get main dashboard statistics
     */
    getDashboardStats: async (options?: any): Promise<AdminDashboardStats> => {
        return api.get<AdminDashboardStats>('/admin/dashboard-stats', undefined, options);
    },

    /**
     * Get Student Risk Analysis
     */
    getRiskProfiles: async (filters?: any): Promise<StudentRiskProfile[]> => {
        return api.get<StudentRiskProfile[]>('/analytics/risk', filters);
    },

    /**
     * Get Academic Performance Heatmap
     */
    getAcademicHeatmap: async (): Promise<HeatmapData> => {
        return api.get<HeatmapData>('/analytics/heatmap');
    },

    /**
     * Generate AI Talking Points for a student
     */
    generateTalkingPoints: async (studentId: string): Promise<string[]> => {
        return api.get<string[]>(`/analytics/talking-points/${studentId}`);
    }
};
