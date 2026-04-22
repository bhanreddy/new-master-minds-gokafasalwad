import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import AdminHeader from '../../src/components/AdminHeader';
import LogoLoader from '../../src/components/LogoLoader';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { api } from '../../src/services/apiClient';

const { width: SW } = Dimensions.get('window');

// ─── Status cycling order & config ───────────────────────────────────────────
const STATUS_CYCLE: Record<string, string> = {
  absent: 'present',
  present: 'half_day',
  half_day: 'absent',
};

const STATUS_META: Record<string, {
  label: string;
  darkColors: [string, string];
  lightColors: [string, string];
  dot: string;
  darkText: string;
  lightText: string;
  darkBg: string;
  lightBg: string;
  icon: string;
}> = {
  present: {
    label: 'Present',
    darkColors: ['#00C48C', '#009E72'],
    lightColors: ['#00C48C', '#009E72'],
    dot: '#00C48C',
    darkText: '#00C48C',
    lightText: '#007A58',
    darkBg: 'rgba(0,196,140,0.15)',
    lightBg: 'rgba(0,122,88,0.10)',
    icon: 'checkmark-circle',
  },
  absent: {
    label: 'Absent',
    darkColors: ['#FF4D6A', '#C0203B'],
    lightColors: ['#FF4D6A', '#C0203B'],
    dot: '#FF4D6A',
    darkText: '#FF4D6A',
    lightText: '#B0102E',
    darkBg: 'rgba(255,77,106,0.15)',
    lightBg: 'rgba(176,16,46,0.10)',
    icon: 'close-circle',
  },
  half_day: {
    label: 'Half-Day',
    darkColors: ['#FFB800', '#E67E00'],
    lightColors: ['#FFB800', '#E67E00'],
    dot: '#FFB800',
    darkText: '#FFB800',
    lightText: '#A05500',
    darkBg: 'rgba(255,184,0,0.15)',
    lightBg: 'rgba(160,85,0,0.10)',
    icon: 'time',
  },
};

// ─── Status Badge (display-only — the whole card is the tap target) ─────────────
function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.absent;
  const pillBg = isDark ? meta.darkBg : meta.lightBg;
  const textClr = isDark ? meta.darkText : meta.lightText;

  return (
    <View style={[styles.statusBadge, { backgroundColor: pillBg }]}>
      <Ionicons name={meta.icon as any} size={13} color={textClr} style={{ marginRight: 5 }} />
      <Text style={[styles.statusBadgeText, { color: textClr }]}>{meta.label}</Text>
    </View>
  );
}

