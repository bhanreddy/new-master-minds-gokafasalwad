import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCHOOL_ID } from '../constants/school';

const SCHEMA_VERSION = 1;

type StoredEntry<T> = {
  schemaVersion: number;
  data: T;
  storedAt: number;
};

/** Disk key: `@app_${SCHOOL_ID}_${userId}_q_${suffix}${query ? '?' + query : ''}` */
export function buildQueryCacheKey(userId: string, suffix: string, queryKey = ''): string {
  return `@app_${SCHOOL_ID}_${userId}_q_${suffix}${queryKey ? `?${queryKey}` : ''}`;
}

export const persistentQueryCache = {
  async read<T>(
    userId: string,
    suffix: string,
    queryKey = '',
  ): Promise<{ data: T; storedAt: number } | null> {
    if (!userId) return null;
    const key = buildQueryCacheKey(userId, suffix, queryKey);
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredEntry<T>;
      if (parsed.schemaVersion !== SCHEMA_VERSION || parsed.storedAt == null) {
        AsyncStorage.removeItem(key).catch(() => {});
        return null;
      }
      return { data: parsed.data, storedAt: parsed.storedAt };
    } catch {
      AsyncStorage.removeItem(key).catch(() => {});
      return null;
    }
  },

  write<T>(userId: string, suffix: string, data: T, storedAt: number, queryKey = ''): void {
    if (!userId) return;
    const key = buildQueryCacheKey(userId, suffix, queryKey);
    const entry: StoredEntry<T> = { schemaVersion: SCHEMA_VERSION, data, storedAt };
    AsyncStorage.setItem(key, JSON.stringify(entry)).catch(() => {});
  },

  async removeMatching(userId?: string, suffix?: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const filtered = keys.filter((k) => {
        if (!k.startsWith(`@app_${SCHOOL_ID}_`)) return false;
        if (!k.includes('_q_')) return false;
        if (userId && !k.startsWith(`@app_${SCHOOL_ID}_${userId}_q_`)) return false;
        if (suffix) {
          const needle = `_q_${suffix}`;
          return k.includes(needle) && (k.endsWith(needle) || k.includes(`${needle}?`));
        }
        return true;
      });
      if (filtered.length > 0) await AsyncStorage.multiRemove(filtered);
    } catch (e) {
      if (__DEV__) console.warn('[persistentQueryCache] removeMatching failed:', e);
    }
  },
};
