import { useState, useCallback } from 'react';
import { PayrollService, MarkPayrollPaidResult } from '../services/payrollService';
import { PayrollEntry } from '../types/payroll';

export function usePayroll() {
    const [loading, setLoading] = useState(false);
    const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
    const [summary, setSummary] = useState({ total_paid: 0, total_pending: 0 });

    // Default to current month
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const fetchPayroll = useCallback(async (month: number = selectedMonth, year: number = selectedYear) => {
        setLoading(true);
        const data = await PayrollService.getPayrollForMonth(month, year);
        setPayrollData(data);

        // Calculate summary
        const paid = data.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.net_salary || 0), 0);
        const pending = data.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.net_salary || 0), 0);
        setSummary({ total_paid: paid, total_pending: pending });

        setLoading(false);
    }, [selectedMonth, selectedYear]);

    const markAsPaid = async (id: string): Promise<MarkPayrollPaidResult> => {
        const result = await PayrollService.markAsPaid(id);
        if (result.ok) {
            setPayrollData(prev => {
                const next = prev.map(item =>
                    item.id === id
                        ? { ...item, status: 'paid' as const, payment_date: new Date().toISOString().split('T')[0] }
                        : item
                );
                const paid = next.filter(p => p.status === 'paid').reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0);
                const pending = next.filter(p => p.status === 'pending').reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0);
                setSummary({ total_paid: paid, total_pending: pending });
                return next;
            });
        }
        return result;
    };

    return {
        payrollData,
        loading,
        summary,
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        setSelectedYear,
        fetchPayroll,
        markAsPaid
    };
}
