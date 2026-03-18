import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  BackHandler, Pressable, Dimensions, FlatList, Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn, FadeInUp,
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle,
  withSpring, withRepeat, withTiming, withSequence,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import AdminHeader from '../../src/components/AdminHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { AdminDashboardStats } from '../../src/types/models';
import { AdminService } from '../../src/services/adminService';
import { AccessControlService } from '../../src/services/accessControlService';
import { supabase } from '../../src/services/supabaseConfig';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import ResponsiveCard from '../../src/components/ResponsiveCard';
import DashboardMenuOverlay from '../../src/components/DashboardMenuOverlay';
import { useAnalytics } from '../../src/hooks/useAnalytics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ActionItem {
  title: string;
  icon: IconName;
  route: string;
  gradient: [string, string];
  badge?: number;
  category?: string;
  description?: string;
}
interface StatItem {
  label: string;
  value: string | number;
  icon: IconName;
  color: string;
  bg: string;
  route: string;
  trend: string;
  trendColor: string;
  trendBg: string;
  accentGradient: [string, string];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const isWeb = Platform.OS === 'web';
const CARD_MARGIN = 14;
const MAX_CONTENT_WIDTH = 1000;
const ACTUAL_WIDTH = Math.min(SCREEN_WIDTH, MAX_CONTENT_WIDTH);
const CARD_WIDTH = ACTUAL_WIDTH - CONTAINER_PADDING * 2;

const GRID_GAP = 10;
const GRID_COLS = 3;
const ACTION_CARD_WIDTH =
  Math.floor((ACTUAL_WIDTH - CONTAINER_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

const ORB_SIZE = ACTION_CARD_WIDTH * 0.88;

/* ─────────────────────────────────────────────────────────────────────────── */
/*  COLOR PALETTE — 5 Premium Hues                                             */
/*                                                                             */
/*  Arranged in a rolling cycle across the 3-column grid so:                  */
/*  • No two horizontally or diagonally adjacent cards share a hue            */
/*  • Each row has 3 visually distinct colors                                  */
/*  • The grid reads as rhythmically varied, not randomly scattered            */
/*                                                                             */
/*  Cycle:  S → V → T → R → A → S → V → T → R → A → ...                    */
/*                                                                             */
/*  S = Sapphire   ['#2563EB', '#1D4ED8']  — academic, structured             */
/*  V = Violet     ['#7C3AED', '#6D28D9']  — finance, analytics, depth        */
/*  T = Teal       ['#0D9488', '#0F766E']  — comms, content, growth           */
/*  R = Rose       ['#E11D48', '#BE123C']  — alerts, HR, people               */
/*  A = Amber      ['#D97706', '#B45309']  — ops, security, caution           */
/*                                                                             */
/*  Grid visual:                                                               */
/*  Row 1: S  V  T    (Academics, Expense Tracker,  Notices)                   */
/*  Row 2: R  A  S    (Complaints, Access Requests, Timetable)                 */
/*  Row 3: V  T  R    (View Reports, Smart Insights, Manage Staff)             */
/*  Row 4: A  S  V    (Transport,  Manage Content,  Progress Reports)          */
/*  Row 5: T  R  A    (Certificates, Leaves,        Fee Structure)             */
/*  Row 6: S          (Add Staff)                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

const PAL = {
  S: ['#2563EB', '#1D4ED8'] as [string, string],   // Sapphire
  V: ['#7C3AED', '#6D28D9'] as [string, string],   // Violet
  T: ['#0D9488', '#0F766E'] as [string, string],   // Teal
  R: ['#E11D48', '#BE123C'] as [string, string],   // Rose
  A: ['#D97706', '#B45309'] as [string, string],   // Amber
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DOT TEXTURE OVERLAY                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
const DotTexture = React.memo(() => {
  const dots: React.ReactElement[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            width: 3,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: 'rgba(255,255,255,0.18)',
            top: 14 + r * 14,
            left: 10 + c * 16,
          }}
        />,
      );
    }
  }
  return <>{dots}</>;
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  QUICK ACTION CARD                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */
const GridItem = React.memo(({ item, index, cardWidth }: { item: ActionItem; index: number; cardWidth: number }) => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = isWeb && windowWidth >= 768;
  const styles = useMemo(() => getStyles(theme, isDark, isWideScreen), [theme, isDark, isWideScreen]);

  const scale = useSharedValue(1);
  const iconScale = useSharedValue(1);

  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const iconAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.93, { damping: 14, stiffness: 360 });
    iconScale.value = withSequence(
      withSpring(1.18, { damping: 7, stiffness: 420 }),
      withSpring(1, { damping: 9, stiffness: 300 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 260 });
  };

  const [g0, g1] = item.gradient;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify().mass(0.55).damping(14)}
      style={[styles.gridWrapper, { width: cardWidth }]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => router.push(item.route as any)}
      >
        <Animated.View style={[cardAnimStyle, { shadowColor: g0 }]}>
          <View style={styles.gridItem}>

            {/* ① Full gradient surface */}
            <LinearGradient
              colors={[g0, g1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* ② Dot texture */}
            <DotTexture />

            {/* ③ Large ghost orb — bleeds off bottom-right */}
            <View style={styles.ghostOrb} />

            {/* ④ Inner depth orb */}
            <View style={styles.ghostOrbInner} />

            {/* ⑤ Card definition border */}
            <View style={styles.gridInnerBorder} />

            {/* Badge */}
            {item.badge !== undefined && item.badge > 0 && (
              <View style={styles.gridBadge}>
                <Text style={styles.gridBadgeText}>
                  {item.badge > 99 ? '99+' : item.badge}
                </Text>
              </View>
            )}

            <View style={styles.gridContent}>

              {/* Frosted glass icon box */}
              <Animated.View style={[styles.iconBox, iconAnimStyle]}>
                <Ionicons name={item.icon} size={isWideScreen ? 28 : 20} color="rgba(255,255,255,0.95)" />
              </Animated.View>

              {/* Bottom: title + arrow */}
              <View style={styles.bottomRow}>
                <Text style={styles.gridTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.arrowChip}>
                  <Ionicons name="chevron-forward" size={isWideScreen ? 18 : 13} color="rgba(255,255,255,0.85)" />
                </View>
              </View>

            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DASHBOARD STAT CARD                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
const DashboardCard = React.memo(
  ({ item, index, onPress }: { item: StatItem; index: number; onPress: () => void }) => {
    const { theme, isDark } = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    const isWideScreen = isWeb && windowWidth >= 768;
    const styles = useMemo(() => getStyles(theme, isDark, isWideScreen), [theme, isDark, isWideScreen]);
    const { t } = useTranslation();
    const scale = useSharedValue(1);
    const cardAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 16, stiffness: 320 }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
    const handlePressOut = () => { scale.value = withSpring(1, { damping: 13, stiffness: 250 }); };

    return (
      <View style={styles.statCardWrapper}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
          <Animated.View style={[styles.statCard, cardAnim, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF' }]}>
            <LinearGradient colors={[item.accentGradient[0], isDark ? 'rgba(28,36,56,0)' : 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.15 : 0.05 }]} />
            <View style={[styles.statOuterBorder, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]} />
            <View style={styles.statHeader}>
              <Text style={[styles.statLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)' }]}>{item.label.toUpperCase()}</Text>
              <View style={[styles.statIconWrap, { backgroundColor: item.bg }]}><Ionicons name={item.icon} size={isWideScreen ? 24 : 18} color={item.color} /></View>
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{item.value}</Text>
            </View>
            <View style={[styles.statCardFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }]}>
              <View style={[styles.trendPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : item.trendBg }]}><Text style={[styles.trendText, { color: isDark ? '#FFFFFF' : item.trendColor }]}>{item.trend}</Text></View>
              <View style={styles.statViewArrow}><Ionicons name="arrow-forward" size={isWideScreen ? 18 : 14} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)'} /></View>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    );
  },
);

function SectionHeader({ label, delay, styles, theme, isDark }: { label: string; delay: number; styles: any; theme: Theme; isDark: boolean }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)} style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{label.toUpperCase()}</Text>
      <View style={[styles.sectionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)' }]} />
    </Animated.View>
  );
}

