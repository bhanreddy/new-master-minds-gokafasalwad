import { api } from './apiClient';
import {
    StudentFee,
    FeeTransaction,
    FeeResponse,
    AccountsDashboardStats,
    FeeReceipt,
    FeeStructure,
    FeeType
} from '../types/models';

export { FeeType };

export interface CollectFeeRequest {
    student_fee_id: string;
    amount: number;
    payment_method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'online';
    transaction_ref?: string;
    remarks?: string;
}

export interface AdjustFeeRequest {
    student_fee_id: string;
    amount: number;
    reason: string;
}

export const FeeService = {
    /**
     * Get fee structure for a class
     */
    getStructureByClass: async (classId: string, academicYearId?: string): Promise<FeeStructure[]> => {
        return api.get<FeeStructure[]>(`/fees/structure`, {
            class_id: classId,
            academic_year_id: academicYearId
        });
    },

    /**
     * Create fee structure
     */
    createStructure: async (data: Partial<FeeStructure>): Promise<FeeStructure> => {
        const response = await api.post<{ structure: FeeStructure }>('/fees/structure', data);
        return response.structure;
    },

    /**
     * Get student fees (Ledger)
     */
    getStudentFees: async (studentId: string, academicYearId?: string): Promise<FeeResponse> => {
        return api.get<FeeResponse>(`/fees/students/${studentId}`, { academic_year_id: academicYearId });
    },

    /**
     * Collect fee payment
     */
    collectFee: async (data: CollectFeeRequest): Promise<FeeTransaction> => {
        const response = await api.post<{ transaction: FeeTransaction }>('/fees/collect', data);
        return response.transaction;
    },

    /**
     * Apply an adjustment (Waiver/Discount)
     */
    adjustFee: async (data: AdjustFeeRequest): Promise<{ message: string; fee: StudentFee }> => {
        return api.post<{ message: string; fee: StudentFee }>('/fees/adjust', data);
    },

    /**
     * Get list of defaulters
     */
    getDefaulters: async (params?: { class_id?: string; academic_year_id?: string; min_days_overdue?: number }): Promise<any[]> => {
        return api.get<any[]>('/fees/defaulters', params);
    },

    /**
     * List receipts
     */
    getReceipts: async (params?: { student_id?: string; from_date?: string; to_date?: string }): Promise<FeeReceipt[]> => {
        return api.get<FeeReceipt[]>('/fees/receipts', params);
    },

    /**
     * Get receipt details
     */
    getReceipt: async (id: string): Promise<FeeReceipt> => {
        return api.get<FeeReceipt>(`/fees/receipts/${id}`);
    },

    /**
     * Get consolidated dashboard stats
     */
    getDashboardStats: async (): Promise<AccountsDashboardStats> => {
        return api.get<AccountsDashboardStats>('/fees/dashboard-stats');
    },

    /**
     * Get student summaries for list view
     */
    getStudentFeeSummaries: async (params?: { class_id?: string; academic_year_id?: string; search?: string }): Promise<any[]> => {
        return api.get<any[]>('/fees/summaries', params);
    },

    /**
     * List all transactions
     */
    getTransactions: async (params?: { from_date?: string; to_date?: string; payment_method?: string }): Promise<FeeTransaction[]> => {
        return api.get<FeeTransaction[]>('/fees/transactions', params);
    },

    /**
     * Get recent transactions
     */
    getRecentTransactions: async (limit: number = 10): Promise<FeeTransaction[]> => {
        return api.get<FeeTransaction[]>('/fees/transactions', { limit }); // Assuming backend supports limit
    },

    /**
     * Get collection summary (daily/monthly range)
     */
    getCollectionSummary: async (params: { date?: string; from_date?: string; to_date?: string; group_by?: 'day' | 'month' }): Promise<any> => {
        return api.get<any>('/fees/collection-summary', params);
    }
};
