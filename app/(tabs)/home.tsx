/**
 * HomeScreen.tsx — Premium v5
 * ─────────────────────────────────────────────────────────
 * ✦ Feature cards: FULL vivid gradient backgrounds — colourful,
 *   instantly recognisable, premium glass footer strip
 * ✦ Single top announcement (fresh ≤ 36h above grid, stale below)
 * ✦ Complete dark ↔ light mode on every element
 * ✦ Rural-friendly: bold labels, large icons, clear contrast
 */

import React, { useState, useCallback, useMemo, useEffect, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from '@/src/utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import HeaderCard from '../../src/components/HeaderCard';
import { useAuth } from '../../src/hooks/useAuth';
import { StudentService, StudentDashboardResponse } from '../../src/services/studentService';
import { useStudentQuery } from '../../src/hooks/useStudentQuery';
import { AttendanceSummary } from '../../src/types/models';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import { t_field } from '../../src/utils/lang';

const { width } = Dimensions.get('window');
const H_PAD = 20;

/** Lazy-loaded react-native-svg module (home-only decorative Ring/DotGrid). */
type ReactNativeSvgModule = typeof import('react-native-svg');
const HomeSvgContext = createContext<ReactNativeSvgModule | null>(null);
const GAP = 12;
const CARD_W = (width - H_PAD * 2 - GAP) / 2;

/* ═══════════════════════════════════════════
   TYPES + DATA
═══════════════════════════════════════════ */
interface HomeTab {
  key: string;
  title: string;
  translationKey?: string;
  subtitleKey: string;
  ionIcon: keyof typeof Ionicons.glyphMap;
  grad: [string, string];   // vivid gradient pair
  shadowColor: string;             // colored drop shadow
}

const homeTabs: HomeTab[] = [
  {
    key: 'messages',
    subtitleKey: 'dashboard.featureSubtitles.school_updates',
    translationKey: 'announcements.title', title: 'Announcements',
    ionIcon: 'megaphone-outline',
    grad: ['#4F7FE8', '#7B54E0'], shadowColor: '#4F7FE8',
  },
  {
    key: 'complaints',
    subtitleKey: 'dashboard.featureSubtitles.raise_concern',
    translationKey: 'complaints.title', title: 'Complaints',
    ionIcon: 'alert-circle-outline',
    grad: ['#F05656', '#C62B2B'], shadowColor: '#F05656',
  },
  {
    key: 'lifeValues',
    subtitleKey: 'dashboard.featureSubtitles.character_growth',
    translationKey: 'lifeValues', title: 'Life Values',
    ionIcon: 'heart-outline',
    grad: ['#12BB78', '#0A8E58'], shadowColor: '#12BB78',
  },
  {
    key: 'hostel',
    subtitleKey: 'dashboard.featureSubtitles.stay_services',
    translationKey: 'hostel', title: 'Hostel',
    ionIcon: 'bed-outline',
    grad: ['#0DB8AC', '#098F84'], shadowColor: '#0DB8AC',
  },
  {
    key: 'busmap',
    subtitleKey: 'dashboard.featureSubtitles.live_bus',
    translationKey: 'admin_dashboard.transport', title: 'Transport',
    ionIcon: 'bus-outline',
    grad: ['#F5A623', '#D4820F'], shadowColor: '#F5A623',
  },
  {
    key: 'projects',
    subtitleKey: 'dashboard.featureSubtitles.lab_innovation',
    translationKey: 'scienceProjects', title: 'Science Projects',
    ionIcon: 'flask-outline',
    grad: ['#17A8CC', '#0F7FA0'], shadowColor: '#17A8CC',
  },
  {
    key: 'test',
    subtitleKey: 'dashboard.featureSubtitles.assessments',
    translationKey: 'exams', title: 'Exams',
    ionIcon: 'document-text-outline',
    grad: ['#A855F7', '#7C3AED'], shadowColor: '#A855F7',
  },
  {
    key: 'profile',
    subtitleKey: 'dashboard.featureSubtitles.personal_details',
    translationKey: 'menu.profile', title: 'Student Profile',
    ionIcon: 'person-circle-outline',
    grad: ['#6366F1', '#4338CA'], shadowColor: '#6366F1',
  },
];

const routeMap: Record<string, string> = {
  profile: '/Screen/profile',
  complaints: '/Screen/complaints',
  busmap: '/Screen/busTracker',
  hostel: '/Screen/hostel',
  messages: '/Screen/announcements',
  lifeValues: '/Screen/lifeValues',
  projects: '/Screen/scienceProjects',
  test: '/Screen/weekendTest',
};

/* ═══════════════════════════════════════════
   CIRCULAR RING
═══════════════════════════════════════════ */
const Ring = ({ pct, size = 86, sw = 7, color = '#22D3EE', isDark }: {
  pct: number; size?: number; sw?: number; color?: string; isDark: boolean;
}) => {
  const svgMod = useContext(HomeSvgContext);
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  if (!svgMod) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: sw, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }} />;
  }
  const Svg = svgMod.default;
  const { Circle, Defs, LinearGradient: SvgGrad, Stop } = svgMod;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <SvgGrad id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor="#6366F1" stopOpacity="1" />
        </SvgGrad>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r}
        stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}
        strokeWidth={sw} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r}
        stroke="url(#rg)" strokeWidth={sw} fill="none"
        strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ}
        strokeLinecap="round" />
    </Svg>
  );
};

