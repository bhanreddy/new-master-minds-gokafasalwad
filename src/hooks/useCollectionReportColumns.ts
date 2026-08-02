import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_COLLECTION_REPORT_COLUMNS,
  normalizeCollectionReportColumns,
  type CollectionReportColumnKey,
} from '../utils/collectionReport';

const STORAGE_PREFIX = '@schoolims/collection-report-columns/v1';
const DENOMINATION_STORAGE_PREFIX = '@schoolims/collection-report-denominations/v1';

export function collectionReportColumnsStorageKey(scope: string): string {
  const safeScope = scope.trim() || 'default';
  return `${STORAGE_PREFIX}/${safeScope}`;
}

export function useCollectionReportColumns(scope: string) {
  const storageKey = useMemo(() => collectionReportColumnsStorageKey(scope), [scope]);
  const [columns, setColumns] = useState<CollectionReportColumnKey[]>([
    ...DEFAULT_COLLECTION_REPORT_COLUMNS,
  ]);
  const columnsRef = useRef(columns);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setHydrated(false);
    setSaveError(null);

    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        const saved = raw ? normalizeCollectionReportColumns(JSON.parse(raw)) : [...DEFAULT_COLLECTION_REPORT_COLUMNS];
        columnsRef.current = saved;
        setColumns(saved);
      })
      .catch(() => {
        if (!active) return;
        const defaults = [...DEFAULT_COLLECTION_REPORT_COLUMNS];
        columnsRef.current = defaults;
        setColumns(defaults);
        setSaveError('Saved column settings could not be loaded.');
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [storageKey]);

  const toggleColumn = useCallback(async (key: CollectionReportColumnKey) => {
    const current = columnsRef.current;
    const enabled = current.includes(key);
    if (enabled && current.length === 1) return;

    const next = enabled
      ? current.filter((column) => column !== key)
      : [...current, key];
    columnsRef.current = next;
    setColumns(next);
    setSaveError(null);

    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setSaveError('Column choice changed for now, but could not be saved for future reports.');
    }
  }, [storageKey]);

  return { columns, hydrated, saveError, toggleColumn };
}

export function useCollectionReportDenominations(scope: string) {
  const storageKey = useMemo(() => {
    const safeScope = scope.trim() || 'default';
    return `${DENOMINATION_STORAGE_PREFIX}/${safeScope}`;
  }, [scope]);
  const [includeDenominations, setIncludeDenominations] = useState(false);
  const valueRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setHydrated(false);
    setSaveError(null);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        const saved = raw === 'true';
        valueRef.current = saved;
        setIncludeDenominations(saved);
      })
      .catch(() => {
        if (!active) return;
        valueRef.current = false;
        setIncludeDenominations(false);
        setSaveError('Saved denomination setting could not be loaded.');
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [storageKey]);

  const toggleDenominations = useCallback(async () => {
    const next = !valueRef.current;
    valueRef.current = next;
    setIncludeDenominations(next);
    setSaveError(null);
    try {
      await AsyncStorage.setItem(storageKey, String(next));
    } catch {
      setSaveError('Denomination choice changed for now, but could not be saved.');
    }
  }, [storageKey]);

  return {
    includeDenominations,
    hydrated,
    saveError,
    toggleDenominations,
  };
}
