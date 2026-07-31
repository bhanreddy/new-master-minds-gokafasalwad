/**
 * Version updates may invalidate disposable offline data, never authentication.
 * The sensitive-name denylist is intentionally defensive: current auth keys do
 * not use @app_, but a future rename must not silently turn them into cache.
 */
const PROTECTED_AUTH_KEY_PARTS = [
  'auth',
  'credential',
  'refresh',
  'session',
  'supabase',
  'token',
  'vault',
] as const;

export function isDisposableVersionCacheKey(key: string): boolean {
  if (!key.startsWith('@app_')) return false;
  const normalized = key.toLowerCase();
  return !PROTECTED_AUTH_KEY_PARTS.some((part) => normalized.includes(part));
}

export function selectDisposableVersionCacheKeys(keys: readonly string[]): string[] {
  return keys.filter(isDisposableVersionCacheKey);
}
