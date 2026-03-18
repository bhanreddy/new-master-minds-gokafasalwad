import { StorageService } from './storageService';
import { api } from './apiClient';
import { supabase } from './supabaseConfig';
import { NoticeService, LeaveService } from './commonServices';
import { StudentService } from './studentService';
import { TimetableService } from './timetableService';
import { FeeService } from './feeService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SyncService = {
    /**
     * Syncs Notices using delta strategy based on createdAt/updatedAt
     */
    async syncNotices(params?: any, forceReFetch = false) {
        const userId = await getUserId();
        if (!userId) return [];

        const cached = forceReFetch ? null : await StorageService.get<any>(userId, 'notices');
        const lastSyncedAt = cached ? cached.lastSyncedAt : null;

        if (cached && !forceReFetch) {
            // Trigger background fetch, merge silently
            api.get<any>('/notices', { ...params, lastSyncedAt }).then(async (newRecords) => {
                if (newRecords && newRecords.length > 0) {
                    await StorageService.merge(userId, 'notices', newRecords, 'id');
                }
            }).catch(() => { });
            return cached.data;
        }

        const freshData = await api.get<any[]>('/notices', params);
        await StorageService.set(userId, 'notices', freshData);
        return freshData;
    },

    /**
     * Syncs user profile. Profile rarely deltas directly, usually a full refresh.
     */
    async syncProfile(forceReFetch = false) {
        const userId = await getUserId();
        if (!userId) return null;

        const cached = forceReFetch ? null : await StorageService.get<any>(userId, 'profile');
        if (cached && !forceReFetch) {
            api.get<any>('/auth/me').then(async (fresh) => {
                await StorageService.set(userId, 'profile', [fresh]);
            }).catch(() => { });
            return cached.data[0];
        }

        const freshData = await api.get<any>('/auth/me');
        await StorageService.set(userId, 'profile', [freshData]);
        return freshData;
    },

    /**
     * Delta Sync Attendance
     */
    async syncAttendance(studentId: string, params?: any, forceReFetch = false) {
        const userId = await getUserId();
        if (!userId) return null;

        const cacheKey = `attendance_${studentId}`;
        const cached = forceReFetch ? null : await StorageService.get<any>(userId, cacheKey);
        const lastSyncedAt = cached ? cached.lastSyncedAt : null;

        if (cached && !forceReFetch) {
            api.get<any>(`/students/${studentId}/attendance`, { ...params, lastSyncedAt }).then(async (res) => {
                if (res?.records && res.records.length > 0) {
                    const merged = await StorageService.merge(userId, cacheKey, res.records, 'id');
                    // Update summary in background
                    const fullRecord = { summary: res.summary || cached.data[0]?.summary, records: merged };
                    await StorageService.set(userId, cacheKey, [fullRecord]);
                }
            }).catch(() => { });
            return cached.data[0];
        }

        const freshData = await api.get<any>(`/students/${studentId}/attendance`, params);
        await StorageService.set(userId, cacheKey, [freshData]);
        return freshData;
    },

    /**
     * Delta Sync Timetable
     */
    async syncTimetable(classSectionId: string, params?: any, forceReFetch = false) {
        const userId = await getUserId();
        if (!userId) return [];

        const cacheKey = `timetable_${classSectionId}`;
        const cached = forceReFetch ? null : await StorageService.get<any>(userId, cacheKey);
        const lastSyncedAt = cached ? cached.lastSyncedAt : null;

        if (cached && !forceReFetch) {
            api.get<any>(`/timetable/${classSectionId}/slots`, { ...params, lastSyncedAt }).then(async (newRecords) => {
                if (newRecords && newRecords.length > 0) {
                    await StorageService.merge(userId, cacheKey, newRecords, 'id');
                }
            }).catch(() => { });
            return cached.data;
        }

        const freshData = await api.get<any[]>(`/timetable/${classSectionId}/slots`, params);
        await StorageService.set(userId, cacheKey, freshData);
        return freshData;
    },

    /**
     * Delta Sync Fees
     */
    async syncFees(studentId: string, params?: any, forceReFetch = false) {
        const userId = await getUserId();
        if (!userId) return null;

        const cacheKey = `fees_${studentId}`;
        const cached = forceReFetch ? null : await StorageService.get<any>(userId, cacheKey);
        const lastSyncedAt = cached ? cached.lastSyncedAt : null;

        if (cached && !forceReFetch) {
            api.get<any>(`/fees/students/${studentId}`, { ...params, lastSyncedAt }).then(async (res) => {
                if (res?.fees && res.fees.length > 0) {
                    const merged = await StorageService.merge(userId, cacheKey, res.fees, 'id');
                    const fullRecord = { student: res.student || cached.data[0]?.student, summary: res.summary || cached.data[0]?.summary, fees: merged };
                    await StorageService.set(userId, cacheKey, [fullRecord]);
                }
            }).catch(() => { });
            return cached.data[0];
        }

        const freshData = await api.get<any>(`/fees/students/${studentId}`, params);
        await StorageService.set(userId, cacheKey, [freshData]);
        return freshData;
    },

    async clearUserCache(userId: string) {
        await StorageService.clear(userId);
    }
};

async function getUserId() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
}
