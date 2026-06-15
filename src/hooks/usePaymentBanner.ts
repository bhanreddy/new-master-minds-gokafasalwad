import { useEffect, useState } from 'react';
import { api } from '../services/apiClient';

type PaymentBannerResponse = {
  enabled?: boolean;
  reason?: string | null;
};

export function usePaymentBanner() {
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadBanner() {
      try {
        const response = await api.get<PaymentBannerResponse>('/app/payment-banner', undefined, { silent: true });
        if (!mounted) return;
        setEnabled(Boolean(response?.enabled));
        setReason(response?.reason ?? null);
      } catch {
        if (!mounted) return;
        setEnabled(false);
        setReason(null);
      }
    }

    loadBanner();

    return () => {
      mounted = false;
    };
  }, []);

  return { enabled, reason };
}
