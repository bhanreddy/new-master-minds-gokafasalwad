import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import * as accountVault from '../services/accountVault';
import type { VaultAccount } from '../services/accountVault';
import * as Haptics from '../utils/haptics';

export function useQuickAccountSwitch(onSwitched?: () => void | Promise<void>) {
  const { user, switchAccount } = useAuth();
  const [accounts, setAccounts] = useState<VaultAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const busyRef = useRef(false);

  const loadAccounts = useCallback(async () => {
    try {
      const [accs, active] = await Promise.all([
        accountVault.listAccounts(),
        accountVault.getActiveAccountId(),
      ]);
      setAccounts(accs);
      setActiveId(active ?? user?.userId ?? null);
    } catch {
      /* vault read failures are non-fatal */
    }
  }, [user?.userId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts, user?.userId]);

  const performSwitch = useCallback(
    async (userId: string) => {
      if (busyRef.current || userId === activeId) return false;
      busyRef.current = true;
      setSwitching(true);
      try {
        const res = await switchAccount(userId);
        if (res?.error) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return false;
        }
        setActiveId(userId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onSwitched?.();
        return true;
      } finally {
        busyRef.current = false;
        setSwitching(false);
      }
    },
    [activeId, onSwitched, switchAccount]
  );

  const switchToNext = useCallback(async () => {
    await loadAccounts();
    const accs = await accountVault.listAccounts();
    const current = (await accountVault.getActiveAccountId()) ?? user?.userId;
    if (accs.length <= 1) {
      Haptics.selectionAsync();
      setSheetOpen(true);
      return false;
    }
    const idx = accs.findIndex((a) => a.userId === current);
    const nextIdx = idx >= 0 ? (idx + 1) % accs.length : 0;
    const next = accs[nextIdx];
    if (!next || next.userId === current) {
      Haptics.selectionAsync();
      return false;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return performSwitch(next.userId);
  }, [loadAccounts, performSwitch, user?.userId]);

  const switchTo = useCallback(
    async (userId: string) => {
      Haptics.selectionAsync();
      const ok = await performSwitch(userId);
      if (ok) setSheetOpen(false);
      return ok;
    },
    [performSwitch]
  );

  const openSheet = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadAccounts();
    setSheetOpen(true);
  }, [loadAccounts]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return {
    accounts,
    activeId,
    sheetOpen,
    switching,
    switchToNext,
    switchTo,
    openSheet,
    closeSheet,
    reloadAccounts: loadAccounts,
  };
}
