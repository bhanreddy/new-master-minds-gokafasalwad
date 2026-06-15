import { api } from './apiClient';

export type TransportBillingCycle = 'monthly' | 'quarterly' | 'term' | 'annual';

export interface TransportStopFee {
  stop_id: string;
  stop_name: string;
  stop_order: number;
  pickup_time: string | null;
  drop_time: string | null;
  student_count: number;
  fee: {
    id: string;
    fee_amount: number;
    billing_cycle: TransportBillingCycle;
  } | null;
  fee_not_set: boolean;
}

export interface TransportRouteWithFees {
  id: string;
  name: string;
  code: string | null;
  direction: string;
  bus_no: string | null;
  stops: TransportStopFee[];
}

export interface TransportStudentFee {
  student_id: string;
  admission_no: string;
  student_name: string;
  class_id: string | null;
  class_name: string | null;
  section_name: string | null;
  route_id: string;
  route_name: string;
  stop_id: string | null;
  stop_name: string | null;
  transport_fee_id: string | null;
  fee_amount: number | null;
  billing_cycle: TransportBillingCycle | null;
  paid_amount: number;
  balance_due: number | null;
  fee_not_set: boolean;
  fee_type: 'transport';
  can_collect: boolean;
}

export const TransportFeeService = {
  getRoutesWithFees: async (academicYear?: string) => {
    return api.get<{ academic_year: string; routes: TransportRouteWithFees[] }>(
      '/transport/routes-with-fees',
      academicYear ? { academic_year: academicYear } : undefined,
      { silent: true },
    );
  },

  setFee: async (data: {
    route_id: string;
    stop_id: string;
    academic_year: string;
    fee_amount: number;
    billing_cycle?: TransportBillingCycle;
  }) => {
    return api.post('/transport/fee', data);
  },

  updateFee: async (id: string, data: { fee_amount?: number; billing_cycle?: TransportBillingCycle }) => {
    return api.patch(`/transport/fee/${id}`, data);
  },

  getStudentFees: async (params?: {
    academic_year?: string;
    class_filter?: string;
    search?: string;
  }) => {
    return api.get<{ academic_year: string; students: TransportStudentFee[] }>(
      '/transport/student-fees',
      params,
      { silent: true },
    );
  },

  collect: async (data: {
    student_id: string;
    academic_year?: string;
    amount: number;
    payment_method: 'cash' | 'upi' | 'cheque' | 'card' | 'bank_transfer' | 'online';
    transaction_ref: string;
    remarks?: string;
  }) => {
    return api.post<{
      message: string;
      receipt: { receipt_no: string; total_amount: number };
    }>('/transport/collect', data);
  },
};