// ─── Circular progress donut ──────────────────────────────────────────────────
function DonutRing({
  present, absent, half, total, isDark,
}: { present: number; absent: number; half: number; total: number; isDark: boolean }) {
  const R = 38;
  const CIRC = 2 * Math.PI * R;
  const pct = total > 0 ? present / total : 0;

  const ringBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  return (
    <View style={styles.donutWrapper}>
      {/* Background ring */}
      <View style={[styles.donutOuter, { borderColor: ringBg }]} />
      {/* Filled arc using a gradient overlay clipped to a wedge — approximated with a
          coloured ring + opacity since RN SVG isn't guaranteed.
          We use a gradient LinearGradient rotated behind a masked view. */}
      <LinearGradient
        colors={['#00C48C', '#7C6FFF']}
        style={[styles.donutFill, { opacity: total > 0 ? 1 : 0.2 }]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
      />
      {/* White/dark mask to create donut hole */}
      <View style={[styles.donutHole, { backgroundColor: isDark ? '#0E0F1A' : '#FFFFFF' }]} />
      {/* Centre text */}
      <View style={styles.donutCenter}>
        <Text style={[styles.donutPct, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          {total > 0 ? Math.round(pct * 100) : 0}
          <Text style={{ fontSize: 12 }}>%</Text>
        </Text>
        <Text style={[styles.donutLabel, { color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)' }]}>
          present
        </Text>
      </View>
    </View>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────
function StatChip({
  value, label, color, icon, isDark,
}: { value: number; label: string; color: string; icon: string; isDark: boolean }) {
  const chipBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const labelColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.42)';

  return (
    <View style={[styles.statChip, { backgroundColor: chipBg, borderColor: chipBorder }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

// ─── Staff Card — entire card is the tap target ───────────────────────────────
function StaffCard({
  staff, index, isDark, cardBg, cardBorder, onToggle,
}: {
  staff: any; index: number; isDark: boolean;
  cardBg: string; cardBorder: string; onToggle: () => void;
}) {
  const status = staff.status || 'absent';
  const meta = STATUS_META[status] ?? STATUS_META.absent;
  const pressScale = useSharedValue(1);

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => { pressScale.value = withSpring(0.968, { damping: 18 }); };
  const handlePressOut = () => { pressScale.value = withSpring(1, { damping: 14 }); };

  const handlePress = () => {
    // Bounce pop feedback on toggle
    pressScale.value = withSequence(
      withSpring(0.96, { damping: 14 }),
      withSpring(1.025, { damping: 10 }),
      withSpring(1, { damping: 14 })
    );
    onToggle();
  };

  const initials = (staff.staff_name || '?')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 55).duration(450).springify().damping(13)}
      style={cardAnim}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
      >
        {isDark && <View style={styles.cardShimmer} />}

        <View style={styles.cardRow}>
          {/* Avatar — colour reflects current status */}
          <LinearGradient
            colors={isDark ? meta.darkColors : meta.lightColors}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>

          {/* Info */}
          <View style={styles.cardInfo}>
            <Text
              style={[styles.staffName, { color: isDark ? '#FFFFFF' : '#111827' }]}
              numberOfLines={1}
            >
              {staff.staff_name || 'Unknown'}
            </Text>
            <Text
              style={[styles.staffRole, { color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.44)' }]}
              numberOfLines={1}
            >
              {staff.designation || 'Staff'}
            </Text>
          </View>

          {/* Status badge — visual indicator only */}
          <StatusBadge status={status} isDark={isDark} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminAttendanceScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60; // Approximate header height including spacing
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const pageBg = isDark ? '#0E0F1A' : '#F2F3F8';
  const cardBg = isDark ? 'rgba(255,255,255,0.048)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const summaryBg = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
  const summaryBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const titleColor = isDark ? '#FFFFFF' : '#111827';
  const subColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.42)';
  const sectionColor = isDark ? 'rgba(255,255,255,0.36)' : 'rgba(0,0,0,0.36)';
  const filterBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const filterBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';
  const filterText = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.65)';
  const footerBg = isDark ? 'rgba(14,15,26,0.97)' : 'rgba(242,243,248,0.97)';
  const footerBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const orb1Color = isDark ? 'rgba(124,111,255,0.08)' : 'rgba(124,111,255,0.05)';
  const orb2Color = isDark ? 'rgba(0,196,140,0.06)' : 'rgba(0,196,140,0.05)';

  // ── Data ────────────────────────────────────────────────────────────────────
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const dateStr = new Date().toISOString().split('T')[0];
      const data = await api.get<any[]>('/attendance/staff', { date: dateStr });
      setStaffList(data || []);
    } catch { }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchAttendance(); };

  const toggleStatus = (staffId: string) => {
    setStaffList((prev) =>
      prev.map((s) =>
        s.staff_id === staffId
          ? { ...s, status: STATUS_CYCLE[s.status || 'absent'] }
          : s
      )
    );
  };

  const submitAttendance = async () => {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const records = staffList.map((s) => ({ staff_id: s.staff_id, status: s.status || 'absent' }));
      await api.post('/attendance/staff', { date: dateStr, attendance: records });
      alertCompat('✓ Saved', 'Attendance marked successfully.');
    } catch {
      alertCompat('Error', 'Failed to save attendance.');
    }
  };

  const stats = useMemo(() => {
    let present = 0, absent = 0, half = 0;
    staffList.forEach((s) => {
      if (s.status === 'present') present++;
      else if (s.status === 'absent') absent++;
      else if (s.status === 'half_day') half++;
      else absent++;               // default unset → absent
    });
    return { present, absent, half, total: staffList.length };
  }, [staffList]);

  // ── Today label ─────────────────────────────────────────────────────────────
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      {/* Ambient orbs */}
      <View style={[styles.orb1, { backgroundColor: orb1Color }]} />
      <View style={[styles.orb2, { backgroundColor: orb2Color }]} />

      <AdminHeader title="Staff Attendance" showNotification scrollY={scrollY} />

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <LogoLoader size={56} color="#7C6FFF" />
          <Text style={[styles.loaderText, { color: subColor }]}>Loading attendance…</Text>
        </View>
      ) : (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="transparent"
              colors={['transparent']}
              progressBackgroundColor="transparent"
            />
          }
        >
          {/* Pull-to-refresh logo */}
          {refreshing && (
            <View style={{ alignItems: 'center', paddingBottom: 16 }}>
              <LogoLoader size={30} color="#7C6FFF" />
            </View>
          )}

          {/* ── Overview card ─────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(0).duration(500).springify()}
            style={[styles.summaryCard, { backgroundColor: summaryBg, borderColor: summaryBorder }]}
          >
            {isDark && <View style={styles.summaryShimmer} />}

            <View style={styles.summaryTop}>
              {/* Left: title + date */}
              <View style={{ flex: 1 }}>
                <View style={styles.sectionAccentRow}>
                  <LinearGradient
                    colors={['#7C6FFF', '#5A4FE0']}
                    style={styles.sectionAccent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <Text style={[styles.overviewLabel, { color: sectionColor }]}>TODAY'S OVERVIEW</Text>
                </View>
                <Text style={[styles.dateTitle, { color: titleColor }]}>Attendance</Text>
                <Text style={[styles.dateSub, { color: subColor }]}>{todayStr}</Text>
              </View>

              {/* Right: donut */}
              <DonutRing {...stats} isDark={isDark} />
            </View>

            {/* Stat chips */}
            <View style={styles.statChipsRow}>
              <StatChip value={stats.present} label="Present" color="#00C48C" icon="checkmark-circle" isDark={isDark} />
              <StatChip value={stats.absent} label="Absent" color="#FF4D6A" icon="close-circle" isDark={isDark} />
              <StatChip value={stats.half} label="Half-Day" color="#FFB800" icon="time" isDark={isDark} />
            </View>
          </Animated.View>

          {/* ── Filter chips ───────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.filterRow}>
            {['All Depts', 'Status', 'Today'].map((label) => (
              <TouchableOpacity
                key={label}
                activeOpacity={0.75}
                style={[styles.filterChip, { backgroundColor: filterBg, borderColor: filterBorder }]}
              >
                <Text style={[styles.filterChipText, { color: filterText }]}>{label}</Text>
                <Ionicons name="chevron-down" size={13} color={filterText} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* ── Section header ─────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(400)}
            style={styles.listHeader}
          >
            <View style={styles.sectionAccentRow}>
              <LinearGradient
                colors={['#7C6FFF', '#5A4FE0']}
                style={styles.sectionAccent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Text style={[styles.sectionTitle, { color: sectionColor }]}>STAFF LIST</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: isDark ? 'rgba(124,111,255,0.18)' : 'rgba(124,111,255,0.12)' }]}>
              <Text style={styles.countBadgeText}>{staffList.length}</Text>
            </View>
          </Animated.View>

          {/* ── Staff cards ────────────────────────────────────────────────── */}
          {staffList.length === 0 ? (
            <Animated.View entering={ZoomIn.duration(400)} style={styles.emptyBox}>
              <LinearGradient
                colors={['rgba(124,111,255,0.15)', 'rgba(124,111,255,0.04)']}
                style={styles.emptyIcon}
              >
                <Ionicons name="people-outline" size={36} color="rgba(124,111,255,0.6)" />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: titleColor }]}>No Staff Found</Text>
              <Text style={[styles.emptySub, { color: subColor }]}>
                Pull down to refresh the list
              </Text>
            </Animated.View>
          ) : (
            staffList.map((staff, index) => (
              <StaffCard
                key={staff.staff_id}
                staff={staff}
                index={index}
                isDark={isDark}
                cardBg={cardBg}
                cardBorder={cardBorder}
                onToggle={() => toggleStatus(staff.staff_id)}
              />
            ))
          )}
        </Animated.ScrollView>
      )}

      {/* ── Footer CTA ──────────────────────────────────────────────────────── */}
      <View style={[styles.footer, { backgroundColor: footerBg, borderTopColor: footerBorder }]}>
        <View style={styles.footerMeta}>
          <Text style={[styles.footerCount, { color: titleColor }]}>
            {stats.present}
            <Text style={[styles.footerTotal, { color: subColor }]}> / {stats.total} present</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={submitAttendance} activeOpacity={0.85} style={styles.submitBtn}>
          <LinearGradient
            colors={['#7C6FFF', '#5A4FE0']}
            style={styles.submitGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.submitText}>Mark Attendance</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Static styles (zero hardcoded colours — injected inline) ─────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Orbs
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -80, right: -100 },
  orb2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, bottom: 140, left: -80 },

  // Scroll
  scrollContent: { paddingTop: 100, paddingHorizontal: 20, paddingBottom: 120 },

  // Loader
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loaderText: { fontSize: 14, fontWeight: '500', letterSpacing: 0.4 },

  // Summary card
  summaryCard: {
    borderRadius: 22, padding: 20, marginBottom: 18,
    borderWidth: 1, overflow: 'hidden',
  },
  summaryShimmer: {
    position: 'absolute', top: 0, left: 28, right: 28, height: 1,
    backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 1,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },

  // Section accent
  sectionAccentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionAccent: { width: 3, height: 12, borderRadius: 2, marginRight: 7 },
  overviewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },

  dateTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 3 },
  dateSub: { fontSize: 13, fontWeight: '500' },

  // Donut
  donutWrapper: {
    width: 90, height: 90,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  donutOuter: {
    position: 'absolute', width: 82, height: 82, borderRadius: 41,
    borderWidth: 6,
  },
  donutFill: {
    position: 'absolute', width: 82, height: 82, borderRadius: 41,
  },
  donutHole: {
    position: 'absolute', width: 62, height: 62, borderRadius: 31,
  },
  donutCenter: { alignItems: 'center' },
  donutPct: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  donutLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginTop: 1 },

  // Stat chips
  statChipsRow: { flexDirection: 'row', gap: 10 },
  statChip: {
    flex: 1, alignItems: 'center', padding: 12,
    borderRadius: 14, borderWidth: 1, gap: 5,
  },
  statIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '600' },

  // List header
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#7C6FFF' },

  // Staff card
  card: {
    borderRadius: 18, padding: 14, marginBottom: 10,
    borderWidth: 1, overflow: 'hidden',
  },
  cardShimmer: {
    position: 'absolute', top: 0, left: 20, right: 20, height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', marginRight: 13,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  cardInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  staffRole: { fontSize: 12, fontWeight: '500' },

  // Status badge
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  // Empty state
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, borderWidth: 1, borderColor: 'rgba(124,111,255,0.2)',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  footerMeta: { justifyContent: 'center' },
  footerCount: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  footerTotal: { fontSize: 14, fontWeight: '500' },
  submitBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  submitGrad: {
    flexDirection: 'row', height: 50,
    alignItems: 'center', justifyContent: 'center', borderRadius: 14,
    shadowColor: '#7C6FFF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
});