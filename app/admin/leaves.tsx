import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, StatusBar } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LeaveService, LeaveApplication } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

type AdminTab = 'pending' | 'history';

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  pending: { label: 'Pending', color: '#D97706', bg: 'rgba(245,158,11,0.12)', icon: 'hourglass-empty' },
  approved: { label: 'Approved', color: '#059669', bg: 'rgba(16,185,129,0.12)', icon: 'check-circle' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: 'rgba(239,68,68,0.12)', icon: 'cancel' },
};

export default function AdminLeaves() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const [tab, setTab] = useState<AdminTab>('pending');
  const [pending, setPending] = useState<LeaveApplication[]>([]);
  const [history, setHistory] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaves = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const all = await LeaveService.getAll({ limit: 200 });
      const pend = all.filter((l) => l.status === 'pending');
      const hist = all
        .filter((l) => l.status === 'approved' || l.status === 'rejected')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPending(pend);
      setHistory(hist);
    } catch {
      setError('Failed to load leave requests');
    } finally {
      if (opts?.silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      if (action === 'approved') {
        await LeaveService.approve(id);
      } else {
        await LeaveService.reject(id);
      }
      alertCompat('Success', `Leave request ${action}`);
      fetchLeaves();
    } catch {
      alertCompat('Error', `Failed to ${action} request`);
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start).toLocaleDateString();
    const endDate = new Date(end).toLocaleDateString();
    if (startDate === endDate) return startDate;
    return `${startDate} – ${endDate}`;
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const leaveTypeLabel = (code: string) => {
    const m: Record<string, string> = {
      sick: 'Sick Leave',
      casual: 'Casual Leave',
      other: 'Emergency',
      earned: 'Earned Leave',
      maternity: 'Maternity',
      paternity: 'Paternity',
      unpaid: 'Unpaid',
    };
    return m[code] || code;
  };

  const renderPendingItem = ({ item, index }: { item: LeaveApplication; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Image
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
            style={styles.avatar}
          />
          <View style={styles.info}>
            <Text style={styles.name}>{item.applicant_name || 'Unknown'}</Text>
            <Text style={styles.role}>
              {item.applicant_role
                ? item.applicant_role.charAt(0).toUpperCase() + item.applicant_role.slice(1)
                : 'Staff / Student'}
            </Text>
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{calculateDuration(item.start_date, item.end_date)}</Text>
          </View>
        </View>
        <View style={styles.reasonBox}>
          <Text style={styles.leaveType}>
            {leaveTypeLabel(item.leave_type).toUpperCase()} • {formatDateRange(item.start_date, item.end_date)}
          </Text>
          <Text style={styles.metaMuted}>Applied {formatDateTime(item.created_at)}</Text>
          <Text style={styles.reasonText}>"{item.reason}"</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, styles.rejectBtn]} onPress={() => handleAction(item.id, 'rejected')}>
            <Ionicons name="close-circle" size={18} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.approveBtn]} onPress={() => handleAction(item.id, 'approved')}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={[styles.actionText, { color: '#10B981' }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const renderHistoryItem = ({ item, index }: { item: LeaveApplication; index: number }) => {
    const sm = STATUS_META[item.status] || STATUS_META.pending;
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(380)}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
              style={styles.avatar}
            />
            <View style={styles.info}>
              <Text style={styles.name}>{item.applicant_name || 'Unknown'}</Text>
              <Text style={styles.role}>
                {item.applicant_role
                  ? item.applicant_role.charAt(0).toUpperCase() + item.applicant_role.slice(1)
                  : 'Staff / Student'}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: sm.bg }]}>
              <MaterialIcons name={sm.icon} size={14} color={sm.color} />
              <Text style={[styles.statusPillText, { color: sm.color }]}>{sm.label}</Text>
            </View>
          </View>
          <View style={styles.reasonBox}>
            <Text style={styles.leaveType}>
              {leaveTypeLabel(item.leave_type).toUpperCase()} • {formatDateRange(item.start_date, item.end_date)}
            </Text>
            <Text style={styles.metaMuted}>{calculateDuration(item.start_date, item.end_date)}</Text>
            <Text style={styles.reasonText}>"{item.reason}"</Text>
            <View style={styles.historyMetaBlock}>
              <Text style={styles.historyMetaLine}>
                <Text style={styles.historyMetaLabel}>Applied </Text>
                {formatDateTime(item.created_at)}
              </Text>
              {item.reviewed_at ? (
                <Text style={styles.historyMetaLine}>
                  <Text style={styles.historyMetaLabel}>Reviewed </Text>
                  {formatDateTime(item.reviewed_at)}
                  {item.reviewed_by_name ? ` · ${item.reviewed_by_name}` : ''}
                </Text>
              ) : null}
              {item.review_remarks ? (
                <Text style={styles.reviewRemarks}>
                  <Text style={styles.historyMetaLabel}>Note </Text>
                  {item.review_remarks}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  const listData = tab === 'pending' ? pending : history;
  const emptyMessage =
    tab === 'pending' ? 'No pending leave requests' : 'No processed leave history yet';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminHeader title="Leave Management" showBackButton={true} />

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'pending' && styles.tabActive]}
          onPress={() => setTab('pending')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>Pending</Text>
          {pending.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pending.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
          {history.length > 0 && (
            <View style={[styles.tabBadge, styles.tabBadgeMuted]}>
              <Text style={[styles.tabBadgeText, styles.tabBadgeTextMuted]}>{history.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LogoLoader size={60} color="#6366F1" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={[styles.emptyText, { marginBottom: 20 }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchLeaves()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={tab === 'pending' ? renderPendingItem : renderHistoryItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => fetchLeaves({ silent: true })}
          ListHeaderComponent={
            listData.length > 0 ? (
              <Text style={styles.sectionTitle}>
                {tab === 'pending' ? `Pending requests (${pending.length})` : `History (${history.length})`}
              </Text>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
        />
      )}
    </View>
  );
}

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 10,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.background,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    tabActive: {
      borderColor: '#6366F1',
      backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)',
    },
    tabText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: '#6366F1',
    },
    tabBadge: {
      minWidth: 22,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: '#6366F1',
      alignItems: 'center',
    },
    tabBadgeMuted: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    },
    tabBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#fff',
    },
    tabBadgeTextMuted: {
      color: theme.colors.text,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    retryButton: {
      backgroundColor: '#6366F1',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    listContent: {
      padding: 20,
      paddingBottom: 32,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      marginBottom: 14,
      marginLeft: 2,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: theme.colors.background,
      borderRadius: 16,
      padding: 15,
      marginBottom: 15,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
      borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'transparent',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginRight: 15,
      backgroundColor: theme.colors.card,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    role: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    durationBadge: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    durationText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    reasonBox: {
      backgroundColor: theme.colors.card,
      padding: 12,
      borderRadius: 12,
      marginBottom: 4,
    },
    leaveType: {
      fontSize: 12,
      color: '#6366F1',
      fontWeight: '600',
      marginBottom: 6,
    },
    metaMuted: {
      fontSize: 11,
      color: theme.colors.textTertiary,
      marginBottom: 8,
    },
    reasonText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      lineHeight: 20,
    },
    historyMetaBlock: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      gap: 6,
    },
    historyMetaLine: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    historyMetaLabel: {
      fontWeight: '700',
      color: theme.colors.textTertiary,
    },
    reviewRemarks: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
      marginTop: 2,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      marginHorizontal: 5,
    },
    rejectBtn: {
      backgroundColor: '#FEF2F2',
    },
    approveBtn: {
      backgroundColor: '#ECFDF5',
    },
    actionText: {
      fontWeight: '600',
      marginLeft: 6,
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 50,
      color: theme.colors.textTertiary,
      fontSize: 16,
    },
  });
