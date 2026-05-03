import { useState, useCallback } from 'react';
// User asked to use Supabase JS SDK. Let's use supabaseConfig.
import { api } from '../services/apiClient';
import { supabase } from '../services/supabaseConfig';
import { Expense, CreateExpenseRequest, ExpenseStatus } from '../types/expenses';
import { alertCompat } from '../utils/crossPlatformAlert';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async (searchQuery: string = '') => {
    setLoading(true);
    setError(null);
    try {
      // RLS handles visibility. We just select * 

      let query = supabase.
        from('expenses').
        select('*').
        order('expense_date', { ascending: false });

      if (searchQuery) {
        // ILIKE search on title or category
        query = query.or(`title.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) throw supabaseError;

      setExpenses(data as Expense[]);
    } catch (err: any) {

      setError(err.message || 'Failed to fetch expenses');
      alertCompat('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const createExpense = async (expenseData: CreateExpenseRequest) => {
    try {
      await api.post('/expenses', expenseData);

      // Refresh
      await fetchExpenses();
      return true;
    } catch (err: any) {
      return false;
    }
  };

  const updateStatus = async (id: string, newStatus: ExpenseStatus) => {
    try {
      await api.put(`/expenses/${id}/status`, { status: newStatus });

      // Optimistic update
      setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, status: newStatus } : e));
      return true;
    } catch (err: any) {
      return false;
    }
  };

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateStatus
  };
}