/* ═══════════════════════════════════════════
   DOT GRID TEXTURE
═══════════════════════════════════════════ */
const DotGrid = ({ color, size }: { color: string; size: number }) => {
  const svgMod = useContext(HomeSvgContext);
  if (!svgMod) return null;
  const Svg = svgMod.default;
  const { Circle, Defs, Pattern, Rect } = svgMod;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <Pattern id="d" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
          <Circle cx="2" cy="2" r="1.4" fill={color} />
        </Pattern>
      </Defs>
      <Rect width={size} height={size} fill="url(#d)" />
    </Svg>
  );
};

/* ═══════════════════════════════════════════
   STATUS PILL
═══════════════════════════════════════════ */
const S_CFG = {
  present: { bg: 'rgba(16,185,129,0.14)', dot: '#10B981', dk: '#34D399', lt: '#059669' },
  absent: { bg: 'rgba(239,68,68,0.13)', dot: '#EF4444', dk: '#F87171', lt: '#DC2626' },
  late: { bg: 'rgba(245,158,11,0.13)', dot: '#F59E0B', dk: '#FCD34D', lt: '#D97706' },
  half_day: { bg: 'rgba(249,115,22,0.13)', dot: '#F97316', dk: '#FB923C', lt: '#EA580C' },
} as const;

const STATUS_I18N: Record<string, keyof typeof S_CFG | 'not_marked'> = {
  present: 'present',
  absent: 'absent',
  late: 'late',
  half_day: 'half_day',
  not_marked: 'not_marked',
};

const StatusPill = ({ status, isDark }: { status: string; isDark: boolean }) => {
  const { t } = useTranslation();
  const sk = STATUS_I18N[status] ?? 'not_marked';
  const c =
    sk === 'not_marked'
      ? { bg: 'rgba(148,163,184,0.1)', dot: '#94A3B8', dk: '#94A3B8', lt: '#64748B' }
      : (S_CFG as any)[sk];
  const label =
    sk === 'not_marked'
      ? t('studentHome.attendanceStatus.not_marked')
      : t(`studentHome.attendanceStatus.${sk}`);
  return (
    <View style={[sp.pill, { backgroundColor: c.bg }]}>
      <View style={[sp.dot, { backgroundColor: c.dot }]} />
      <Text style={[sp.lbl, { color: isDark ? c.dk : c.lt }]}>{label}</Text>
    </View>
  );
};
const sp = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, gap: 7, alignSelf: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  lbl: { fontSize: 13, fontWeight: '700', letterSpacing: 0.15 },
});

