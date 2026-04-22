import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Platform, Pressable
} from 'react-native';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAccountsWebChrome } from '../../../src/contexts/AccountsWebChromeContext';
import { FeeService } from '../../../src/services/feeService';
import { StudentFee, FeeResponse } from '../../../src/types/models';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import LogoLoader from '../../../src/components/LogoLoader';

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  paid: { bg: '#D1FAE5', text: '#065F46', dot: '#10B981', label: 'PAID' },
  partial: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: 'PARTIAL' },
  pending: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'PENDING' },
  overdue: { bg: '#FEE2E2', text: '#7F1D1D', dot: '#DC2626', label: 'OVERDUE' },
};
const STATUS_CONFIG_DARK: Record<string, { bg: string; text: string; dot: string }> = {
  paid: { bg: 'rgba(16,185,129,0.15)', text: '#34D399', dot: '#10B981' },
  partial: { bg: 'rgba(245,158,11,0.15)', text: '#FCD34D', dot: '#F59E0B' },
  pending: { bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5', dot: '#EF4444' },
  overdue: { bg: 'rgba(220,38,38,0.2)', text: '#F87171', dot: '#DC2626' },
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ paidRatio, isDark }: { paidRatio: number; isDark: boolean }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.min(Math.max(paidRatio, 0), 1),
      duration: 900,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, [paidRatio]);

  return (
    <View style={progressStyles.track(isDark)}>
      <Animated.View style={[
        progressStyles.fill,
        {
          width: width.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
          backgroundColor: paidRatio >= 1 ? '#10B981'
            : paidRatio >= 0.5 ? '#F59E0B'
              : '#EF4444',
        }
      ]} />
    </View>
  );
}
const progressStyles = {
  track: (isDark: boolean) => ({
    height: 5,
    borderRadius: 3,
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6',
    overflow: 'hidden' as const,
    marginVertical: 10,
  }),
  fill: {
    height: '100%' as any,
    borderRadius: 3,
  },
};

// ─── Fee Card ─────────────────────────────────────────────────────────────────
function FeeCard({
  fee, index, isDark, theme,
  onPayment, onAdjustment,
}: {
  fee: StudentFee; index: number; isDark: boolean; theme: Theme;
  onPayment: (f: StudentFee) => void;
  onAdjustment: (f: StudentFee) => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const isPaid = fee.status === 'paid';
  const due = fee.amount_due - fee.discount - fee.amount_paid;
  const paidRatio = fee.amount_due > 0 ? fee.amount_paid / fee.amount_due : 0;

  const s = isDark
    ? STATUS_CONFIG_DARK[fee.status] || STATUS_CONFIG_DARK.pending
    : STATUS_CONFIG[fee.status] || STATUS_CONFIG.pending;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      tension: 60,
      friction: 11,
      delay: 100 + index * 80,
      useNativeDriver: true,
    }).start();
  }, []);

  const cardBg = isDark ? '#1C1F2A' : '#FFFFFF';
  const textPri = isDark ? '#F9FAFB' : '#111827';
  const textSec = isDark ? 'rgba(255,255,255,0.4)' : '#6B7280';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] })
      }],
      marginBottom: 12,
    }}>
      <View style={[fcStyles.card, { backgroundColor: cardBg, borderColor: border }]}>

        {/* Header */}
        <View style={fcStyles.header}>
          <View style={fcStyles.headerLeft}>
            <View style={[fcStyles.dot, { backgroundColor: s.dot }]} />
            <Text style={[fcStyles.feeType, { color: textPri }]} numberOfLines={1}>
              {fee.fee_type}
            </Text>
          </View>
          <View style={[fcStyles.badge, { backgroundColor: s.bg }]}>
            <Text style={[fcStyles.badgeText, { color: s.text }]}>
              {STATUS_CONFIG[fee.status]?.label ?? fee.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Progress */}
        <ProgressBar paidRatio={paidRatio} isDark={isDark} />
        <Text style={[fcStyles.progressLabel, { color: textSec }]}>
          {Math.round(paidRatio * 100)}% collected
        </Text>

        {/* Numbers grid */}
        <View style={fcStyles.grid}>
          <NumCell label="Total" value={`₹${fee.amount_due.toLocaleString('en-IN')}`} color={textPri} textSec={textSec} />
          <NumCell label="Paid" value={`₹${fee.amount_paid.toLocaleString('en-IN')}`} color="#10B981" textSec={textSec} />
          {fee.discount > 0 && (
            <NumCell label="Waiver" value={`-₹${fee.discount.toLocaleString('en-IN')}`} color="#6366F1" textSec={textSec} />
          )}
          <NumCell
            label="Due"
            value={`₹${due.toLocaleString('en-IN')}`}
            color={due > 0 ? '#EF4444' : '#10B981'}
            textSec={textSec}
            emphasis
          />
        </View>

        {/* Divider */}
        <View style={[fcStyles.divider, { backgroundColor: border }]} />

        {/* Actions */}
        <View style={fcStyles.actions}>
          <ActionBtn
            icon="cash-outline"
            label="Collect"
            color="#10B981"
            disabled={isPaid}
            isDark={isDark}
            onPress={() => onPayment(fee)}
          />
          <ActionBtn
            icon="cut-outline"
            label="Adjustment"
            color="#6366F1"
            disabled={false}
            isDark={isDark}
            onPress={() => onAdjustment(fee)}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function NumCell({ label, value, color, textSec, emphasis }: {
  label: string; value: string; color: string; textSec: string; emphasis?: boolean;
}) {
  return (
    <View style={fcStyles.numCell}>
      <Text style={[fcStyles.numLabel, { color: textSec }]}>{label}</Text>
      <Text style={[fcStyles.numValue, { color }, emphasis && { fontSize: 17 }]}>
        {value}
      </Text>
    </View>
  );
}

