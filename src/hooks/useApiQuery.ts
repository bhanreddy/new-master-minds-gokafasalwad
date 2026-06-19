import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { api } from '../services/apiClient';
import { SCHOOL_ID } from '../constants/school';

type CacheEntry<T> = { data: T; storedAt: number };

const apiQueryCache = new Map<string, CacheEntry<unknown>>();

function serializeQuery(query?: UseApiQueryOptions['query']) {
  if (!query) return '';
  const cleanEntries = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return new URLSearchParams(
    cleanEntries.map(([key, value]) => [key, String(value)])
  ).toString();
}

function buildCacheKey(schoolId: number, userKey: string, key: string, queryKey: string) {
  return `${schoolId}:${userKey}:${key}${queryKey ? `?${queryKey}` : ''}`;
}

export interface UseApiQueryOptions {
  enabled?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
}

/**
 * Lightweight GET cache for staff/admin screens — skips refetch while cache
 * is younger than ttlMs; refetches when focused and TTL has expired.
 */
export function useApiQuery<T>(
  endpoint: string,
  cacheKeySuffix: string,
  ttlMs: number,
  userId: string | null | undefined,
  options: UseApiQueryOptions = {}
) {
  const { enabled = true, query } = options;
  const isFocused = useIsFocused();
  const userKey = userId || 'anon';
  const queryKey = serializeQuery(query);
  const requestQuery = useMemo(() => {
    if (!queryKey) return undefined;
    return Object.fromEntries(new URLSearchParams(queryKey).entries());
  }, [queryKey]);
  const key = useMemo(
    () => buildCacheKey(SCHOOL_ID, userKey, cacheKeySuffix, queryKey),
    [userKey, cacheKeySuffix, queryKey]
  );

  const [data, setData] = useState<T | null>(() => {
    const hit = apiQueryCache.get(key) as CacheEntry<T> | undefined;
    if (hit && Date.now() - hit.storedAt < ttlMs) return hit.data;
    return null;
  });
  const [loading, setLoading] = useState(!data && enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const hit = apiQueryCache.get(key) as CacheEntry<T> | undefined;
    if (hit && Date.now() - hit.storedAt < ttlMs) {
      setData(hit.data);
      setLoading(false);
      return;
    }
    setData(null);
    setLoading(enabled && !!userId);
  }, [key, ttlMs, enabled, userId]);

  const fetcher = useCallback(
    async (force: boolean): Promise<T | null> => {
      if (!enabled || !userId) return null;
      const hit = apiQueryCache.get(key) as CacheEntry<T> | undefined;
      if (!force && hit && Date.now() - hit.storedAt < ttlMs) {
        setData(hit.data);
        setLoading(false);
        return hit.data;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<T>(endpoint, requestQuery);
        apiQueryCache.set(key, { data: res as unknown, storedAt: Date.now() });
        setData(res);
        return res;
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String((e as any)?.message || e));
        setError(err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [endpoint, key, ttlMs, enabled, userId, requestQuery]
  );

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false);
      return;
    }
    if (!isFocused) return;
    void fetcher(false);
  }, [enabled, userId, isFocused, key, fetcher]);

  const refetch = useCallback(() => fetcher(true), [fetcher]);

  return { data, loading, error, refetch };
}

/** Drop cached GET results so visibility changes apply immediately on other screens. */
export function invalidateApiQueryCache(cacheKeySuffix?: string) {
  if (!cacheKeySuffix) {
    apiQueryCache.clear();
    return;
  }
  const suffix = `:${cacheKeySuffix}`;
  for (const key of apiQueryCache.keys()) {
    if (key.endsWith(suffix) || key.includes(`${suffix}?`)) {
      apiQueryCache.delete(key);
    }
  }
}
