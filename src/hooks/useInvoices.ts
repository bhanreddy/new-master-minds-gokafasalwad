import { useState, useCallback, useEffect } from 'react';
import { InvoiceService } from '../services/invoiceService';
import { Invoice } from '../types/invoices';

export function useInvoices() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const fetchInvoices = useCallback(async (reset: boolean = false) => {
        if (loading) return;
        setLoading(true);
        setError(null);

        try {
            const currentPage = reset ? 0 : page;
            const data = await InvoiceService.getInvoices(currentPage);

            if (data.length < 10) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

            if (reset) {
                setInvoices(data);
                setPage(1);
            } else {
                setInvoices(prev => [...prev, ...data]);
                setPage(prev => prev + 1);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch invoices');
        } finally {
            setLoading(false);
        }
    }, [page, loading]);

    // Initial load
    useEffect(() => {
        fetchInvoices(true);
    }, []);

    return {
        invoices,
        loading,
        error,
        hasMore,
        refresh: () => fetchInvoices(true),
        loadMore: () => fetchInvoices(false)
    };
}