function ActionBtn({ icon, label, color, disabled, isDark, onPress }: {
  icon: string; label: string; color: string; disabled: boolean; isDark: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const activeColor = disabled ? (isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB') : color;
  const bgColor = disabled
    ? (isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB')
    : (isDark ? `${color}22` : `${color}15`);

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        style={[fcStyles.actionBtn, { backgroundColor: bgColor, borderColor: disabled ? 'transparent' : `${color}40` }]}
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => !disabled && Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
      >
        <Ionicons name={icon as any} size={16} color={activeColor} />
        <Text style={[fcStyles.actionLabel, { color: activeColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const fcStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  feeType: { fontSize: 15, fontWeight: '700', flex: 1 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  progressLabel: { fontSize: 11, fontWeight: '600', marginTop: -4, marginBottom: 8 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  numCell: { alignItems: 'center', flex: 1 },
  numLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3, textTransform: 'uppercase' },
  numValue: { fontSize: 14, fontWeight: '800' },
  divider: { height: 1, marginVertical: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionLabel: { fontSize: 13, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StudentFeeLedger() {
  const { theme, isDark } = useTheme();
  const { shellActive } = useAccountsWebChrome();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const studentId = params.studentId as string;
  const studentName = params.name as string;

  const [loading, setLoading] = useState(true);
  const [feeData, setFeeData] = useState<FeeResponse | null>(null);

  // Page-level animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const summaryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (studentId) loadLedger();
  }, [studentId]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await FeeService.getStudentFees(studentId);
      setFeeData(data);
      Animated.stagger(60, [
        Animated.spring(headerAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.spring(summaryAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } catch {
      alertCompat('Error', 'Failed to load financial ledger');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = (fee: StudentFee) => {
    router.push({
      pathname: '/accounts/fees/collect' as any,
      params: {
        feeId: fee.id, studentId,
        name: studentName,
        admissionNo: feeData?.student.admission_no,
        feeType: fee.fee_type,
        due: (fee.amount_due - fee.discount - fee.amount_paid).toString(),
      },
    });
  };

  const handleAdjustment = (fee: StudentFee) => {
    router.push({
      pathname: '/accounts/fees/adjust' as any,
      params: { feeId: fee.id, studentId, name: studentName, feeType: fee.fee_type },
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <LogoLoader size={52} color="#3B82F6" />
        <Text style={styles.loadingText}>Loading ledger…</Text>
      </View>
    );
  }

  const summary = feeData?.summary;
  const totalDue = parseFloat(String(summary?.total_due || 0));
  const totalPaid = parseFloat(String(summary?.total_paid || 0));
  const balance = parseFloat(String(summary?.balance || 0));
  const overallRatio = totalDue > 0 ? totalPaid / totalDue : 0;

  return (
    <View style={styles.container}>
      {!shellActive && <AdminHeader title="Fee Ledger" showBackButton />}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Student Hero Card ── */}
        <Animated.View style={[
          styles.heroCard,
          {
            opacity: headerAnim,
            transform: [{
              translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] })
            }]
          }
        ]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>
                {(studentName || 'S').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName} numberOfLines={1}>{studentName}</Text>
              <Text style={styles.heroId}>
                ID: {(studentId || '').split('-')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {balance > 0 ? 'DUES PENDING' : 'ALL CLEAR'}
              </Text>
            </View>
          </View>

          {/* Overall progress */}
          <View style={styles.overallProgress}>
            <View style={styles.overallProgressTrack}>
              <View style={[
                styles.overallProgressFill,
                { width: `${Math.round(overallRatio * 100)}%` as any }
              ]} />
            </View>
            <Text style={styles.overallProgressText}>
              {Math.round(overallRatio * 100)}% of total fees collected
            </Text>
          </View>
        </Animated.View>

        {/* ── Summary Strip ── */}
        <Animated.View style={[
          styles.summaryStrip,
          {
            opacity: summaryAnim,
            transform: [{
              translateY: summaryAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] })
            }]
          }
        ]}>
          <SummaryCell label="Total Due" value={`₹${totalDue.toLocaleString('en-IN')}`}
            color={isDark ? '#F9FAFB' : '#111827'} isDark={isDark} />
          <View style={styles.summarySep} />
          <SummaryCell label="Collected" value={`₹${totalPaid.toLocaleString('en-IN')}`}
            color="#10B981" isDark={isDark} />
          <View style={styles.summarySep} />
          <SummaryCell label="Balance" value={`₹${balance.toLocaleString('en-IN')}`}
            color={balance > 0 ? '#EF4444' : '#10B981'} isDark={isDark} />
        </Animated.View>

        {/* ── Fee Cards ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>FEE BREAKDOWN</Text>
          <Text style={styles.sectionCount}>
            {feeData?.fees.length ?? 0} items
          </Text>
        </View>

        {feeData?.fees.map((fee, index) => (
          <FeeCard
            key={fee.id}
            fee={fee}
            index={index}
            isDark={isDark}
            theme={theme}
            onPayment={handlePayment}
            onAdjustment={handleAdjustment}
          />
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Summary Cell ─────────────────────────────────────────────────────────────
function SummaryCell({ label, value, color, isDark }: {
  label: string; value: string; color: string; isDark: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{
        fontSize: 10, fontWeight: '700', letterSpacing: 0.7,
        color: isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF',
        marginBottom: 5, textTransform: 'uppercase',
      }}>
        {label}
      </Text>
      <Text style={{ fontSize: 17, fontWeight: '800', color }}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#0F1117' : '#F3F4F8',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? '#0F1117' : '#F3F4F8',
    gap: 12,
  },
  loadingText: {
    color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
  },

  // ── Hero Card ──
  heroCard: {
    backgroundColor: isDark ? '#1C1F2A' : '#1E293B',
    borderRadius: 22,
    padding: 20,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.4 : 0.25,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  heroAvatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(59,130,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  heroAvatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#60A5FA',
  },
  heroInfo: { flex: 1 },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 3,
  },
  heroId: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  heroBadge: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  heroBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FCA5A5',
    letterSpacing: 0.8,
  },
  overallProgress: { gap: 6 },
  overallProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  overallProgressText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },

  // ── Summary Strip ──
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  summarySep: {
    width: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    marginVertical: 4,
  },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB',
  },
});