import { useApiQuery, UseApiQueryOptions } from './useApiQuery';

export type UseStudentQueryOptions = UseApiQueryOptions;

/**
 * Student-screen GET cache — thin wrapper over useApiQuery so query params
 * are included in the cache key (fixes same-suffix/different-query collisions).
 */
export function useStudentQuery<T>(
  endpoint: string,
  cacheKeySuffix: string,
  ttlMs: number,
  userId: string | null | undefined,
  options: UseStudentQueryOptions = {}
) {
  return useApiQuery<T>(endpoint, cacheKeySuffix, ttlMs, userId, options);
}