function ActivityChip({ icon, label, value, color, delay, styles, isDark }: { icon: IconName; label: string; value: string | number; color: string; delay: number; styles: any; isDark?: boolean }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.activityChip, { borderRightColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
      <Text style={[styles.activityChipValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{value}</Text>
      <Text style={[styles.activityChipLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>{label}</Text>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ANALYTICS & INSIGHTS (MOCK)                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
function PulseIndicator({ isDark }: { isDark: boolean }) {
  const op = useSharedValue(0.4);
  const sc = useSharedValue(0.8);
  React.useEffect(() => {
    op.value = withRepeat(withSequence(withTiming(1, { duration: 800 }), withTiming(0.4, { duration: 1200 })), -1, true);
    sc.value = withRepeat(withSequence(withTiming(1.2, { duration: 800 }), withTiming(0.8, { duration: 1200 })), -1, true);
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: sc.value }],
  }));
  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#10B981', borderRadius: 6 }, animStyle]} />
      <View style={{ width: 6, height: 6, backgroundColor: '#10B981', borderRadius: 3 }} />
    </View>
  );
}

const mockAttendanceData = [
  { value: 85, label: 'M' },
  { value: 89, label: 'T' },
  { value: 92, label: 'W' },
  { value: 90, label: 'T' },
  { value: 94, label: 'F' },
  { value: 96, label: 'S' },
];

const mockCollectionDist = [
  { value: 45, label: 'Tuit', frontColor: '#3B82F6', topLabelComponent: () => <Text style={{fontSize: 9, color: '#3B82F6', fontWeight: 'bold'}}>45%</Text> },
  { value: 25, label: 'Tran', frontColor: '#F59E0B', topLabelComponent: () => <Text style={{fontSize: 9, color: '#F59E0B', fontWeight: 'bold'}}>25%</Text> },
  { value: 20, label: 'Host', frontColor: '#10B981', topLabelComponent: () => <Text style={{fontSize: 9, color: '#10B981', fontWeight: 'bold'}}>20%</Text> },
  { value: 10, label: 'Misc', frontColor: '#8B5CF6', topLabelComponent: () => <Text style={{fontSize: 9, color: '#8B5CF6', fontWeight: 'bold'}}>10%</Text> },
];

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PAGE                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMenuRoute, setActiveMenuRoute] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = isWeb && windowWidth >= 768;
  const contentWidth = isWideScreen ? Math.min(windowWidth - 80, 1200) : windowWidth - CONTAINER_PADDING * 2;
  const leftColWidth = isWideScreen ? contentWidth * 0.38 : contentWidth;
  const rightColWidth = isWideScreen ? contentWidth * 0.58 : contentWidth;
  const chartWidth = (isWideScreen ? rightColWidth : contentWidth) - 48;
  const metricCardWidth = ((isWideScreen ? rightColWidth : contentWidth) - 24) / 3;
  const actionCardWidth = (leftColWidth - 24) / 3;

  const { financials, attendance, academics, staff, insights } = useAnalytics();

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 60000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    if (!user) return;
    const fetchPendingCount = async () => { try { const requests = await AccessControlService.getPendingRequests(); setPendingRequestsCount(requests.length); } catch (e) { console.error(e); } };
    fetchPendingCount();
    const channel = supabase.channel('access_req_badge').on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, fetchPendingCount).subscribe();
    (async () => { try { const data = await AdminService.getDashboardStats({ silent: true }); setDashboardData(data); } catch (err: any) { if (!err?.message?.includes('Student profile not found')) { /* suppress */ } } finally { setLoading(false); } })();
  }, [user]);

  useFocusEffect(React.useCallback(() => { const onBackPress = () => { BackHandler.exitApp(); return true; }; const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress); return () => subscription.remove(); }, []));
  useEffect(() => { return () => { supabase.removeChannel(supabase.channel('access_req_badge')); }; }, []);

  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark, isWideScreen), [theme, isDark, isWideScreen]);
  const getGreeting = () => { const h = currentTime.getHours(); if (h < 12) return 'Good Morning'; if (h < 17) return 'Good Afternoon'; return 'Good Evening'; };

  // Compute DB-driven trend values
  const studentTrend = financials?.new_enrollments ? `+${financials.new_enrollments}` : '0';
  const attendanceTrendPct = attendance?.avg_attendance ? (attendance.avg_attendance >= 90 ? `${attendance.avg_attendance}%` : `${attendance.avg_attendance}%`) : '—';
  const collectionTrendPct = financials ? `${financials.collection_efficiency}%` : '—';
  const scoreTrendPct = academics ? `${academics.pass_rate}% pass` : '—';
  const complaintsTrend = dashboardData?.complaints ? `${dashboardData.complaints}` : '0';

  const stats: StatItem[] = React.useMemo(() => [
    { label: t('admin_dashboard_v2.total_students', 'Total Students'), value: loading ? '—' : dashboardData?.totalStudents ?? 0, icon: 'people-outline', color: '#3B82F6', bg: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF', route: '/admin/students', trend: studentTrend, trendColor: '#10B981', trendBg: '#ECFDF5', accentGradient: ['#3B82F6', '#60A5FA'] },
    { label: t('admin_dashboard_v2.staff_present', 'Avg Attendance'), value: loading ? '—' : `${attendance?.avg_attendance ?? 0}%`, icon: 'checkmark-circle-outline', color: '#10B981', bg: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5', route: '/admin/attendance', trend: attendanceTrendPct, trendColor: (attendance?.avg_attendance ?? 0) >= 85 ? '#10B981' : '#EF4444', trendBg: (attendance?.avg_attendance ?? 0) >= 85 ? '#ECFDF5' : '#FEF2F2', accentGradient: ['#10B981', '#34D399'] },
    { label: t('admin_dashboard_v2.collection', 'Collection Efficiency'), value: loading ? '—' : `${financials?.collection_efficiency ?? 0}%`, icon: 'trending-up-outline', color: '#F59E0B', bg: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB', route: '/admin/finance', trend: collectionTrendPct, trendColor: (financials?.collection_efficiency ?? 0) >= 80 ? '#10B981' : '#F59E0B', trendBg: (financials?.collection_efficiency ?? 0) >= 80 ? '#ECFDF5' : '#FFFBEB', accentGradient: ['#F59E0B', '#FBBF24'] },
    { label: t('admin_dashboard_v2.avg_score', 'Avg Score'), value: loading ? '—' : `${academics?.avg_score ?? 0}%`, icon: 'school-outline', color: '#8B5CF6', bg: isDark ? 'rgba(139,92,246,0.15)' : '#F3E8FF', route: '/admin/reports', trend: scoreTrendPct, trendColor: (academics?.pass_rate ?? 0) >= 80 ? '#10B981' : '#F59E0B', trendBg: (academics?.pass_rate ?? 0) >= 80 ? '#ECFDF5' : '#FFFBEB', accentGradient: ['#8B5CF6', '#A78BFA'] },
    { label: t('admin_dashboard_v2.complaints', 'Complaints'), value: loading ? '—' : dashboardData?.complaints ?? 0, icon: 'alert-circle-outline', color: '#EF4444', bg: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', route: '/admin/complaints', trend: complaintsTrend, trendColor: (dashboardData?.complaints ?? 0) > 5 ? '#EF4444' : '#10B981', trendBg: (dashboardData?.complaints ?? 0) > 5 ? '#FEF2F2' : '#ECFDF5', accentGradient: ['#EF4444', '#F87171'] },
  ], [t, loading, dashboardData, attendance, financials, academics, isDark, studentTrend, attendanceTrendPct, collectionTrendPct, scoreTrendPct, complaintsTrend]);

  /* ─────────────────────────────────────────────────────────────────────────
     QUICK ACTIONS — Rolling 5-color hierarchy
     
     The PAL cycle S→V→T→R→A repeats across the grid ensuring:
     • Row 1  (idx 0,1,2):  S V T  — Sapphire  | Violet | Teal
     • Row 2  (idx 3,4,5):  R A S  — Rose      | Amber  | Sapphire
     • Row 3  (idx 6,7,8):  V T R  — Violet    | Teal   | Rose
     • Row 4  (idx 9,10,11):A S V  — Amber     | Sapphire | Violet
     • Row 5  (idx 12,13,14):T R A — Teal      | Rose   | Amber
     • Row 6  (idx 15):     S      — Sapphire
     
     No two horizontally adjacent cards share a hue.
     No two diagonally adjacent cards share a hue.
     The eye reads the grid as a rich, harmonious progression.
  ───────────────────────────────────────────────────────────────────────── */
  const quickActions: ActionItem[] = [
    // Row 1 — S V T
    { title: t('admin_dashboard_v2.academic_structure', 'Academics'), description: 'Manage classes, sections, and subjects', icon: 'school-outline', route: '/admin/academics', gradient: PAL.S, category: 'Academic' }, // 0
    { title: t('admin_dashboard_v2.expense_tracker', 'Expense Tracker'), description: 'Record and track school expenses', icon: 'receipt-outline', route: '/admin/expenses', gradient: PAL.V, category: 'Finance' }, // 1
    { title: t('admin_dashboard_v2.notices', 'Notices'), description: 'Publish school-wide announcements', icon: 'megaphone-outline', route: '/admin/notices', gradient: PAL.T, category: 'Comms' }, // 2

    // Row 2 — R A S
    { title: t('admin_dashboard_v2.complaints', 'Complaints'), description: 'Review and resolve issues', icon: 'chatbubble-ellipses-outline', route: '/admin/complaints', gradient: PAL.R, category: 'Support' }, // 3
    { title: 'Access Requests', description: 'Approve new staff/student accounts', icon: 'key-outline', route: '/admin/access-requests', gradient: PAL.A, category: 'Security', badge: pendingRequestsCount }, // 4
    { title: t('admin_dashboard_v2.timetable_manager', 'Timetable'), description: 'Design and assign class schedules', icon: 'calendar-outline', route: '/admin/timetable', gradient: PAL.S, category: 'Academic' }, // 5

    // Row 3 — V T R
    { title: t('admin_dashboard_v2.view_reports', 'View Reports'), description: 'Analytics and aggregated performance', icon: 'bar-chart-outline', route: '/admin/reports', gradient: PAL.V, category: 'Analytics' }, // 6
    { title: t('admin_dashboard_v2.smart_insights', 'Smart Insights'), description: 'AI-driven insights on attendance', icon: 'bulb-outline', route: '/admin/smart-insights', gradient: PAL.T, category: 'AI' }, // 7
    { title: t('admin_dashboard_v2.manage_staff', 'Manage Staff'), description: 'Directory and role assignments', icon: 'people-outline', route: '/admin/manage-staff', gradient: PAL.R, category: 'HR' }, // 8

    // Row 4 — A S V
    { title: t('admin_dashboard_v2.transport', 'Transport'), description: 'Manage buses and routes', icon: 'bus-outline', route: '/admin/transport', gradient: PAL.A, category: 'Ops' }, // 9
    { title: t('admin_dashboard_v2.manage_content', 'Manage Content'), description: 'App content, banners and galleries', icon: 'library-outline', route: '/admin/manage-content', gradient: PAL.S, category: 'Content' }, // 10
    { title: t('admin_dashboard_v2.progress_reports', 'Progress Reports'), description: 'Generate student report cards', icon: 'stats-chart-outline', route: '/admin/progress-report-generator', gradient: PAL.V, category: 'Academic' }, // 11

    // Row 5 — T R A
    { title: t('admin_dashboard_v2.certificates', 'Certificates'), description: 'Issue digital certificates', icon: 'ribbon-outline', route: '/admin/certificate-generator', gradient: PAL.T, category: 'Academic' }, // 12
    { title: t('admin_dashboard_v2.leaves', 'Leaves'), description: 'Approve or reject staff leaves', icon: 'document-text-outline', route: '/admin/leaves', gradient: PAL.R, category: 'HR' }, // 13
    { title: t('admin_dashboard_v2.fee_structure', 'Fee Structure'), description: 'Define class-wise fee details', icon: 'wallet-outline', route: '/admin/fees/set-class-fee', gradient: PAL.A, category: 'Finance' }, // 14

    // Row 6 — S
    { title: t('admin_dashboard_v2.add_accounts_staff', 'Add Staff'), description: 'Onboard new administrative staff', icon: 'person-add-outline', route: '/admin/add-accounts-staff', gradient: PAL.S, category: 'HR' }, // 15
  ];

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: (event: any) => { scrollY.value = event.contentOffset.y; } });
  const orb1Scale = useSharedValue(1);
  const orb1Op = useSharedValue(isDark ? 0.3 : 0.4);

  useEffect(() => {
    orb1Scale.value = withRepeat(withTiming(1.05, { duration: 8000 }), -1, true);
    orb1Op.value = withRepeat(withSequence(withTiming(isDark ? 0.4 : 0.6, { duration: 6000 }), withTiming(isDark ? 0.2 : 0.3, { duration: 6000 })), -1, true);
  }, [isDark]);

  const orb1Anim = useAnimatedStyle(() => ({ transform: [{ scale: orb1Scale.value }], opacity: orb1Op.value }));
  const greetingAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 120], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 120], [0, -22], Extrapolation.CLAMP) }],
  }));

  const carouselRef = React.useRef<FlatList>(null);
  const [activeStatIndex, setActiveStatIndex] = useState(0);

  const currentHeaderTitle = activeMenuRoute 
    ? quickActions.find(q => q.route === activeMenuRoute)?.title || t('Dashboard')
    : t('Dashboard');

  const onCarouselMomentumEnd = (e: any) => {
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / (CARD_WIDTH + CARD_MARGIN));
    setActiveStatIndex(Math.max(0, Math.min(index, stats.length - 1)));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, backgroundColor: isDark ? '#0B0F17' : '#F4F6F9' }} />
        <Animated.View style={[styles.meshOrb, styles.meshOrb1, orb1Anim, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.03)' }]} />
      </View>

      <AdminHeader 
        title={currentHeaderTitle} 
        showNotification 
        scrollY={scrollY} 
        onMenuPress={() => setIsMenuOpen(true)} 
      />

      <Animated.ScrollView contentContainerStyle={[styles.content, { paddingTop: 108 }]} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        <ResponsiveCard maxWidth={isWideScreen ? 1200 : 1000}>

          {/* ── GREETING ── */}
          <Animated.View style={[styles.greetingBlock, greetingAnim]}>
            <Animated.View entering={FadeIn.delay(60).duration(600)} style={styles.eyebrowRow}>
              <Text style={[styles.eyebrowText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)' }]}>{getGreeting().toUpperCase()}</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(100).springify().damping(13)}>
              <Text style={[styles.greetingName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {user?.displayName || 'Admin'}
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)' }}>.</Text>
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(160).springify().damping(14)} style={styles.dateRow}>
              <Text style={[styles.dateText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>{currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              <View style={[styles.dotSep, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)' }]} />
              <Text style={[styles.timeText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.7)' }]}>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
            </Animated.View>
            {!loading && (
              <Animated.View entering={FadeInUp.delay(260).springify()} style={[styles.activityRow, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <ActivityChip icon="people" label="STUDENTS" value={dashboardData?.totalStudents ?? 0} color="#3B82F6" delay={280} styles={styles} isDark={isDark} />
                <ActivityChip icon="checkmark-circle" label="ATTENDANCE" value={attendance?.avg_attendance ? `${attendance.avg_attendance}%` : '—'} color="#10B981" delay={320} styles={styles} isDark={isDark} />
                <ActivityChip icon="cash" label="COLLECTED" value={financials?.total_collected ? `₹${(financials.total_collected / 1000).toFixed(0)}K` : '—'} color="#F59E0B" delay={360} styles={styles} isDark={isDark} />
                <ActivityChip icon="warning" label="ISSUES" value={dashboardData?.complaints ?? 0} color="#EF4444" delay={400} styles={styles} isDark={isDark} />
              </Animated.View>
            )}
          </Animated.View>

          {/* ── MAIN LAYOUT: Web = 2-col, Mobile = stacked reordered ── */}
          <View style={isWideScreen ? styles.webRow : undefined}>

          {/* ── LEFT COLUMN (or top on mobile) ── */}
          <View style={isWideScreen ? { width: leftColWidth } : undefined}>

          {/* ── STATS OVERVIEW ── */}
          <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.carouselSection}>
            <SectionHeader label={t('dashboard.overview', 'Overview')} delay={220} styles={styles} theme={theme} isDark={isDark} />
            {isWideScreen ? (
              /* Web: full-width row of cards */
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
                {stats.map((item, index) => (
                  <View key={`stat-web-${index}`} style={{ flex: 1, minWidth: 180 }}>
                    <DashboardCard index={index} item={item} onPress={() => router.push(item.route as any)} />
                  </View>
                ))}
              </View>
            ) : (
              /* Mobile: horizontal carousel */
              <>
                <FlatList
                  ref={carouselRef}
                  data={stats}
                  horizontal pagingEnabled={false}
                  snapToInterval={CARD_WIDTH + CARD_MARGIN}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => `stat-${i}`}
                  contentContainerStyle={styles.statsContainer}
                  onMomentumScrollEnd={onCarouselMomentumEnd}
                  renderItem={({ item, index }) => <DashboardCard key={`card-${index}`} index={index} item={item} onPress={() => router.push(item.route as any)} />}
                  getItemLayout={(_, index) => ({ length: CARD_WIDTH + CARD_MARGIN, offset: (CARD_WIDTH + CARD_MARGIN) * index, index })}
                />
                <View style={styles.dotTrack}>
                  {stats.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => { carouselRef.current?.scrollToOffset({ offset: i * (CARD_WIDTH + CARD_MARGIN), animated: true }); setActiveStatIndex(i); Haptics.selectionAsync(); }}>
                      <Animated.View style={[styles.dot, i === activeStatIndex ? [styles.dotOn, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A', width: 24 }] : [styles.dotOff, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.15)' }]]} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </Animated.View>

          {/* ── QUICK ACTIONS (on mobile: right after overview) ── */}
          {(!isWideScreen || isWideScreen) && (
            <>
              <SectionHeader label={t('dashboard.quick_actions', 'Quick Actions')} delay={310} styles={styles} theme={theme} isDark={isDark} />
              <View style={styles.grid}>
                {quickActions.map((item, index) => (
                  <GridItem key={index} item={item} index={index} cardWidth={actionCardWidth} />
                ))}
              </View>
            </>
          )}

          </View>{/* END LEFT COLUMN */}

          {/* ── RIGHT COLUMN (or bottom on mobile) ── */}
          <View style={isWideScreen ? { width: rightColWidth } : undefined}>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* ═══  ANALYTICS COMMAND CENTER — PROFESSIONAL DASHBOARD  ═════ */}
          {/* ══════════════════════════════════════════════════════════════ */}

          {/* ── SYSTEM STATUS BAR ── */}
          <Animated.View entering={FadeInDown.delay(270).springify()} style={[styles.systemBar, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
            <View style={styles.systemStatus}>
              <PulseIndicator isDark={isDark} />
              <Text style={[styles.systemStatusText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>All Systems Operational</Text>
            </View>
            <View style={styles.miniKpiRow}>
              <View style={styles.miniKpi}>
                <Text style={[styles.miniKpiLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>TOTAL STAFF</Text>
                <Text style={[styles.miniKpiValue, { color: '#3B82F6' }]}>{staff?.total_staff ?? '--'}</Text>
              </View>
              <View style={styles.miniKpiSep} />
              <View style={styles.miniKpi}>
                <Text style={[styles.miniKpiLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>ACTIVE</Text>
                <Text style={[styles.miniKpiValue, { color: '#10B981' }]}>{staff?.active_staff ?? '--'}</Text>
              </View>
              <View style={styles.miniKpiSep} />
              <View style={styles.miniKpi}>
                <Text style={[styles.miniKpiLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>ALERTS</Text>
                <Text style={[styles.miniKpiValue, { color: '#EF4444' }]}>{insights.length}</Text>
              </View>
            </View>
          </Animated.View>

          {/* ── FINANCIAL OVERVIEW ── */}
          <SectionHeader label={'Financial Overview'} delay={280} styles={styles} theme={theme} isDark={isDark} />
          <Animated.View entering={FadeInDown.delay(290).springify()}>
            <View style={styles.metricGrid}>
              {/* Row 1 */}
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}><Ionicons name="wallet" size={isWideScreen ? 24 : 16} color="#10B981" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{financials ? `₹${(financials.total_collected / 1000).toFixed(1)}K` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Collected</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}><Ionicons name="alert-circle" size={isWideScreen ? 24 : 16} color="#EF4444" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{financials ? `₹${(financials.outstanding_dues / 1000).toFixed(1)}K` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Outstanding</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}><Ionicons name="trending-up" size={isWideScreen ? 24 : 16} color="#3B82F6" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{financials ? `${financials.collection_efficiency}%` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Efficiency</Text>
              </View>
              {/* Row 2 */}
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}><Ionicons name="receipt" size={isWideScreen ? 24 : 16} color="#8B5CF6" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{financials ? `₹${(financials.total_invoiced / 1000).toFixed(1)}K` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Invoiced</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}><Ionicons name="pricetag" size={isWideScreen ? 24 : 16} color="#F59E0B" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{financials ? `₹${(financials.discount_given / 1000).toFixed(1)}K` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Discounts</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(6,182,212,0.12)' }]}><Ionicons name="return-up-back" size={isWideScreen ? 24 : 16} color="#06B6D4" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{financials ? `₹${(financials.refunds_issued / 1000).toFixed(1)}K` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Refunds</Text>
              </View>
            </View>
            {/* Collection Efficiency Progress */}
            <View style={[styles.progressCard, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Collection Efficiency</Text>
                <Text style={[styles.progressPct, { color: '#10B981' }]}>{financials?.collection_efficiency ?? 0}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <LinearGradient colors={['#10B981', '#34D399']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${Math.min(financials?.collection_efficiency ?? 0, 100)}%` as any }]} />
              </View>
            </View>
          </Animated.View>

          {/* ── REVENUE TREND CHART ── */}
          <Animated.View entering={FadeInDown.delay(310).springify()} style={[styles.chartCard, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
            <View style={styles.chartCardHeader}>
              <View>
                <Text style={[styles.chartCardTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Revenue Trend</Text>
                <Text style={[styles.chartCardSubtitle, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)' }]}>Monthly fee collection</Text>
              </View>
              <View style={[styles.chartCardDot, { backgroundColor: '#3B82F6' }]} />
            </View>
            <View style={[styles.chartCardDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]} />
            <View style={{ paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' }}>
              <LineChart
                data={(financials?.trend?.length ? financials.trend.map(t => ({...t, value: Number(t.value) })) : [{ value: 0 }])}
                height={isWideScreen ? 200 : 120}
                width={chartWidth}
                color="#3B82F6"
                thickness={2.5}
                startFillColor="rgba(59,130,246,0.25)"
                endFillColor="rgba(59,130,246,0.01)"
                startOpacity={1}
                endOpacity={0}
                initialSpacing={12}
                noOfSections={4}
                dataPointsColor="#3B82F6"
                dataPointsRadius={3}
                yAxisThickness={0}
                xAxisThickness={0}
                yAxisTextStyle={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)', fontSize: 9 }}
                xAxisLabelTextStyle={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)', fontSize: 9 }}
                rulesColor={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'}
                curved
                animationDuration={800}
                isAnimated
              />
            </View>
          </Animated.View>

          {/* ── ATTENDANCE OVERVIEW ── */}
          <SectionHeader label={'Attendance Analytics'} delay={320} styles={styles} theme={theme} isDark={isDark} />
          <Animated.View entering={FadeInDown.delay(330).springify()}>
            <View style={styles.metricGrid}>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}><Ionicons name="people" size={isWideScreen ? 24 : 16} color="#3B82F6" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{attendance ? `${attendance.avg_attendance}%` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Avg Attendance</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}><Ionicons name="warning" size={isWideScreen ? 24 : 16} color="#F59E0B" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{attendance ? String(attendance.chronic_absentees) : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>At Risk (&lt;75%)</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}><Ionicons name="calendar" size={isWideScreen ? 24 : 16} color="#10B981" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{attendance ? String(attendance.total_working_days) : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Working Days</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}><Ionicons name="id-card" size={isWideScreen ? 24 : 16} color="#8B5CF6" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{attendance ? `${attendance.staff_attendance}%` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Staff Att.</Text>
              </View>
            </View>
          </Animated.View>

          {/* ── ATTENDANCE TREND CHART ── */}
          <Animated.View entering={FadeInDown.delay(340).springify()} style={[styles.chartCard, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
            <View style={styles.chartCardHeader}>
              <View>
                <Text style={[styles.chartCardTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Attendance Trend</Text>
                <Text style={[styles.chartCardSubtitle, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)' }]}>Daily attendance percentage</Text>
              </View>
              <View style={[styles.chartCardDot, { backgroundColor: '#10B981' }]} />
            </View>
            <View style={[styles.chartCardDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]} />
            <View style={{ paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' }}>
              <LineChart
                data={(attendance?.trend?.length ? attendance.trend.map(t => ({...t, value: Number(t.value) })) : [{ value: 0 }])}
                height={isWideScreen ? 200 : 120}
                width={chartWidth}
                color="#10B981"
                thickness={2.5}
                startFillColor="rgba(16,185,129,0.25)"
                endFillColor="rgba(16,185,129,0.01)"
                startOpacity={1}
                endOpacity={0}
                initialSpacing={12}
                noOfSections={4}
                dataPointsColor="#10B981"
                dataPointsRadius={3}
                yAxisThickness={0}
                xAxisThickness={0}
                yAxisTextStyle={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)', fontSize: 9 }}
                xAxisLabelTextStyle={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)', fontSize: 9 }}
                rulesColor={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'}
                curved
                animationDuration={800}
                isAnimated
              />
            </View>
          </Animated.View>

          {/* ── ACADEMIC PERFORMANCE ── */}
          <SectionHeader label={'Academic Performance'} delay={360} styles={styles} theme={theme} isDark={isDark} />
          <Animated.View entering={FadeInDown.delay(370).springify()}>
            <View style={styles.metricGrid}>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}><Ionicons name="ribbon" size={isWideScreen ? 24 : 16} color="#8B5CF6" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{academics ? `${academics.avg_score}%` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Avg Score</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}><Ionicons name="checkmark-circle" size={isWideScreen ? 24 : 16} color="#10B981" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{academics ? `${academics.pass_rate}%` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Pass Rate</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}><Ionicons name="trophy" size={isWideScreen ? 24 : 16} color="#3B82F6" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>{academics?.top_subject ?? '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Top Subject</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}><Ionicons name="trending-down" size={isWideScreen ? 24 : 16} color="#EF4444" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>{academics?.weakest_subject ?? '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Needs Focus</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(6,182,212,0.12)' }]}><Ionicons name="document-text" size={isWideScreen ? 24 : 16} color="#06B6D4" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{academics ? String(academics.exams_conducted) : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Exams</Text>
              </View>
            </View>
            {/* Pass Rate Progress */}
            <View style={[styles.progressCard, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Pass Rate</Text>
                <Text style={[styles.progressPct, { color: '#8B5CF6' }]}>{academics?.pass_rate ?? 0}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <LinearGradient colors={['#8B5CF6', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${Math.min(academics?.pass_rate ?? 0, 100)}%` as any }]} />
              </View>
            </View>
          </Animated.View>

          {/* ── ACADEMIC SCORE TREND CHART ── */}
          <Animated.View entering={FadeInDown.delay(380).springify()} style={[styles.chartCard, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
            <View style={styles.chartCardHeader}>
              <View>
                <Text style={[styles.chartCardTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Score Trend</Text>
                <Text style={[styles.chartCardSubtitle, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)' }]}>Exam average over time</Text>
              </View>
              <View style={[styles.chartCardDot, { backgroundColor: '#8B5CF6' }]} />
            </View>
            <View style={[styles.chartCardDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]} />
            <View style={{ paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' }}>
              <BarChart
                data={(academics?.trend?.length ? academics.trend.map(t => ({ value: Number(t.value), label: t.label, frontColor: '#8B5CF6' })) : [{ value: 0, label: '', frontColor: '#8B5CF6' }])}
                height={isWideScreen ? 160 : 100}
                width={chartWidth}
                barWidth={20}
                barBorderRadius={4}
                noOfSections={4}
                maxValue={100}
                yAxisThickness={0}
                xAxisThickness={0}
                yAxisTextStyle={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)', fontSize: 9 }}
                xAxisLabelTextStyle={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)', fontSize: 9 }}
                rulesColor={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'}
                showGradient
                gradientColor="rgba(139,92,246,0.2)"
                animationDuration={800}
                isAnimated
              />
            </View>
          </Animated.View>

          {/* ── STAFF OVERVIEW ── */}
          <SectionHeader label={'Staff Overview'} delay={400} styles={styles} theme={theme} isDark={isDark} />
          <Animated.View entering={FadeInDown.delay(410).springify()}>
            <View style={styles.metricGrid}>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}><Ionicons name="people-circle" size={isWideScreen ? 24 : 16} color="#F59E0B" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{staff ? String(staff.total_staff) : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Total Staff</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}><Ionicons name="moon" size={isWideScreen ? 24 : 16} color="#EF4444" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{staff ? String(staff.on_leave_today) : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>On Leave</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(6,182,212,0.12)' }]}><Ionicons name="person-add" size={isWideScreen ? 24 : 16} color="#06B6D4" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{staff ? String(staff.new_joinings) : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>New Joins</Text>
              </View>
              <View style={[styles.metricCard, { width: metricCardWidth, backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}><Ionicons name="calendar" size={isWideScreen ? 24 : 16} color="#3B82F6" /></View>
                <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{staff ? `${staff.avg_staff_attendance}%` : '--'}</Text>
                <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>Staff Att.</Text>
              </View>
            </View>
            {/* Staff Attendance Progress */}
            <View style={[styles.progressCard, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Staff Attendance Rate</Text>
                <Text style={[styles.progressPct, { color: '#3B82F6' }]}>{staff?.avg_staff_attendance ?? 0}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                <LinearGradient colors={['#3B82F6', '#60A5FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${Math.min(staff?.avg_staff_attendance ?? 0, 100)}%` as any }]} />
              </View>
            </View>
          </Animated.View>

          {/* ── ALERTS & INSIGHTS ── */}
          {insights.length > 0 && (
            <>
              <SectionHeader label={'Active Alerts'} delay={430} styles={styles} theme={theme} isDark={isDark} />
              {insights.slice(0, 3).map((ins, idx) => (
                <Animated.View key={ins.id} entering={FadeInDown.delay(440 + idx * 50).springify()} style={[styles.alertCard, { backgroundColor: isDark ? '#1C2438' : '#FFFFFF', borderColor: ins.severity === 'high' ? 'rgba(239,68,68,0.3)' : ins.severity === 'medium' ? 'rgba(245,158,11,0.3)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                  <View style={[styles.alertStripe, { backgroundColor: ins.severity === 'high' ? '#EF4444' : ins.severity === 'medium' ? '#F59E0B' : '#3B82F6' }]} />
                  <View style={[styles.alertIconBox, { backgroundColor: ins.severity === 'high' ? 'rgba(239,68,68,0.12)' : ins.severity === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)' }]}>
                    <Ionicons name={ins.severity === 'high' ? 'alert-circle' : ins.severity === 'medium' ? 'warning' : 'information-circle'} size={16} color={ins.severity === 'high' ? '#EF4444' : ins.severity === 'medium' ? '#F59E0B' : '#3B82F6'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <View style={[styles.alertSevBadge, { backgroundColor: ins.severity === 'high' ? 'rgba(239,68,68,0.12)' : ins.severity === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)' }]}>
                        <Text style={[styles.alertSevText, { color: ins.severity === 'high' ? '#EF4444' : ins.severity === 'medium' ? '#F59E0B' : '#3B82F6' }]}>{ins.severity.toUpperCase()}</Text>
                      </View>
                      <View style={[styles.alertCatBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
                        <Text style={[styles.alertCatText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>{ins.category}</Text>
                      </View>
                    </View>
                    <Text style={[styles.alertMessage, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{ins.message}</Text>
                  </View>
                </Animated.View>
              ))}
            </>
          )}

          </View>{/* END RIGHT COLUMN */}
          </View>{/* END WEB ROW */}

          <View style={{ height: 48 }} />
        </ResponsiveCard>
      </Animated.ScrollView>

      <DashboardMenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeRoute={activeMenuRoute}
        items={quickActions}
        onItemPress={(route) => {
          setActiveMenuRoute(route);
          setIsMenuOpen(false);
          setTimeout(() => router.push(route as any), 300);
        }}
      />
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  STYLES                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
const getStyles = (theme: Theme, isDark: boolean, isWide = false) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0B0F17' : '#F4F6F9' },
    meshOrb: { position: 'absolute', borderRadius: 9999 },
    meshOrb1: { width: 600, height: 600, top: -150, right: -150, zIndex: 0 },
    content: { paddingHorizontal: isWide ? 40 : CONTAINER_PADDING, paddingBottom: 48 },
    webRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 32 } as any,

    greetingBlock: { marginBottom: 36, paddingTop: 12, paddingHorizontal: 2 },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    eyebrowText: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
    greetingName: { fontSize: SCREEN_WIDTH < 380 ? 38 : 44, fontWeight: '900', letterSpacing: -1.5, lineHeight: SCREEN_WIDTH < 380 ? 44 : 50, marginBottom: 12 },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    dateText: { fontSize: 14, fontWeight: '500', letterSpacing: 0.2 },
    dotSep: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 10 },
    timeText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

    activityRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 6, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.04, shadowRadius: 10, elevation: 4 },
    activityChip: { flex: 1, alignItems: 'center', borderRightWidth: 1 },
    activityChipValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
    activityChipLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },

    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: isWide ? 24 : 18, gap: 14, paddingHorizontal: 2 },
    sectionLabel: { fontSize: isWide ? 13 : 11, fontWeight: '800', letterSpacing: 2.5 },
    sectionDivider: { flex: 1, height: 1, borderRadius: 1 },

    carouselSection: { marginBottom: isWide ? 24 : 16 },
    statsContainer: { paddingRight: CONTAINER_PADDING, paddingBottom: 4 },
    statCardWrapper: { width: CARD_WIDTH, marginRight: CARD_MARGIN },
    statCard: { borderRadius: 28, padding: 24, paddingBottom: 20, height: 200, justifyContent: 'space-between', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: isDark ? 0.4 : 0.05, shadowRadius: 24, elevation: 8 },
    statOuterBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderRadius: 28 },
    statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
    statIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statContent: { flex: 1, justifyContent: 'center', marginTop: 8 },
    statValue: { fontSize: SCREEN_WIDTH < 380 ? 40 : 48, fontWeight: '800', letterSpacing: -1.5 },
    statCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1 },
    trendPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    trendText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
    statViewArrow: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.03)' },

    dotTrack: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 28 },
    dot: { height: 4, borderRadius: 99 },
    dotOn: { opacity: 1 },
    dotOff: { width: 12, opacity: 1 },

    /* ── ANALYTICS COMMAND CENTER ── */
    systemBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: isWide ? 18 : 22, borderWidth: 1, paddingHorizontal: isWide ? 28 : 20, paddingVertical: isWide ? 18 : 14, marginBottom: isWide ? 28 : 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.04, shadowRadius: 16, elevation: 6 },
    analyticsContainer: { borderRadius: 28, borderWidth: 1, paddingBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 24, elevation: 8, marginBottom: 24, overflow: 'hidden' },
    analyticsTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
    systemStatus: { flexDirection: 'row', alignItems: 'center', gap: isWide ? 12 : 8, flex: 1 },
    systemStatusText: { fontSize: isWide ? 14 : 11, fontWeight: '800', letterSpacing: 1, flexShrink: 1, marginRight: 8 },
    miniKpiRow: { flexDirection: 'row', alignItems: 'center', gap: isWide ? 20 : 12 },
    miniKpi: { alignItems: 'center' },
    miniKpiLabel: { fontSize: isWide ? 10 : 8, fontWeight: '800', letterSpacing: 1, marginBottom: isWide ? 4 : 2 },
    miniKpiValue: { fontSize: isWide ? 18 : 13, fontWeight: '900' },
    miniKpiSep: { width: 1, height: isWide ? 18 : 12, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)' },
    chartsArea: { flexDirection: 'row', padding: isWide ? 24 : 16 },
    chartCol: { flex: 1, alignItems: 'center' },
    chartDivider: { width: 1, marginHorizontal: 8 },
    chartTitle: { fontSize: isWide ? 12 : 9, fontWeight: '800', letterSpacing: 1.5 },
    insightStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, paddingVertical: isWide ? 14 : 10, borderRadius: 12 },
    insightStripText: { fontSize: isWide ? 14 : 11, fontWeight: '600' },

    /* ── METRIC GRID & CARDS ── */
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: isWide ? 16 : 10, marginBottom: isWide ? 20 : 12 },
    metricCard: { width: (SCREEN_WIDTH - CONTAINER_PADDING * 2 - 24) / 3, borderRadius: isWide ? 22 : 18, borderWidth: 1, padding: isWide ? 22 : 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.25 : 0.04, shadowRadius: 12, elevation: 4 },
    metricIconWrap: { width: isWide ? 48 : 32, height: isWide ? 48 : 32, borderRadius: isWide ? 14 : 10, alignItems: 'center', justifyContent: 'center', marginBottom: isWide ? 12 : 8 },
    metricValue: { fontSize: isWide ? 24 : 16, fontWeight: '900', letterSpacing: -0.5, marginBottom: isWide ? 6 : 4 },
    metricLabel: { fontSize: isWide ? 12 : 9, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },

    /* ── PROGRESS BARS ── */
    progressCard: { borderRadius: isWide ? 22 : 18, borderWidth: 1, padding: isWide ? 24 : 16, marginBottom: isWide ? 20 : 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.25 : 0.04, shadowRadius: 12, elevation: 4 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isWide ? 14 : 10 },
    progressTitle: { fontSize: isWide ? 16 : 13, fontWeight: '700' },
    progressPct: { fontSize: isWide ? 20 : 15, fontWeight: '900' },
    progressTrack: { height: isWide ? 12 : 8, borderRadius: isWide ? 6 : 4, overflow: 'hidden' },
    progressFill: { height: isWide ? 12 : 8, borderRadius: isWide ? 6 : 4 },

    /* ── CHART CARDS ── */
    chartCard: { borderRadius: isWide ? 24 : 22, borderWidth: 1, marginBottom: isWide ? 24 : 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.04, shadowRadius: 16, elevation: 6 },
    chartCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: isWide ? 28 : 20, paddingTop: isWide ? 24 : 18, paddingBottom: isWide ? 16 : 12 },
    chartCardTitle: { fontSize: isWide ? 20 : 15, fontWeight: '800', letterSpacing: -0.3 },
    chartCardSubtitle: { fontSize: isWide ? 14 : 11, fontWeight: '500', marginTop: 2 },
    chartCardDot: { width: isWide ? 12 : 8, height: isWide ? 12 : 8, borderRadius: isWide ? 6 : 4 },
    chartCardDivider: { height: 1, marginHorizontal: isWide ? 28 : 20 },

    /* ── ALERT CARDS ── */
    alertCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: isWide ? 22 : 18, borderWidth: 1, padding: isWide ? 20 : 14, paddingLeft: 0, marginBottom: isWide ? 14 : 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.2 : 0.03, shadowRadius: 10, elevation: 3 },
    alertStripe: { width: isWide ? 5 : 4, borderTopLeftRadius: isWide ? 22 : 18, borderBottomLeftRadius: isWide ? 22 : 18, alignSelf: 'stretch', marginRight: isWide ? 16 : 12 },
    alertIconBox: { width: isWide ? 44 : 32, height: isWide ? 44 : 32, borderRadius: isWide ? 14 : 10, alignItems: 'center', justifyContent: 'center', marginRight: isWide ? 14 : 10 },
    alertSevBadge: { paddingHorizontal: isWide ? 12 : 8, paddingVertical: isWide ? 4 : 2, borderRadius: isWide ? 8 : 6 },
    alertSevText: { fontSize: isWide ? 11 : 9, fontWeight: '800', letterSpacing: 0.5 },
    alertCatBadge: { paddingHorizontal: isWide ? 12 : 8, paddingVertical: isWide ? 4 : 2, borderRadius: isWide ? 8 : 6 },
    alertCatText: { fontSize: isWide ? 11 : 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    alertMessage: { fontSize: isWide ? 15 : 12, fontWeight: '600', lineHeight: isWide ? 24 : 18 },

    /* ── GRID ── */
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: isWide ? 32 : 24 },
    gridWrapper: {},

    gridItem: {
      width: '100%',
      aspectRatio: 1 / 1.15,
      borderRadius: 22,
      overflow: 'hidden',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
      elevation: 12,
    },

    gridInnerBorder: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      borderRadius: 22,
    },

    ghostOrb: {
      position: 'absolute',
      width: ORB_SIZE,
      height: ORB_SIZE,
      borderRadius: ORB_SIZE / 2,
      backgroundColor: 'rgba(255,255,255,0.12)',
      bottom: -(ORB_SIZE * 0.35),
      right: -(ORB_SIZE * 0.35),
    },

    ghostOrbInner: {
      position: 'absolute',
      width: ORB_SIZE * 0.62,
      height: ORB_SIZE * 0.62,
      borderRadius: (ORB_SIZE * 0.62) / 2,
      backgroundColor: 'rgba(255,255,255,0.08)',
      bottom: -(ORB_SIZE * 0.08),
      right: -(ORB_SIZE * 0.08),
    },

    gridContent: {
      flex: 1,
      padding: 13,
      justifyContent: 'space-between',
    },

    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.30)',
    },

    bottomRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },

    gridTitle: {
      flex: 1,
      fontSize: SCREEN_WIDTH < 380 ? 12 : 13,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
      lineHeight: 17,
      marginRight: 6,
      textShadowColor: 'rgba(0,0,0,0.25)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },

    arrowChip: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    gridBadge: {
      position: 'absolute',
      top: 9,
      right: 9,
      backgroundColor: '#EF4444',
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
      elevation: 6,
      zIndex: 10,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.5)',
    },
    gridBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.2,
    },
  });