/* ═══════════════════════════════════════════
   FEATURE CARD — colourful gradient, premium
═══════════════════════════════════════════ */
const FeatureCard = ({ tab, isDark, onPress }: {
  tab: HomeTab & { title: string; subtitle: string }; isDark: boolean; onPress: () => void;
}) => {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ width: CARD_W }, anim]}>
      <Pressable
        onPressIn={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          scale.value = withSpring(0.93, { damping: 11, mass: 0.38 });
        }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 11, mass: 0.38 }); }}
        onPress={onPress}
      >
        <LinearGradient
          colors={isDark
            /* dark: slightly muted so it doesn't scream */
            ? [tab.grad[0] + 'DD', tab.grad[1] + 'BB']
            /* light: full vivid */
            : [tab.grad[0], tab.grad[1]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            fc.card,
            {
              // coloured shadow matching the card hue
              ...Platform.select({
                ios: {
                  shadowColor: tab.shadowColor,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: isDark ? 0.55 : 0.42,
                  shadowRadius: 16,
                },
                android: { elevation: 10 },
              }),
            },
          ]}
        >
          {/* White dot texture overlay */}
          <DotGrid color="rgba(255,255,255,0.10)" size={CARD_W} />

          {/* Bright top-right bloom */}
          <View style={fc.bloom} />

          {/* Bottom-left deep shadow blob */}
          <View style={[fc.shadowBlob, { backgroundColor: tab.grad[1] + '99' }]} />

          {/* Icon — frosted circle */}
          <View style={fc.iconCircle}>
            <Ionicons name={tab.ionIcon} size={28} color="#fff" />
          </View>

          {/* Title */}
          <Text style={fc.title} numberOfLines={2}>{tab.title}</Text>

          {/* Subtitle */}
          <Text style={fc.subtitle} numberOfLines={1}>{tab.subtitle}</Text>

          {/* Bottom glass action strip */}
          <View style={fc.glassStrip}>
            <Text style={fc.openLabel}>{t('studentHome.open')}</Text>
            <View style={fc.arrowCircle}>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

const fc = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    minHeight: 158,
    overflow: 'hidden',
    gap: 8,
  },
  bloom: {
    position: 'absolute', top: -30, right: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  shadowBlob: {
    position: 'absolute', bottom: -20, left: -20,
    width: 80, height: 80, borderRadius: 40,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  title: {
    fontSize: 15, fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.05, lineHeight: 20,
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 11.5, fontWeight: '600',
    color: 'rgba(255,255,255,0.70)',
    lineHeight: 15,
  },
  glassStrip: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto' as any,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  openLabel: {
    fontSize: 11, fontWeight: '800',
    color: '#FFFFFF', letterSpacing: 1,
    textTransform: 'uppercase',
  },
  arrowCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center', alignItems: 'center',
  },
});

