import { supabase } from './supabaseConfig';
import { FinancialPolicyRule, FinancialAuditLog } from '../types/models';

export const PolicyService = {
    /**
     * Fetch all financial policy rules
     */
    getRules: async (): Promise<FinancialPolicyRule[]> => {
        const { data, error } = await supabase
            .from('financial_policy_rules')
            .select('*')
            .order('rule_name', { ascending: true });

        if (error) throw error;
        return data as FinancialPolicyRule[];
    },

    /**
     * Update a policy rule (Admin only)
     */
    updateRule: async (ruleId: string, newValue: any): Promise<void> => {
        const { error } = await supabase
            .from('financial_policy_rules')
            .update({
                current_value: newValue,
                updated_at: new Date().toISOString(),
                updated_by: (await supabase.auth.getUser()).data.user?.id
            })
            .eq('id', ruleId);

        if (error) throw error;
    },

    /**
     * Fetch audit logs for destructive actions
     */
    getAuditLogs: async (limit: number = 50): Promise<FinancialAuditLog[]> => {
        const { data, error } = await supabase
            .from('financial_audit_logs')
            .select(`
                *,
                performed_by_user:performed_by (
                    display_name,
                    email
                )
            `)
            .order('performed_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Map joined user data to flat structure if needed, or keep as is.
        // For simpler UI, we can just return as is and handle in component, 
        // but let's flat map 'performed_by_name' for convenience.
        return data.map((log: any) => ({
            ...log,
            performed_by_name: log.performed_by_user?.display_name || log.performed_by_user?.email || 'Unknown'
        })) as FinancialAuditLog[];
    },
    /**
     * Delete a record with a mandatory reason (Audit Logged)
     */
    deleteWithReason: async (tableName: 'receipts' | 'student_fees' | 'expenses' | 'staff_payroll', recordId: string, reason: string): Promise<void> => {
        const { error } = await supabase.rpc('delete_record_with_reason', {
            p_table_name: tableName,
            p_record_id: recordId,
            p_reason: reason
        });

        if (error) throw error;
    }
};
