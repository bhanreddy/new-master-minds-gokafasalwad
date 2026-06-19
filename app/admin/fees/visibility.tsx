import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Switch,
    TouchableOpacity, ActivityIndicator, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AdminHeader from '../../../src/components/AdminHeader';
import { AdminService } from '../../../src/services/adminService';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { ACCOUNTS_STAT_KEYS, normalizeAccountsDashboardConfig, toggleAccountsDashboardStat } from '../../../src/utils/constants';
import { invalidateApiQueryCache } from '../../../src/hooks/useApiQuery';

const STAT_LABELS: Record<string, string> = {
    total_collection_month: 'Total Collection (This Month)',
    todays_collection: "Today's Collection",
    pending_dues: 'Pending Dues',
    revenue_trend: 'Financial Performance / Revenue Trend',
    collection_efficiency: 'Collection Efficiency',
    avg_attendance: 'Avg Attendance',
    academic_score: 'Academic Score',
    system_insights: 'System Insights'
};

const STAT_ICONS: Record<string, string> = {
    total_collection_month: 'wallet-outline',
    todays_collection: 'cash-outline',
    pending_dues: 'alert-circle-outline',
    revenue_trend: 'trending-up-outline',
    collection_efficiency: 'calculator-outline',
    avg_attendance: 'people-outline',
    academic_score: 'school-outline',
    system_insights: 'bulb-outline'
};