/* ═══════════════════════════════════════════
   ANNOUNCEMENT CARD
═══════════════════════════════════════════ */
const AnnouncementCard = ({
  notice, isDark, isFresh, onPress,
}: {
  notice: any; isDark: boolean; isFresh: boolean; onPress: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const accent = isFresh ? '#F97316' : '#64748B';
  const localeTag = i18n.language?.startsWith('te') ? 'te-IN' : 'en-IN';
  const date = notice.created_at
    ? new Date(notice.created_at).toLocaleDateString(localeTag, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const tagLabel = isFresh ? t('studentHome.tagNewAnnouncement') : t('studentHome.tagAnnouncement');
  const noticeFallback = t('studentHome.noticeFallback');

  return (
    <Animated.View style={anim}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14 }); }}
        onPress={onPress}
      >
        {isDark ? (
          <View style={[an.darkCard, { borderColor: accent + '38' }]}>
            <View style={[an.bgBlob, { backgroundColor: accent + '10' }]} />
            <View style={an.inner}>
              <View style={an.topRow}>
                <View style={[an.tag, { backgroundColor: accent + '22' }]}>
                  {isFresh && <View style={[an.liveDot, { backgroundColor: accent }]} />}
                  <Text style={[an.tagTxt, { color: accent }]}>
                    {isFresh ? `📣 ${tagLabel}` : `📋 ${tagLabel}`}
                  </Text>
                </View>
                <Text style={an.darkDate}>{date}</Text>
              </View>
              <Text style={an.darkTitle} numberOfLines={1}>{t_field(notice.title, notice.title_te) || noticeFallback}</Text>
              <Text style={an.darkBody} numberOfLines={2}>{t_field(notice.content, notice.content_te)}</Text>
              <View style={[an.footer, { borderTopColor: 'rgba(255,255,255,0.07)' }]}>
                <Text style={[an.readMore, { color: accent }]}>{t('studentHome.readFullAnnouncement')}</Text>
                <Ionicons name="arrow-forward-circle" size={18} color={accent} />
              </View>
            </View>
            <LinearGradient
              colors={[accent, accent + '40']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={an.leftBar}
            />
          </View>
        ) : (
          <LinearGradient
            colors={isFresh ? ['#FFF7ED', '#FFEDD5'] : ['#F8FAFC', '#F1F5F9']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[an.lightCard, { borderColor: accent + '32' }]}
          >
            <View style={an.inner}>
              <View style={an.topRow}>
                <View style={[an.tag, { backgroundColor: accent + '18' }]}>
                  {isFresh && <View style={[an.liveDot, { backgroundColor: accent }]} />}
                  <Text style={[an.tagTxt, { color: accent }]}>
                    {isFresh ? `📣 ${tagLabel}` : `📋 ${tagLabel}`}
                  </Text>
                </View>
                <Text style={[an.darkDate, { color: '#94A3B8' }]}>{date}</Text>
              </View>
              <Text style={[an.darkTitle, { color: '#0F172A' }]} numberOfLines={1}>{t_field(notice.title, notice.title_te) || noticeFallback}</Text>
              <Text style={[an.darkBody, { color: '#475569' }]} numberOfLines={2}>{t_field(notice.content, notice.content_te)}</Text>
              <View style={[an.footer, { borderTopColor: 'rgba(0,0,0,0.06)' }]}>
                <Text style={[an.readMore, { color: accent }]}>{t('studentHome.readFullAnnouncement')}</Text>
                <Ionicons name="arrow-forward-circle" size={18} color={accent} />
              </View>
            </View>
            <LinearGradient
              colors={[accent, accent + '40']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={an.leftBar}
            />
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
};

const an = StyleSheet.create({
  darkCard: {
    backgroundColor: '#0D0F16', borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  lightCard: {
    borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  bgBlob: { position: 'absolute', top: 0, right: 0, width: 160, height: 120, borderBottomLeftRadius: 120 },
  inner: { padding: 18, gap: 9 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  tagTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  darkDate: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  darkTitle: { fontSize: 15.5, fontWeight: '800', color: 'rgba(255,255,255,0.95)', letterSpacing: 0.1, lineHeight: 22 },
  darkBody: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, marginTop: 2 },
  readMore: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  leftBar: { position: 'absolute', top: 16, bottom: 16, left: 0, width: 4, borderRadius: 2 },
});

/* ═══════════════════════════════════════════
   SECTION LABEL
═══════════════════════════════════════════ */
const SectionLabel = ({
  text, isDark, accent = '#22D3EE', badge,
}: {
  text: string; isDark: boolean; accent?: string; badge?: string;
}) => (
  <View style={[sl.row, {
    backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.68)',
    borderColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.7)',
  }]}>
    <LinearGradient colors={[accent, accent + '55']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={sl.bar} />
    <Text style={[sl.text, { color: isDark ? 'rgba(255,255,255,0.48)' : '#64748B' }]}>{text}</Text>
    {badge && (
      <View style={[sl.badge, { backgroundColor: accent + (isDark ? '22' : '18') }]}>
        <Text style={[sl.badgeTxt, { color: accent }]}>{badge}</Text>
      </View>
    )}
  </View>
);
const sl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  bar: { width: 3, height: 17, borderRadius: 3 },
  text: { flex: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

/* ═══════════════════════════════════════════
   TEACHER CARD
═══════════════════════════════════════════ */
const TeacherCard = ({ name, role, isDark }: { name: string; role: string; isDark: boolean }) => {
  const { t } = useTranslation();
  const contact = t('studentHome.teacherContact');
  return isDark ? (
    <View style={tc.darkCard}>
      <DotGrid color="rgba(129,140,248,0.11)" size={width} />
      <View style={tc.row}>
        <LinearGradient colors={['#818CF8', '#5B21B6']} style={tc.avatar}>
          <Ionicons name="person" size={22} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={tc.darkName}>{name}</Text>
          <Text style={tc.darkRole}>{role}</Text>
        </View>
        <View style={tc.contactBtn}>
          <LinearGradient
            colors={['rgba(129,140,248,0.22)', 'rgba(129,140,248,0.08)']}
            style={tc.contactGrad}
          >
            <Ionicons name="mail-outline" size={14} color="#818CF8" />
            <Text style={tc.contactTxt}>{contact}</Text>
          </LinearGradient>
        </View>
      </View>
      <LinearGradient colors={['#818CF8', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={tc.leftBar} />
    </View>
  ) : (
    <View style={tc.lightCard}>
      <View style={[tc.lightTint, { backgroundColor: '#EEF2FF' }]} />
      <View style={tc.row}>
        <LinearGradient colors={['#818CF8', '#5B21B6']} style={tc.avatar}>
          <Ionicons name="person" size={22} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[tc.darkName, { color: '#0F172A' }]}>{name}</Text>
          <Text style={[tc.darkRole, { color: '#94A3B8' }]}>{role}</Text>
        </View>
        <Pressable style={tc.lightContactBtn}>
          <Ionicons name="mail-outline" size={13} color="#818CF8" />
          <Text style={tc.contactTxt}>{contact}</Text>
        </Pressable>
      </View>
      <LinearGradient colors={['#818CF8', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={tc.leftBar} />
    </View>
  );
};

const tc = StyleSheet.create({
  darkCard: {
    backgroundColor: '#0D0F16', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(129,140,248,0.2)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
  },
  lightCard: {
    backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    ...Platform.select({
      ios: { shadowColor: '#818CF8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  lightTint: { position: 'absolute', top: 0, right: 0, width: 120, height: 100, borderBottomLeftRadius: 120, opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  darkName: { fontSize: 15.5, fontWeight: '800', color: 'rgba(255,255,255,0.92)', letterSpacing: 0.1, marginBottom: 3 },
  darkRole: { fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: '500' },
  contactBtn: { overflow: 'hidden', borderRadius: 20 },
  contactGrad: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  lightContactBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(129,140,248,0.1)' },
  contactTxt: { fontSize: 12, color: '#818CF8', fontWeight: '700' },
  leftBar: { position: 'absolute', top: 14, bottom: 14, left: 0, width: 4, borderRadius: 2 },
});

/* ═══════════════════════════════════════════
   SNAPSHOT CARD
═══════════════════════════════════════════ */
const SnapshotCard = ({
  pct, attColor, todayStatus, presentDays, totalDays, isDark, onPress,
}: {
  pct: number; attColor: string; todayStatus: string;
  presentDays: number; totalDays: number; isDark: boolean; onPress: () => void;
}) => {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const chips = [
    { n: presentDays, c: isDark ? '#34D399' : '#059669', l: t('studentHome.chipPresent'), k: 'p' },
    { n: totalDays - presentDays, c: isDark ? '#F87171' : '#DC2626', l: t('studentHome.chipAbsent'), k: 'a' },
    { n: totalDays, c: isDark ? '#94A3B8' : '#64748B', l: t('studentHome.chipTotal'), k: 't' },
  ];

  return (
    <Animated.View style={anim}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.975, { damping: 14 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14 }); }}
        onPress={onPress}
      >
        {isDark ? (
          <View style={sn.darkCard}>
            <DotGrid color="rgba(34,211,238,0.065)" size={width} />
            <View style={sn.header}>
              <View style={sn.labelRow}>
                <View style={[sn.pulse, { backgroundColor: attColor }]} />
                <Text style={sn.darkLbl}>{t('studentHome.todaysSnapshot')}</Text>
              </View>
              <View style={sn.viewRow}>
                <Text style={sn.viewTxt}>{t('studentHome.attendanceLink')}</Text>
                <Ionicons name="chevron-forward" size={13} color="#475569" />
              </View>
            </View>
            <View style={sn.metrics}>
              <View style={sn.ringCol}>
                <View style={sn.ringWrap}>
                  <Ring pct={pct} size={86} sw={7} color={attColor} isDark />
                  <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={[sn.ringPct, { color: attColor }]}>{pct}%</Text>
                    <Text style={sn.ringSub}>{t('studentHome.overall')}</Text>
                  </View>
                </View>
              </View>
              <View style={sn.divDark} />
              <View style={sn.rightCol}>
                <Text style={sn.darkSubLbl}>{t('studentHome.todaysStatus')}</Text>
                <StatusPill status={todayStatus} isDark />
                <View style={sn.chipRow}>
                  {chips.map(ch => (
                    <View key={ch.k} style={sn.darkChip}>
                      <Text style={[sn.chipNum, { color: ch.c }]}>{ch.n}</Text>
                      <Text style={sn.darkChipLbl}>{ch.l}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <LinearGradient
              colors={[attColor + '00', attColor + '40', attColor + '00']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={sn.bottomLine}
            />
          </View>
        ) : (
          <LinearGradient colors={['#FFFFFF', '#F0F9FF']} style={sn.lightCard}>
            <View style={sn.header}>
              <View style={sn.labelRow}>
                <View style={[sn.pulse, { backgroundColor: attColor }]} />
                <Text style={[sn.darkLbl, { color: '#475569' }]}>{t('studentHome.todaysSnapshot')}</Text>
              </View>
              <View style={sn.viewRow}>
                <Text style={[sn.viewTxt, { color: '#94A3B8' }]}>{t('studentHome.attendanceLink')}</Text>
                <Ionicons name="chevron-forward" size={13} color="#CBD5E1" />
              </View>
            </View>
            <View style={sn.metrics}>
              <View style={sn.ringCol}>
                <View style={sn.ringWrap}>
                  <Ring pct={pct} size={86} sw={7} color={attColor} isDark={false} />
                  <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={[sn.ringPct, { color: attColor }]}>{pct}%</Text>
                    <Text style={[sn.ringSub, { color: '#94A3B8' }]}>{t('studentHome.overall')}</Text>
                  </View>
                </View>
              </View>
              <View style={sn.divLight} />
              <View style={sn.rightCol}>
                <Text style={[sn.darkSubLbl, { color: '#94A3B8' }]}>{t('studentHome.todaysStatus')}</Text>
                <StatusPill status={todayStatus} isDark={false} />
                <View style={sn.chipRow}>
                  {chips.map(ch => (
                    <View key={ch.k} style={sn.lightChip}>
                      <Text style={[sn.chipNum, { color: ch.c }]}>{ch.n}</Text>
                      <Text style={[sn.darkChipLbl, { color: '#94A3B8' }]}>{ch.l}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <LinearGradient
              colors={[attColor + '00', attColor + '30', attColor + '00']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={sn.bottomLine}
            />
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
};

const sn = StyleSheet.create({
  darkCard: {
    backgroundColor: '#0A0C12', borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },
  lightCard: {
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden', padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16 },
      android: { elevation: 5 },
    }),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  darkLbl: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.2 },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewTxt: { fontSize: 12, fontWeight: '600', color: '#475569' },
  metrics: { flexDirection: 'row', alignItems: 'center' },
  ringCol: { alignItems: 'center' },
  ringWrap: { width: 86, height: 86, justifyContent: 'center', alignItems: 'center' },
  ringPct: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8, lineHeight: 26 },
  ringSub: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.6 },
  divDark: { width: 1, height: 88, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20 },
  divLight: { width: 1, height: 88, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 20 },
  rightCol: { flex: 1, gap: 10 },
  darkSubLbl: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  darkChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingVertical: 8, alignItems: 'center', gap: 2 },
  lightChip: { flex: 1, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 10, paddingVertical: 8, alignItems: 'center', gap: 2 },
  chipNum: { fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  darkChipLbl: { fontSize: 8.5, fontWeight: '700', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: 0.5 },
  bottomLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5 },
});

/* ═══════════════════════════════════════════
   HOME SCREEN
═══════════════════════════════════════════ */
const HomeScreen = () => {
  const { theme, isDark } = useTheme();
  const S = React.useMemo(() => getStyles(isDark), [isDark]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isStudent = user?.role?.code === 'student';

  const [svgMod, setSvgMod] = useState<ReactNativeSvgModule | null>(null);
  useEffect(() => {
    void import('react-native-svg').then(setSvgMod);
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const { data: dash, refetch } = useStudentQuery<StudentDashboardResponse>(
    '/student/dashboard',
    'dashboard',
    2 * 60 * 1000,
    user?.userId,
    { enabled: !!user?.userId && isStudent }
  );

  const student = useMemo(() => dash?.profile ?? null, [dash]);
  const attendanceStats = useMemo(() => (dash?.attendance?.summary as AttendanceSummary | null) ?? null, [dash]);
  const notices = useMemo(() => (dash?.notices as any[]) ?? [], [dash]);
  const todaysStatus = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const rec = dash?.attendance?.latest_record as { attendance_date?: string; status?: string } | null;
    if (rec?.attendance_date?.startsWith(today) && rec.status) return rec.status;
    return 'not_marked';
  }, [dash]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const nav = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const r = routeMap[key];
    if (r) router.push(r as any);
  };

  const total = Number(attendanceStats?.total || 0);
  const present = Number(attendanceStats?.present || 0);
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const attClr = pct >= 85 ? '#22D3EE' : pct >= 70 ? '#FBBF24' : '#F87171';

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: e => { scrollY.value = e.contentOffset.y; } });

  /* 36-hour notice rule */
  const FRESH = 36 * 60 * 60 * 1000;
  const isFresh = (n: any) => !!n?.created_at && Date.now() - new Date(n.created_at).getTime() < FRESH;
  const freshNotices = notices.filter(isFresh);
  const staleNotices = notices.filter(n => !isFresh(n));
  const topNotice = freshNotices[0] ?? null;   // single fresh notice above grid
  const belowNotice = topNotice ? staleNotices[0] ?? null : staleNotices[0] ?? null;

  const hr = new Date().getHours();
  const gStr =
    hr < 12 ? t('dashboard.good_morning') : hr < 17 ? t('dashboard.good_afternoon') : t('dashboard.good_evening');
  const gIco = hr < 12 ? '☀️' : hr < 17 ? '🌤️' : '🌙';

  const classSec = useMemo(() => {
    const ce = student?.current_enrollment;
    if (!ce) return t('studentHome.classNA');
    const cn = ce.class_name || ce.class_code || t('studentHome.classWord');
    const sec = ce.section_name?.replace(/Section\s*/i, '') ?? '';
    return `${cn} · ${t('studentHome.sectionPrefix')} ${sec}`.trim();
  }, [student, t]);

  const bg = isDark ? '#060810' : '#E8EEF6';
  const heroBg = isDark ? '#07080F' : '#1C3557';

  return (
    <HomeSvgContext.Provider value={svgMod}>
    <ScreenLayout>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />
      <StudentHeader scrollY={scrollY} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[S.scroll, { backgroundColor: bg }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing} onRefresh={onRefresh}
            tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent"
          />
        }
      >
        {refreshing && <View style={S.loaderRow}><LogoLoader size={28} /></View>}

        {/* ── HERO ── */}
        <View style={[S.hero, { backgroundColor: heroBg, paddingTop: Math.max(insets.top, 36) + 60 }]}>
          <View style={S.meshLayer} pointerEvents="none">
            <View style={[S.orb, { width: 300, height: 300, top: -80, left: -80, backgroundColor: '#1E40AF', opacity: 0.28 }]} />
            <View style={[S.orb, { width: 220, height: 220, top: 10, right: -50, backgroundColor: '#6D28D9', opacity: 0.22 }]} />
            <View style={[S.orb, { width: 180, height: 180, bottom: -30, left: '25%' as any, backgroundColor: '#0369A1', opacity: 0.2 }]} />
          </View>
          <Animated.View entering={FadeInDown.delay(40).duration(600).springify()} style={S.greetRow}>
            <Text style={S.greetEmoji}>{gIco}</Text>
            <Text style={S.greetTxt}>{gStr}</Text>
          </Animated.View>
          <HeaderCard
            studentName={student?.display_name || user?.displayName || t('studentHome.studentFallback')}
            classSec={classSec}
            rollNo={student?.current_enrollment?.roll_number || 'N/A'}
          />
        </View>

        {/* ── BODY ── */}
        <LinearGradient
          colors={isDark
            ? ['#060810', '#0A111E', '#060810']
            : ['#EDF2F8', '#E6EEF8', '#EDF2F8']
          }
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={S.body}
        >
          {/* 1. Snapshot */}
          <Animated.View entering={FadeInUp.delay(160).duration(700).springify()}>
            <SnapshotCard
              pct={pct} attColor={attClr}
              todayStatus={todaysStatus}
              presentDays={present} totalDays={total}
              isDark={isDark}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/Screen/attendance');
              }}
            />
          </Animated.View>

          {/* 2. Fresh notice ABOVE grid */}
          {topNotice && (
            <Animated.View entering={FadeInUp.delay(240).duration(700).springify()}>
              <SectionLabel
                text={t('studentHome.latestAnnouncement')}
                isDark={isDark}
                accent="#F97316"
                badge={t('studentHome.badgeNew')}
              />
              <AnnouncementCard notice={topNotice} isDark={isDark} isFresh onPress={() => nav('messages')} />
            </Animated.View>
          )}

          {/* 3. Quick Actions grid */}
          <Animated.View entering={FadeInUp.delay(310).duration(700).springify()}>
            <SectionLabel
              text={t('dashboard.quick_actions')}
              isDark={isDark}
              accent={isDark ? '#38BDF8' : '#3B82F6'}
            />
            <View style={S.grid}>
              {homeTabs.map((item, i) => (
                <Animated.View key={item.key} entering={FadeInUp.delay(340 + i * 38).duration(560).springify()}>
                  <FeatureCard
                    tab={{
                      ...item,
                      title: item.translationKey ? (t(item.translationKey) as string) : item.title,
                      subtitle: t(item.subtitleKey),
                    }}
                    isDark={isDark}
                    onPress={() => nav(item.key)}
                  />
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* 4. Class Teacher */}
          <Animated.View entering={FadeInUp.delay(460).duration(700).springify()}>
            <SectionLabel text={t('studentHome.academicAdvisor')} isDark={isDark} accent="#818CF8" />
            <TeacherCard
              name={student?.current_enrollment?.class_teacher || t('studentHome.notAssigned')}
              role={t('common.class_teacher')}
              isDark={isDark}
            />
          </Animated.View>

          {/* 5. Stale / fallback notice BELOW grid */}
          {belowNotice && (
            <Animated.View entering={FadeInUp.delay(520).duration(700).springify()}>
              <SectionLabel
                text={topNotice ? t('studentHome.previousUpdate') : t('studentHome.recentUpdate')}
                isDark={isDark}
                accent="#64748B"
              />
              <AnnouncementCard notice={belowNotice} isDark={isDark} isFresh={false} onPress={() => nav('messages')} />
            </Animated.View>
          )}
        </LinearGradient>
      </Animated.ScrollView>
    </ScreenLayout>
    </HomeSvgContext.Provider>
  );
};

export default HomeScreen;

/* ═══════════════════════════════════════════
   ROOT STYLES
═══════════════════════════════════════════ */
const getStyles = (isDark: boolean) => StyleSheet.create({
  scroll: { paddingBottom: 72 },
  loaderRow: { alignItems: 'center', paddingVertical: 18 },

  hero: { paddingBottom: 56, overflow: 'hidden' },
  meshLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },

  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 22, marginBottom: 12 },
  greetEmoji: { fontSize: 17 },
  greetTxt: { fontSize: 14, color: 'rgba(255,255,255,0.58)', fontWeight: '600', letterSpacing: 0.3 },

  body: {
    marginTop: -32,
    paddingHorizontal: H_PAD,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 30,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(255,255,255,0.62)',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});