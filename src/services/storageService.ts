import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCHOOL_ID } from '../constants/school';

export interface SyncMetadata {
    lastSyncedAt: string;
    version: number;
}

export interface StoredRecord<T> {
    data: T[];
    lastSyncedAt: string;
    version: number;
}

/**
 * A lightweight offline-first storage utility supporting delta-sync architectures.
 * Keys all records by school_id and userId (F5) to ensure tenant boundaries.
 */
export const StorageService = {
    /**
     * Retrieves data from AsyncStorage, keyed by school_id and userId.
     */
    async get<T>(userId: string, dataType: string): Promise<StoredRecord<T> | null> {
        try {
            const fullKey = `@app_${SCHOOL_ID}_${userId}_${dataType}`;
            const data = await AsyncStorage.getItem(fullKey);
            if (data) {
                return JSON.parse(data) as StoredRecord<T>;
            }
            return null;
        } catch (e) {
            if (__DEV__) console.warn(`[StorageService] Failed to GET ${dataType} for ${userId}`, e);
            return null;
        }
    },

    /**
     * Saves data to AsyncStorage, keyed by the userId. Replaces the whole dataset and updates lastSyncedAt.
     */
    async set<T>(userId: string, dataType: string, data: T[]): Promise<void> {
        try {
            const fullKey = `@app_${SCHOOL_ID}_${userId}_${dataType}`;
            const record: StoredRecord<T> = {
                data,
                lastSyncedAt: new Date().toISOString(),
                version: 1
            };
            await AsyncStorage.setItem(fullKey, JSON.stringify(record));
        } catch (e) {
            if (__DEV__) console.warn(`[StorageService] Failed to SET ${dataType} for ${userId}`, e);
        }
    },

    /**
     * Merges a sparse or filtered set of new records with the existing cached state based on an `idKey`.
     */
    async merge<T>(userId: string, dataType: string, newRecords: T[], idKey: keyof T): Promise<T[]> {
        const existing = await this.get<T>(userId, dataType);

        let mergedData: T[] = [];

        if (existing?.data) {
            // Upsert mechanism:
            // 1. Create a map of existing records keyed by ID.
            const map = new Map<any, T>();
            existing.data.forEach(item => map.set(item[idKey], item));

            // 2. Set new records, overwriting old ones.
            newRecords.forEach(item => map.set(item[idKey], item));

            // 3. Convert back to array.
            mergedData = Array.from(map.values());
        } else {
            mergedData = newRecords;
        }

        await this.set(userId, dataType, mergedData);
        return mergedData;
    },

    /**
     * Removes all cached entries relating strictly to the specified `userId`.
     */
    async clear(userId: string): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const userKeys = keys.filter(k => k.startsWith(`@app_${SCHOOL_ID}_${userId}_`));
            await AsyncStorage.multiRemove(userKeys);
        } catch (e) {
            if (__DEV__) console.warn(`[StorageService] Failed to CLEAR for ${userId}`, e);
        }
    },

    /**
     * Wipes the entire AsyncStorage. Use only during terminal failures/major conflicts.
     */
    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.clear();
        } catch (e) {
            if (__DEV__) console.warn(`[StorageService] Failed to CLEAR ALL`, e);
        }
    }
};
