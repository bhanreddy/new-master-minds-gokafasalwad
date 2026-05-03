import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Pressable, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAccountsWebChrome } from '../../../src/contexts/AccountsWebChromeContext';
import Animated, {
  FadeInDown, FadeIn, useAnimatedStyle,
  useSharedValue, withSpring, withTiming, interpolate
} from 'react-native-reanimated';
import { useAuth } from '../../../src/hooks/useAuth';
import { FeeService } from '../../../src/services/feeService';
import { useTheme } from '../../../src/hooks/useTheme';
import LogoLoader from '../../../src/components/LogoLoader';

// ─── Constants ────────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Paid', 'Partial', 'Pending'] as const;
type FilterType = typeof FILTERS[number];

const STATUS_CONFIG = {
  Paid: { light: { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' }, dark: { bg: 'rgba(16,185,129,0.15)', text: '#34D399', dot: '#10B981' } },
  Partial: { light: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' }, dark: { bg: 'rgba(245,158,11,0.15)', text: '#FCD34D', dot: '#F59E0B' } },
  Pending: { light: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' }, dark: { bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5', dot: '#EF4444' } },
} as const;

// ─── Mini Progress Bar ────────────────────────────────────────────────────────
function MiniProgress({ paid, total, isDark }: { paid: number; total: number; isDark: boolean }) {
  const ratio = total > 0 ? Math.min(paid / total, 1) : 0;
  const color = ratio >= 1 ? '#10B981' : ratio >= 0.5 ? '#F59E0B' : '#EF4444';
  return (
    <View style={{
      height: 3, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6',
      overflow: 'hidden', marginTop: 10,
    }}>
      <View style={{ height: '100%', width: `${ratio * 100}%`, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────
const StudentCard = React.memo(function StudentCard({
  item, index, isDark, onPress,
}: {
  item: any; index: number; isDark: boolean; onPress: () => void;
}) {
  const pressed = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));

  const s = (STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.Pending)[isDark ? 'dark' : 'light'];
  const cardBg = isDark ? '#1C1F2A' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const textPri = isDark ? '#F9FAFB' : '#111827';
  const textSec = isDark ? 'rgba(255,255,255,0.4)' : '#6B7280';

  const due = parseFloat(item.due) || 0;
  const paid = parseFloat(item.paid) || 0;
  const total = parseFloat(item.total) || 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400).springify()} style={animStyle}>
      <Pressable
        style={[cardStyles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={onPress}
        onPressIn={() => { pressed.value = withSpring(1, { damping: 20 }); }}
        onPressOut={() => { pressed.value = withSpring(0, { damping: 20 }); }}
      >
        {/* Left accent line by status */}
        <View style={[cardStyles.accent, { backgroundColor: s.dot }]} />

        <View style={cardStyles.inner}>
          {/* Header row */}
          <View style={cardStyles.headerRow}>
            <View style={cardStyles.avatarWrap}>
              <Text style={[cardStyles.avatarText, { color: s.dot }]}>
                {(item.name || 'S').charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={cardStyles.nameBlock}>
              <Text style={[cardStyles.name, { color: textPri }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={cardStyles.metaRow}>
                {item.admissionNo ? (
                  <View style={[cardStyles.metaTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
                    <Text style={[cardStyles.metaTagText, { color: textSec }]}>#{item.admissionNo}</Text>
                  </View>
                ) : null}
                <View style={[cardStyles.metaTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
                  <Text style={[cardStyles.metaTagText, { color: textSec }]}>{item.class}</Text>
                </View>
              </View>
            </View>

            <View style={[cardStyles.statusBadge, { backgroundColor: s.bg }]}>
              <View style={[cardStyles.statusDot, { backgroundColor: s.dot }]} />
              <Text style={[cardStyles.statusText, { color: s.text }]}>{item.status}</Text>
            </View>
          </View>

          {/* Figures row */}
          <View style={cardStyles.figRow}>
            <FigCell label="Total" value={`₹${total.toLocaleString('en-IN')}`} color={textPri} sec={textSec} />
            <View style={[cardStyles.figSep, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]} />
            <FigCell label="Collected" value={`₹${paid.toLocaleString('en-IN')}`} color="#10B981" sec={textSec} />
            <View style={[cardStyles.figSep, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]} />
            <FigCell label="Due" value={`₹${due.toLocaleString('en-IN')}`} color={due > 0 ? '#EF4444' : '#10B981'} sec={textSec} />
          </View>

          {/* Progress */}
          <MiniProgress paid={paid} total={total} isDark={isDark} />
        </View>

        {/* Chevron */}
        <View style={cardStyles.chevronWrap}>
          <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'} />
        </View>
      </Pressable>
    </Animated.View>
  );
});

function FigCell({ label, value, color, sec }: { label: string; value: string; color: string; sec: string }) {
  return (
    <View style={cardStyles.figCell}>
      <Text style={[cardStyles.figLabel, { color: sec }]}>{label}</Text>
      <Text style={[cardStyles.figValue, { color }]}>{value}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  accent: { width: 4, alignSelf: 'stretch' },
  inner: { flex: 1, padding: 14, paddingLeft: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatarWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  nameBlock: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 5 },
  metaTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  metaTagText: { fontSize: 10, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800' },
  figRow: { flexDirection: 'row', alignItems: 'center' },
  figCell: { flex: 1, alignItems: 'center' },
  figLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2, textTransform: 'uppercase' },
  figValue: { fontSize: 14, fontWeight: '800' },
  figSep: { width: 1, height: 28, marginHorizontal: 4 },
  chevronWrap: { paddingRight: 12 },
});

// ─── Summary Header ───────────────────────────────────────────────────────────
function SummaryHeader({ students, isDark }: { students: any[]; isDark: boolean }) {
  const totalDue = students.reduce((s, x) => s + (parseFloat(x.due) || 0), 0);
  const totalPaid = students.reduce((s, x) => s + (parseFloat(x.paid) || 0), 0);
  const countPending = students.filter(x => x.status !== 'Paid').length;

  const bg = isDark ? '#1C1F2A' : '#1E293B';
  const textSec = 'rgba(255,255,255,0.4)';

  return (
    <Animated.View entering={FadeIn.duration(500)} style={[sumStyles.card, { backgroundColor: bg }]}>
      <View style={sumStyles.row}>
        <SumCell label="Total Collected" value={`₹${totalPaid.toLocaleString('en-IN')}`} color="#34D399" sec={textSec} />
        <View style={sumStyles.sep} />
        <SumCell label="Total Outstanding" value={`₹${totalDue.toLocaleString('en-IN')}`} color="#F87171" sec={textSec} />
        <View style={sumStyles.sep} />
        <SumCell label="Pending Students" value={String(countPending)} color="#60A5FA" sec={textSec} />
      </View>
    </Animated.View>
  );
}

function SumCell({ label, value, color, sec }: { label: string; value: string; color: string; sec: string }) {
  return (
    <View style={sumStyles.cell}>
      <Text style={[sumStyles.label, { color: sec }]}>{label}</Text>
      <Text style={[sumStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

const sumStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  row: { flexDirection: 'row' },
  sep: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 },
  cell: { flex: 1, alignItems: 'center' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase', textAlign: 'center' },
  value: { fontSize: 16, fontWeight: '800' },
});

// ─── Filter Pill ──────────────────────────────────────────────────────────────
function FilterPill({
  label, active, count, isDark, onPress,
}: {
  label: string; active: boolean; count: number; isDark: boolean; onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={aStyle}>
      <Pressable
        style={[
          pillStyles.pill,
          active
            ? { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }
            : { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }
        ]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.92); }}
        onPressOut={() => { scale.value = withSpring(1); }}
      >
        <Text style={[pillStyles.label, { color: active ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : '#6B7280') }]}>
          {label}
        </Text>
        {count > 0 && label !== 'All' && (
          <View style={[pillStyles.badge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB') }]}>
            <Text style={[pillStyles.badgeText, { color: active ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : '#6B7280') }]}>
              {count}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
const pillStyles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '700' },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AccountsFees() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { shellActive } = useAccountsWebChrome();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await FeeService.getStudentFeeSummaries();
      setStudents(data.map((d: any) => ({
        id: d.student_id,
        name: d.student_name,
        admissionNo: d.admission_no || '',
        class: d.class_name,
        status: d.status,
        total: d.total_amount,
        paid: d.paid_amount,
        due: d.due_amount,
        rawId: d.student_id,
      })));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const filterCounts = useMemo(() => ({
    All: students.length,
    Paid: students.filter(s => s.status === 'Paid').length,
    Partial: students.filter(s => s.status === 'Partial').length,
    Pending: students.filter(s => s.status === 'Pending').length,
  }), [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return students.filter(s => {
      const matchFilter = activeFilter === 'All' || s.status === activeFilter;
      const matchSearch = !q
        || s.name.toLowerCase().includes(q)
        || s.admissionNo.toLowerCase().includes(q)
        || s.class.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [students, searchQuery, activeFilter]);

  const handleViewLedger = useCallback((student: any) => {
    router.push({
      pathname: '/accounts/fees/details' as any,
      params: { studentId: student.id, name: student.name },
    });
  }, [router]);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <StudentCard
      item={item}
      index={index}
      isDark={isDark}
      onPress={() => handleViewLedger(item)}
    />
  ), [isDark, handleViewLedger]);

  const ListHeader = useMemo(() => (
    <>
      {!loading && students.length > 0 && (
        <SummaryHeader students={students} isDark={isDark} />
      )}

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <FilterPill
            key={f}
            label={f}
            active={activeFilter === f}
            count={filterCounts[f]}
            isDark={isDark}
            onPress={() => setActiveFilter(f)}
          />
        ))}
      </View>

      {/* Results count */}
      {!loading && (
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={styles.resultsCount}>
            {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            {activeFilter !== 'All' ? ` · ${activeFilter}` : ''}
          </Text>
        </Animated.View>
      )}
    </>
  ), [loading, students, isDark, activeFilter, filterCounts, filteredStudents.length]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isDark ? '#0F1117' : '#1E293B'}
      />
      {!shellActive && <AdminHeader title="Fee Management" showBackButton />}

      {/* Search bar */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.searchWrap, ds.searchBarWrapper, searchFocused && styles.searchWrapFocused]}
      >
        <Ionicons
          name="search"
          size={18}
          color={searchFocused ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF')}
        />
        <AppTextInput
          style={[ds.inputInChrome, styles.searchInput]}
          placeholder="Search by name, ID or class…"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <LogoLoader size={52} color="#3B82F6" />
          <Text style={styles.loadingText}>Loading fee data…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => `${item.id}_${item.rawId}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No students found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different name, ID or filter
              </Text>
            </View>
          }
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={10}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  searchWrapFocused: {
    borderColor: '#3B82F6',
    backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#F0F7FF',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: isDark ? '#F9FAFB' : '#111827',
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  // Results count
  resultsCount: {
    fontSize: 12,
    fontWeight: '700',
    color: isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF',
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: isDark ? 'rgba(255,255,255,0.5)' : '#374151',
  },
  emptySubtitle: {
    fontSize: 13,
    color: isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF',
    fontWeight: '500',
  },
});