export default function AccountsDashboardVisibilityScreen() {
    const { theme, isDark } = useTheme();
    const { authChecked, session } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [config, setConfig] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!authChecked || !session) return;
        loadConfig();
    }, [authChecked, session]);

    /** Build an all-visible default config from the canonical key list. */
    const buildDefaultConfig = (): Record<string, boolean> =>
        normalizeAccountsDashboardConfig();

    const loadConfig = async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const res = await AdminService.getAccountsDashboardConfig();
            // Safely extract config — handle both { config: {...} } and direct config shapes
            const resolved = res?.config ?? (res && typeof res === 'object' && !('config' in res) ? res as Record<string, boolean> : null);
            if (resolved && typeof resolved === 'object') {
                setConfig(normalizeAccountsDashboardConfig(resolved));
            } else {
                // Server returned unexpected shape — fall back to all-visible defaults
                console.warn('Unexpected config response shape, using defaults:', res);
                setConfig(buildDefaultConfig());
            }
        } catch (err: any) {
            console.error('Failed to load accounts visibility config:', err);
            const detail = err?.message || 'Unknown error';
            alertCompat('Error', `Failed to load configuration settings.\n\n${detail}`);
            // Fall back to all-visible defaults so the page is still usable
            setConfig(buildDefaultConfig());
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (key: string) => {
        setConfig(prev => toggleAccountsDashboardStat(prev, key));
    };

    const handleSetAll = (value: boolean) => {
        const updated = normalizeAccountsDashboardConfig();
        ACCOUNTS_STAT_KEYS.forEach(key => {
            updated[key] = value;
        });
        setConfig(updated);
    };

    const handleSave = async () => {
        setSaving(true);
        const payload = normalizeAccountsDashboardConfig(config);
        try {
            await AdminService.updateAccountsDashboardConfig(payload);
            invalidateApiQueryCache('accounts-dashboard-stats');
            setConfig(payload);
            alertCompat('Success', 'Visibility settings saved successfully.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (err: any) {
            console.error('Failed to save accounts visibility config:', err);
            const detail = err?.message || 'Unknown error';
            alertCompat('Error', `Failed to save configuration settings.\n\n${detail}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading settings...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
            <AdminHeader title="Accounts Visibility" showBackButton={true} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.duration(400)} style={styles.introCard}>
                    <View style={styles.blob1} />
                    <View style={styles.profileTop}>
                        <View style={styles.infoIconBox}>
                            <Ionicons name="eye-outline" size={24} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.introTitle, { color: theme.colors.text }]}>Dashboard Stat Controls</Text>
                            <Text style={[styles.introDesc, { color: theme.colors.textSecondary }]}>
                                Toggle which financial and metric sections are visible on the accounts team dashboard. Missing configurations default to visible.
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Error Banner with Retry */}
                {loadError && (
                    <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.errorBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                        <Ionicons name="warning-outline" size={18} color="#DC2626" />
                        <Text style={styles.errorBannerText}>
                            Could not load saved settings. Showing defaults (all visible). Your changes will still save.
                        </Text>
                        <TouchableOpacity onPress={loadConfig} style={styles.retryBtn} activeOpacity={0.7}>
                            <Ionicons name="refresh-outline" size={14} color="#7C3AED" />
                            <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Master Actions */}
                <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                        onPress={() => handleSetAll(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="eye-outline" size={16} color="#10B981" />
                        <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Show All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                        onPress={() => handleSetAll(false)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="eye-off-outline" size={16} color="#EF4444" />
                        <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Hide All</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Config List */}
                <Animated.View entering={FadeInDown.delay(150).duration(500)} style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {ACCOUNTS_STAT_KEYS.map((key, index) => {
                        const isLast = index === ACCOUNTS_STAT_KEYS.length - 1;
                        const label = STAT_LABELS[key] || key;
                        const icon = STAT_ICONS[key] || 'checkbox-outline';
                        const isEnabled = config[key] !== false; // opt-out default: visible if not false

                        return (
                            <React.Fragment key={key}>
                                <View style={styles.row}>
                                    <View style={[styles.iconBox, { backgroundColor: isEnabled ? '#EDE9FE' : '#F3F4F6' }]}>
                                        <Ionicons name={icon as any} size={18} color={isEnabled ? '#7C3AED' : '#9CA3AF'} />
                                    </View>
                                    <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
                                    <Switch
                                        trackColor={{ false: theme.colors.border, true: '#818CF8' }}
                                        thumbColor="#fff"
                                        onValueChange={() => handleToggle(key)}
                                        value={isEnabled}
                                    />
                                </View>
                                {!isLast && <View style={[styles.divider, { backgroundColor: theme.colors.borderLight }]} />}
                            </React.Fragment>
                        );
                    })}
                </Animated.View>

                {/* Save button */}
                <Animated.View entering={FadeInDown.delay(200).duration(500)}>
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                        activeOpacity={0.8}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="save-outline" size={18} color="#fff" />
                                <Text style={styles.saveText}>Save Configuration</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, fontWeight: '500' },
    scroll: { padding: 20, paddingBottom: 60 },
    introCard: {
        borderRadius: 22, padding: 20,
        marginBottom: 20, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.15)',
        backgroundColor: '#F5F3FF',
        shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
    },
    blob1: {
        position: 'absolute', top: -40, right: -30,
        width: 130, height: 130, borderRadius: 65,
        backgroundColor: '#7C3AED', opacity: 0.05,
    },
    profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    infoIconBox: {
        width: 48, height: 48, borderRadius: 16,
        backgroundColor: '#EDE9FE', justifyContent: 'center',
        alignItems: 'center', borderWidth: 1, borderColor: '#DDD6FE'
    },
    introTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    introDesc: { fontSize: 12, lineHeight: 18 },
    actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02, shadowRadius: 4, elevation: 1
    },
    actionBtnText: { fontSize: 13, fontWeight: '700' },
    card: {
        borderRadius: 18, overflow: 'hidden', borderWidth: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
        marginBottom: 26
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 16,
    },
    iconBox: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', marginRight: 13,
    },
    label: { flex: 1, fontSize: 14, fontWeight: '600' },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 65 },
    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#7C3AED', paddingVertical: 15, borderRadius: 16,
        shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25, shadowRadius: 8, elevation: 6
    },
    saveBtnDisabled: { backgroundColor: '#A78BFA' },
    saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    errorBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 14, borderRadius: 14, borderWidth: 1,
        marginBottom: 16, flexWrap: 'wrap',
    },
    errorBannerText: { flex: 1, fontSize: 12, color: '#991B1B', lineHeight: 17 },
    retryBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 8, backgroundColor: '#EDE9FE',
    },
    retryBtnText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
});
