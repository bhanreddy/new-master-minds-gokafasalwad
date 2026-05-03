import { supabase } from './supabaseConfig';
import { api, APIError } from './apiClient';
import { PayrollEntry } from '../types/payroll';

export type MarkPayrollPaidResult = { ok: true } | { ok: false; message: string };

export const PayrollService = {
  /**
   * Fetch payroll for a specific month/year.
   * Uses the 'generate_monthly_payroll' RPC to ensure data exists first.
   */
  async getPayrollForMonth(month: number, year: number): Promise<PayrollEntry[]> {
    try {
      // 1. Ensure payroll records exist for this month
      const { error: rpcError } = await supabase.rpc('generate_monthly_payroll', {
        p_month: month,
        p_year: year
      });

      if (rpcError) {

      }

      // 2. Fetch records
      const { data, error } = await supabase.
      from('staff_payroll').
      select(`
                    *,
                    staff:staff_id (
                        staff_code,
                        designation:designation_id ( name ),
                        person:person_id (
                            first_name,
                            last_name,
                            photo_url,
                            display_name
                        )
                    )
                `).
      eq('payroll_month', month).
      eq('payroll_year', year).
      order('created_at', { ascending: true });

      if (error) throw error;
      return data as PayrollEntry[];
    } catch (err) {

      return [];
    }
  },

  /**
   * Mark a payroll entry as PAID (Node API). silent: true avoids duplicate alerts; caller shows the message.
   */
  async markAsPaid(id: string): Promise<MarkPayrollPaidResult> {
    try {
      await api.put(`/payroll/${id}/pay`, undefined, { silent: true });
      return { ok: true };
    } catch (err: unknown) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to update payment status.';
      if (__DEV__) {
        console.warn('[PayrollService.markAsPaid]', id, message);
      }
      return { ok: false, message };
    }
  }
};