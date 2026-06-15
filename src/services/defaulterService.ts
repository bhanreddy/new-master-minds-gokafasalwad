import { api } from './apiClient';

export type DefaulterDueSource = 'manual_legacy' | 'carried_forward';
export type DefaulterDueStatus = 'pending' | 'partially_paid' | 'cleared';

export interface DefaulterYearBreakdown {
  id: string;
  due_academic_year: string;
  original_amount: number;
  paid_amount: number;
  balance: number;
  status: DefaulterDueStatus;
  source: DefaulterDueSource;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface DefaulterStudent {
  student_id: string;
  admission_no: string;
  student_name: string;
  class_id: string | null;
  class_name: string | null;
  section_name: string | null;
  total_balance: number;
  year_breakdown: DefaulterYearBreakdown[];
}

export interface DefaultersListResponse {
  active_academic_year: string;
  defaulters: DefaulterStudent[];
}

export interface CreateDefaulterDueRequest {
  student_id: string;
  due_academic_year: string;
  amount: number;
  remarks?: string;
}

export interface CollectDefaulterPaymentRequest {
  amount: number;
  payment_method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'online';
  transaction_ref: string;
  remarks?: string;
}

export interface CollectDefaulterPaymentResponse {
  message: string;
  payment: {
    id: string;
    amount: number;
    payment_method: string;
    transaction_ref: string;
    paid_at: string;
  };
  due: DefaulterYearBreakdown;
  receipt: {
    id: string;
    receipt_no: string;
    total_amount: number;
    payment_type: 'arrears';
    issued_at: string;
  };
}

export const DefaulterService = {
  list: async (params?: {
    search?: string;
    class_filter?: string;
    year_filter?: string;
    student_id?: string;
  }): Promise<DefaultersListResponse> => {
    return api.get<DefaultersListResponse>('/defaulters', params);
  },

  /**
   * Fetch a single student's unpaid previous-year dues, sorted most-recent year first.
   * Returns a flat list of year rows (empty if the student has no prior-year arrears).
   */
  listForStudent: async (studentId: string): Promise<DefaulterYearBreakdown[]> => {
    const res = await api.get<DefaultersListResponse>('/defaulters', { student_id: studentId });
    const student = res.defaulters?.find((d) => d.student_id === studentId);
    const activeStartYear = parseInt((res.active_academic_year || '').split('-')[0], 10) || 0;
    return (student?.year_breakdown || [])
      // Belt-and-suspenders: never surface a current/future-year row here.
      .filter((y) => {
        const startYear = parseInt((y.due_academic_year || '').split('-')[0], 10) || 0;
        return Number(y.balance) > 0 && (!activeStartYear || startYear < activeStartYear);
      })
      .sort((a, b) => b.due_academic_year.localeCompare(a.due_academic_year));
  },

  create: async (data: CreateDefaulterDueRequest) => {
    return api.post('/defaulters', data);
  },

  update: async (id: string, data: { amount?: number; remarks?: string }) => {
    return api.patch(`/defaulters/${id}`, data);
  },

  collect: async (id: string, data: CollectDefaulterPaymentRequest): Promise<CollectDefaulterPaymentResponse> => {
    return api.post<CollectDefaulterPaymentResponse>(`/defaulters/${id}/collect`, data);
  },

  remove: async (id: string) => {
    return api.delete(`/defaulters/${id}`);
  },

  remind: async (data?: {
    student_id?: string;
    message?: string;
    search?: string;
    class_filter?: string;
    year_filter?: string;
  }): Promise<{ message: string; student_count: number; notifications_sent: number }> => {
    return api.post('/defaulters/remind', data ?? {});
  },
};
