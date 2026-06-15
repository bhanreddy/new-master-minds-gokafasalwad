import { useState, useCallback, useRef } from 'react';
// User asked to use Supabase JS SDK. Let's use supabaseConfig.
import { api } from '../services/apiClient';
import { supabase } from '../services/supabaseConfig';
import { Expense, CreateExpenseRequest, ExpenseStatus } from '../types/expenses';
import { alertCompat } from '../utils/crossPlatformAlert';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchOptions = useRef<{ accountsScope?: boolean }>({});

  const fetchExpenses = useCallback(async (
    searchQuery: string = '',
    options?: { accountsScope?: boolean }
  ) => {
    lastFetchOptions.current = options ?? {};
    setLoading(true);
    setError(null);
    try {
      if (options?.accountsScope) {
        const params: Record<string, string> = { scope: 'accounts' };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await api.get<Expense[] | { data: Expense[] }>('/expenses', params);
        setExpenses(Array.isArray(data) ? data : (data?.data ?? []));
        return;
      }

      // Admin / general list — RLS handles visibility via Supabase
      let query = supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (searchQuery) {
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
      await fetchExpenses('', lastFetchOptions.current);
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