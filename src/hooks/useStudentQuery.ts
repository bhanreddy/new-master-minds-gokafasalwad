// OPT: Module-level response cache + focus-gated refetch so tab revisits do not hammer the API until TTL expires.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { api } from '../services/apiClient';
import { SCHOOL_ID } from '../constants/school';

type CacheEntry<T> = { data: T; storedAt: number };

const studentQueryCache = new Map<string, CacheEntry<unknown>>();

function buildCacheKey(schoolId: number, userKey: string, key: string) {
  return `${schoolId}:${userKey}:${key}`;
}

export interface UseStudentQueryOptions {
  enabled?: boolean; // OPT: Allow dependent queries (e.g. attendance after profile id is known).
  query?: Record<string, string | number | boolean | undefined>; // OPT: Forward query string to api.get for filtered GETs.
}

/**
 * Lightweight GET cache for student screens — skips refetch while cache is younger than ttlMs; refetches when the screen is focused and TTL has expired.
 */
export function useStudentQuery<T>(
  endpoint: string,
  cacheKeySuffix: string,
  ttlMs: number,
  userId: string | null | undefined,
  options: UseStudentQueryOptions = {}
) {
  const { enabled = true, query } = options; // OPT: Destructure optional GET params for cache-aware requests.
  const isFocused = useIsFocused();
  const userKey = userId || 'anon';
  const key = useMemo(
    () => buildCacheKey(SCHOOL_ID, userKey, cacheKeySuffix),
    [userKey, cacheKeySuffix]
  );

  const [data, setData] = useState<T | null>(() => {
    const hit = studentQueryCache.get(key) as CacheEntry<T> | undefined;
    if (hit && Date.now() - hit.storedAt < ttlMs) return hit.data;
    return null;
  });
  const [loading, setLoading] = useState(!data && enabled);
  const [error, setError] = useState<Error | null>(null);

  const fetcher = useCallback(
    async (force: boolean): Promise<T | null> => {
      if (!enabled || !userId) return null;
      const hit = studentQueryCache.get(key) as CacheEntry<T> | undefined;
      if (!force && hit && Date.now() - hit.storedAt < ttlMs) {
        setData(hit.data);
        setLoading(false);
        return hit.data;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<T>(endpoint, query); // OPT: Pass query params so /notices, /complaints, etc. stay cacheable.
        studentQueryCache.set(key, { data: res as unknown, storedAt: Date.now() });
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
    [endpoint, key, ttlMs, enabled, userId, query]
  ); // OPT: Re-fetch when query object identity or endpoint changes.

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
