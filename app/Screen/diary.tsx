import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  Layout,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import StudentHeader from '../../src/components/StudentHeader';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/hooks/useAuth';
import i18n from '@/src/i18n';

import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import database from '../../src/database';
import DiaryEntry from '../../src/database/models/DiaryEntry';
import { sync } from '../../src/database/sync';
import { useTheme, SchoolTheme } from '../../src/hooks/useTheme';
import { IconBadgeColors, IconBadgeColorsDark } from '../../src/theme/themes';
import { t_field } from '../../src/utils/lang';
import LogoLoader from '../../src/components/LogoLoader';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIARY_HISTORY_PRIOR_DAYS = 14;
const CONTENT_MAX_WIDTH = 580;
const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

type TabId = 'today' | 'history';

// ─── Subject Config ───────────────────────────────────────────────────────────

type SubjectConfig = {
  color: string;
  icon: string;
  gradient: readonly [string, string, string];
  darkGradient: readonly [string, string, string];
  label: string;
};

function getSubjectStyle(subject: string = ''): SubjectConfig {
  const s = subject.toLowerCase();
  if (s.includes('math'))
    return { color: '#2563EB', icon: 'calculate', gradient: ['#1D4ED8', '#3B82F6', '#60A5FA'] as const, darkGradient: ['#1E3A8A', '#2563EB', '#3B82F6'] as const, label: 'Mathematics' };
  if (s.includes('science') || s.includes('bio'))
    return { color: '#7C3AED', icon: 'biotech', gradient: ['#6D28D9', '#8B5CF6', '#A78BFA'] as const, darkGradient: ['#4C1D95', '#6D28D9', '#7C3AED'] as const, label: 'Science' };
  if (s.includes('english'))
    return { color: '#D97706', icon: 'menu-book', gradient: ['#B45309', '#D97706', '#FBBF24'] as const, darkGradient: ['#78350F', '#B45309', '#D97706'] as const, label: 'English' };
  if (s.includes('telugu') || s.includes('hindi'))
    return { color: '#DC2626', icon: 'translate', gradient: ['#B91C1C', '#DC2626', '#F87171'] as const, darkGradient: ['#7F1D1D', '#B91C1C', '#DC2626'] as const, label: 'Language' };
  if (s.includes('social'))
    return { color: '#DB2777', icon: 'public', gradient: ['#BE185D', '#DB2777', '#F472B6'] as const, darkGradient: ['#831843', '#BE185D', '#DB2777'] as const, label: 'Social Studies' };
  if (s.includes('art') || s.includes('draw'))
    return { color: '#059669', icon: 'palette', gradient: ['#047857', '#059669', '#34D399'] as const, darkGradient: ['#064E3B', '#047857', '#059669'] as const, label: 'Arts' };
  return { color: '#4F46E5', icon: 'description', gradient: ['#4338CA', '#4F46E5', '#818CF8'] as const, darkGradient: ['#312E81', '#4338CA', '#4F46E5'] as const, label: 'General' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYmd(date: Date) {
  return date.toISOString().split('T')[0];
}

function priorHistoryYmds(anchor: Date): string[] {
  return Array.from({ length: DIARY_HISTORY_PRIOR_DAYS }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - (i + 1));
    return toYmd(d);
  });
}

function buildCalendarMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────
// Fixed pixel sizes so the grid renders correctly on both native and web.
// On web, percentage widths inside a full-screen Modal grow to enormous sizes;
// hard-coding the cell dimensions avoids that entirely.

const CAL_CELL = 44;   // outer tap target (px)
const CAL_INNER = 38;  // visible day circle (px)
const CAL_TOTAL_W = CAL_CELL * 7; // 308 px — fits any phone; centered on web

function MiniCalendar({
  selectedYmd,
  onSelect,
  availableYmds,
}: {
  selectedYmd: string;
  onSelect: (ymd: string) => void;
  availableYmds: string[];
}) {
  const { theme, isDark } = useTheme();
  const todayYmd = toYmd(new Date());

  const [viewYear, setViewYear] = useState(() => parseInt(selectedYmd.split('-')[0]));
  const [viewMonth, setViewMonth] = useState(() => parseInt(selectedYmd.split('-')[1]) - 1);

  const cells = buildCalendarMonth(viewYear, viewMonth);
  const availableSet = new Set(availableYmds);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric',
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  return (
    // Centre the fixed-width calendar inside whatever container it's in
    <View style={{ paddingBottom: 8, alignItems: 'center' }}>

      {/* Month navigation */}
      <View style={{
        width: CAL_TOTAL_W,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingHorizontal: 2,
      }}>
        <Pressable
          onPress={prevMonth}
          hitSlop={10}
          style={{
            width: 36, height: 36, borderRadius: 10,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
          }}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.textSecondary} />
        </Pressable>

        <Text style={{
          fontSize: 16, fontWeight: '800', color: theme.colors.textStrong, letterSpacing: -0.4,
        }}>
          {monthLabel}
        </Text>

        <Pressable
          onPress={nextMonth}
          hitSlop={10}
          style={{
            width: 36, height: 36, borderRadius: 10,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={{ width: CAL_TOTAL_W, flexDirection: 'row', marginBottom: 4 }}>
        {WEEK_DAYS.map(d => (
          <View key={d} style={{ width: CAL_CELL, alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{
              fontSize: 10, fontWeight: '800',
              color: theme.colors.textMuted, letterSpacing: 0.8,
            }}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid — fixed width, wrapping rows of 7 */}
      <View style={{ width: CAL_TOTAL_W, flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, idx) => {
          // Empty spacer
          if (!day) {
            return <View key={`e${idx}`} style={{ width: CAL_CELL, height: CAL_CELL }} />;
          }

          const ymd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = ymd === selectedYmd;
          const isToday = ymd === todayYmd;
          const hasData = availableSet.has(ymd);
          const isFuture = ymd > todayYmd;

          return (
            <Pressable
              key={ymd}
              onPress={() => !isFuture && onSelect(ymd)}
              disabled={isFuture}
              style={{
                width: CAL_CELL,
                height: CAL_CELL,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isFuture ? 0.3 : 1,
              }}
            >
              {/* Day circle */}
              <View style={{
                width: CAL_INNER,
                height: CAL_INNER,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderWidth: isToday && !isSelected ? 2 : 0,
                borderColor: theme.colors.primary,
              }}>
                {isSelected && (
                  <LinearGradient
                    colors={['#4338CA', '#6366F1']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  zIndex: 1,
                  color: isSelected
                    ? '#FFFFFF'
                    : isToday
                      ? theme.colors.primary
                      : theme.colors.textStrong,
                }}>
                  {day}
                </Text>
                {/* Homework dot */}
                {hasData && !isSelected ? (
                  <View style={{
                    position: 'absolute',
                    bottom: 4,
                    width: 4, height: 4, borderRadius: 2,
                    backgroundColor: theme.colors.primary,
                  }} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Date Picker Bottom Sheet ─────────────────────────────────────────────────

function DatePickerSheet({
  visible,
  selectedYmd,
  availableYmds,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedYmd: string;
  availableYmds: string[];
  onSelect: (ymd: string) => void;
  onClose: () => void;
}) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={styles.sheetOverlay}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(260)}
        exiting={SlideOutDown.duration(220)}
        style={styles.sheetContainer}
      >
        <LinearGradient
          colors={isDark ? ['#161B2E', '#0F172A'] : ['#FFFFFF', '#F5F7FF']}
          style={[styles.sheetCard, {
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
          }]}
        >
          {/* Drag handle */}
          <View style={[styles.sheetHandle, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.15)',
          }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Pick a Date</Text>
              <Text style={styles.sheetSubtitle}>
                Dots mark days with homework
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.sheetCloseBtn, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)',
              }]}
            >
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <MiniCalendar
            selectedYmd={selectedYmd}
            onSelect={(ymd) => { onSelect(ymd); onClose(); }}
            availableYmds={availableYmds}
          />
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

// ─── Tab Switcher ─────────────────────────────────────────────────────────────

function TabSwitcher({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const tabs: { id: TabId; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { id: 'today', icon: 'today-outline', label: "Today's HW" },
    { id: 'history', icon: 'time-outline', label: 'History' },
  ];

  return (
    <View style={[styles.tabBar, {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    }]}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={styles.tabItem}
            onPress={() => onChange(tab.id)}
            android_ripple={{ color: '#6366F1' + '18', borderless: true }}
          >
            {isActive && (
              <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { borderRadius: 12, overflow: 'hidden' }]}>
                <LinearGradient
                  colors={['#4338CA', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}
            <Ionicons name={tab.icon} size={16} color={isActive ? '#FFFFFF' : theme.colors.textMuted} />
            <Text style={[styles.tabLabel, { color: isActive ? '#FFFFFF' : theme.colors.textMuted }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Date Selector Button ─────────────────────────────────────────────────────

function DateSelectorButton({
  selectedYmd,
  onPress,
}: {
  selectedYmd: string;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [y, m, d] = selectedYmd.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  let relLabel = '';
  const diff = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (date.toDateString() === yesterday.toDateString()) relLabel = 'Yesterday';
  else if (diff <= 7) relLabel = `${diff} days ago`;
  else relLabel = `${Math.round(diff / 7)} week${Math.round(diff / 7) !== 1 ? 's' : ''} ago`;

  const fullLabel = date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      layout={Layout.springify()}
      style={styles.dateSelectorWrap}
    >
      <Pressable onPress={onPress} android_ripple={{ color: '#6366F1' + '18' }}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.2)', 'rgba(15,23,42,0.85)']
            : ['rgba(99,102,241,0.08)', 'rgba(255,255,255,0.96)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.dateSelector, {
            borderColor: isDark ? 'rgba(99,102,241,0.32)' : 'rgba(99,102,241,0.2)',
          }]}
        >
          <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.dsIconBox}>
            <Ionicons name="calendar" size={16} color="#FFFFFF" />
          </LinearGradient>

          <View style={styles.dsText}>
            <Text style={styles.dsLabel} numberOfLines={1}>{fullLabel}</Text>
            <Text style={[styles.dsRel, { color: theme.colors.primary }]}>{relLabel}</Text>
          </View>

          <View style={[styles.dsChevron, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)',
          }]}>
            <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ item, index }: { item: DiaryEntry; index: number }) {
  useTranslation(); // Subscribe so t_field(title/content) updates on language change.
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const subj = getSubjectStyle(item.subjectName || item.title);
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.975], Extrapolation.CLAMP) }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.87], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 75).duration(500).springify()} style={animStyle}>
      <Pressable
        onPressIn={() => { pressed.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
        onPressOut={() => { pressed.value = withSpring(0, { damping: 20, stiffness: 300 }); }}
        android_ripple={{ color: subj.color + '18' }}
      >
        <View style={[styles.taskCard, isDark ? styles.taskCardDark : styles.taskCardLight]}>
          <LinearGradient colors={isDark ? subj.darkGradient : subj.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.accentStrip} />
          <View style={styles.iconColumn}>
            <LinearGradient colors={isDark ? subj.darkGradient : subj.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.subjIconBadge}>
              <MaterialIcons name={subj.icon as any} size={18} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardMeta}>
              <View style={[styles.subjPill, { backgroundColor: isDark ? subj.color + '22' : subj.color + '12', borderColor: isDark ? subj.color + '40' : subj.color + '28' }]}>
                <View style={[styles.subjDot, { backgroundColor: subj.color }]} />
                <Text style={[styles.subjPillText, { color: subj.color }]}>{item.subjectName || subj.label}</Text>
              </View>
              {item.homeworkDueDate ? (
                <View style={[styles.dueChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
                  <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                  <Text style={styles.dueText}>Due {new Date(item.homeworkDueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                </View>
              ) : null}
            </View>
            {item.title ? <Text style={styles.taskTitle} numberOfLines={2}>{t_field(item.title, item.titleTe)}</Text> : null}
            <Text style={styles.taskBody} numberOfLines={3}>{t_field(item.content, item.contentTe)}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── DiaryTaskList ────────────────────────────────────────────────────────────

function DiaryTaskList({ tasks, emptyLabel }: { tasks: DiaryEntry[]; emptyLabel?: string }) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const { t } = useTranslation();
  const badge = isDark ? IconBadgeColorsDark.diary : IconBadgeColors.diary;

  if (tasks.length === 0) {
    return (
      <Animated.View entering={FadeIn.duration(500)}>
        <LinearGradient
          colors={isDark ? ['rgba(99,102,241,0.1)', 'rgba(56,189,248,0.06)', 'rgba(15,23,42,0.8)'] : ['rgba(99,102,241,0.04)', 'rgba(56,189,248,0.04)', '#F8FAFC']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.emptyCard, { borderColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.18)' }]}
        >
          <View style={[styles.emptyRing, styles.emptyRingOuter, { borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }]} />
          <View style={[styles.emptyRing, styles.emptyRingInner, { borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)' }]} />
          <LinearGradient colors={isDark ? ['rgba(99,102,241,0.3)', 'rgba(56,189,248,0.15)'] : ['rgba(99,102,241,0.12)', 'rgba(56,189,248,0.08)']} style={styles.emptyIconCircle}>
            <Ionicons name="sparkles" size={30} color={badge.icon} />
          </LinearGradient>
          <Text style={styles.emptyTitle}>{t('diary.all_caught_up', 'All caught up!')}</Text>
          <Text style={styles.emptyBody}>{emptyLabel ?? t('diary.no_homework', 'No homework for this day 🎉')}</Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <View style={styles.taskList}>
      {tasks.map((item, i) => <TaskCard key={item.id} item={item} index={i} />)}
    </View>
  );
}

// ─── WatermelonDB observers ───────────────────────────────────────────────────

const DiaryForDateRaw = ({ tasks }: { tasks: DiaryEntry[] }) => <DiaryTaskList tasks={tasks} />;

const enhanceForDate = withObservables(
  ['date', 'classId'],
  ({ date, classId }: { date: string; classId: string }) => {
    const preds = [Q.where('entry_date', date)];
    if (classId) preds.push(Q.where('class_section_id', classId));
    return { tasks: database.collections.get<DiaryEntry>('diary_entries').query(...preds) };
  }
);
const DiaryListForDate = enhanceForDate(DiaryForDateRaw);

// Silent observer: tells us which history dates have entries (for calendar dots)
const DiaryHistoryDotsRaw = ({
  tasks,
  onDatesWithData,
}: {
  tasks: DiaryEntry[];
  onDatesWithData: (ymds: string[]) => void;
}) => {
  const ymds = useMemo(() => Array.from(new Set(tasks.map(t => t.entryDate))), [tasks]);
  useEffect(() => { onDatesWithData(ymds); }, [ymds.join(',')]);
  return null;
};

const enhanceHistoryDots = withObservables(
  ['historyDates', 'classId'],
  ({ historyDates, classId }: { historyDates: string[]; classId: string }) => {
    const preds = [Q.where('entry_date', Q.oneOf(historyDates))];
    if (classId) preds.push(Q.where('class_section_id', classId));
    return { tasks: database.collections.get<DiaryEntry>('diary_entries').query(...preds) };
  }
);
const DiaryHistoryDots = enhanceHistoryDots(DiaryHistoryDotsRaw);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DiaryScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const { t } = useTranslation();
  const { user } = useAuth();

  const today = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => toYmd(today), []);
  const priorDates = useMemo(() => priorHistoryYmds(today), [todayYmd]);

  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [historyDate, setHistoryDate] = useState(() => priorDates[0]); // default: yesterday
  const [datesWithData, setDatesWithData] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const winW = Dimensions.get('window').width;
  const hPad = winW >= CONTENT_MAX_WIDTH + 40 ? Math.max(20, (winW - CONTENT_MAX_WIDTH) / 2) : 20;
  const classId = (user as any)?.classId || '';

  useEffect(() => { triggerSync(); }, [user?.userId]);

  async function triggerSync() {
    if (!user) return;
    setSyncing(true);
    try { await sync(); } catch (_) { } finally { setSyncing(false); }
  }

  // Hero metadata
  const monthShort = today.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const dayNum = today.getDate().toString();
  const weekday = today.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const todayFull = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const activeDate = activeTab === 'today' ? todayYmd : historyDate;

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={isDark ? ['#07090F', '#0C1120', '#0F172A'] : ['#F5F7FF', '#FAFBFF', '#F0F4FF']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {isDark && (
        <>
          <View style={styles.glowBlob1} pointerEvents="none" />
          <View style={styles.glowBlob2} pointerEvents="none" />
        </>
      )}

      {/* Silently observe history dates for calendar dots */}
      {user ? (
        <DiaryHistoryDots
          historyDates={priorDates}
          classId={classId}
          onDatesWithData={setDatesWithData}
        />
      ) : null}

      <StudentHeader showBackButton title={t('home.diary', 'Diary')} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: hPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', width: '100%' }}>

          {/* ── Hero Card ─────────────────────────────── */}
          <Animated.View entering={FadeInDown.duration(600).springify()}>
            <LinearGradient
              colors={isDark
                ? ['rgba(99,102,241,0.18)', 'rgba(15,23,42,0.95)', 'rgba(15,23,42,0.98)']
                : ['#FFFFFF', '#FAFBFF', '#F0F4FF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <LinearGradient
                colors={isDark ? ['rgba(99,102,241,0.35)', 'transparent'] : ['rgba(99,102,241,0.15)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.heroCornerAccent}
              />
              <View style={styles.heroBody}>
                <LinearGradient
                  colors={isDark ? ['rgba(99,102,241,0.3)', 'rgba(99,102,241,0.15)'] : ['rgba(99,102,241,0.12)', 'rgba(99,102,241,0.06)']}
                  style={[styles.heroDateBlock, { borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.15)' }]}
                >
                  <Text style={[styles.heroDateMonth, { color: theme.colors.primary }]}>{monthShort}</Text>
                  <Text style={[styles.heroDateDay, { color: theme.colors.textStrong }]}>{dayNum}</Text>
                  <Text style={[styles.heroDateWeekday, { color: theme.colors.textSecondary }]}>{weekday}</Text>
                </LinearGradient>
                <View style={styles.heroTextBlock}>
                  <Text style={styles.heroTitle}>{t('home.diary', 'Diary')}</Text>
                  <Text style={[styles.heroDate, { color: theme.colors.primary }]}>{todayFull}</Text>
                  <Text style={styles.heroTagline}>{t('diary.hero_tagline', 'Stay on top of your assignments.')}</Text>
                </View>
                <View style={[styles.syncChip, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)',
                }]}>
                  {syncing
                    ? <LogoLoader size={22} color={theme.colors.primary} />
                    : <Ionicons name="cloud-done-outline" size={20} color={theme.colors.textMuted} />}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Tab Switcher ──────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(120).duration(500).springify()} style={styles.tabWrap}>
            <TabSwitcher active={activeTab} onChange={setActiveTab} />
          </Animated.View>

          {/* ── History: date selector ────────────────── */}
          {activeTab === 'history' ? (
            <DateSelectorButton
              selectedYmd={historyDate}
              onPress={() => setPickerVisible(true)}
            />
          ) : null}

          {/* ── Task content ──────────────────────────── */}
          <Animated.View
            key={activeDate}
            entering={FadeInDown.delay(60).duration(360).springify()}
          >
            {user ? (
              <DiaryListForDate
                key={`${i18n.language}-${activeDate}`}
                date={activeDate}
                classId={classId}
              />
            ) : null}
          </Animated.View>

        </View>
      </ScrollView>

      {/* ── Date Picker Bottom Sheet ──────────────── */}
      <DatePickerSheet
        visible={pickerVisible}
        selectedYmd={historyDate}
        availableYmds={[...datesWithData, ...priorDates]}
        onSelect={setHistoryDate}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (theme: SchoolTheme, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent' },
    scroll: { flex: 1 },
    scrollContent: { paddingTop: 12, paddingBottom: 80 },

    // Ambient glows
    glowBlob1: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(99,102,241,0.07)', top: -80, right: -80 },
    glowBlob2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(56,189,248,0.05)', top: 200, left: -60 },

    // Hero
    heroCard: {
      borderRadius: 24, overflow: 'hidden', marginBottom: 16, borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.2)',
      ...Platform.select({
        ios: { shadowColor: isDark ? '#4F46E5' : '#6366F1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.25 : 0.1, shadowRadius: 24 },
        android: { elevation: 8 },
      }),
    },
    heroCornerAccent: { position: 'absolute', top: 0, right: 0, width: 120, height: 120, borderTopRightRadius: 24 },
    heroBody: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
    heroDateBlock: { width: 56, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    heroDateMonth: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
    heroDateDay: { fontSize: 26, fontWeight: '800', letterSpacing: -1, lineHeight: 30 },
    heroDateWeekday: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
    heroTextBlock: { flex: 1, gap: 2 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.textStrong, letterSpacing: -0.5, lineHeight: 26 },
    heroDate: { fontSize: 12, fontWeight: '600', letterSpacing: 0.1, marginBottom: 2 },
    heroTagline: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
    syncChip: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

    // Tabs
    tabWrap: { marginBottom: 14 },
    tabBar: {
      flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, gap: 4,
    },
    tabItem: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 7, paddingVertical: 12, borderRadius: 12, overflow: 'hidden',
    },
    tabLabel: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },

    // Date selector button
    dateSelectorWrap: { marginBottom: 14 },
    dateSelector: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 13, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1,
    },
    dsIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    dsText: { flex: 1, gap: 2 },
    dsLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.textStrong, letterSpacing: -0.3 },
    dsRel: { fontSize: 12, fontWeight: '600' },
    dsChevron: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

    // Task list
    taskList: { gap: 12 },

    // Task card
    taskCard: { flexDirection: 'row', borderRadius: 18, overflow: 'hidden', borderWidth: 1, minHeight: 100 },
    taskCardLight: {
      backgroundColor: '#FFFFFF', borderColor: 'rgba(148,163,184,0.18)',
      ...Platform.select({ ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 } }),
    },
    taskCardDark: {
      backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)',
      ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 4 } }),
    },
    accentStrip: { width: 4 },
    iconColumn: { paddingTop: 16, paddingLeft: 14 },
    subjIconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cardContent: { flex: 1, paddingTop: 14, paddingBottom: 16, paddingLeft: 12, paddingRight: 16, gap: 6 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    subjPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    subjDot: { width: 5, height: 5, borderRadius: 3 },
    subjPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
    dueChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    dueText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
    taskTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textStrong, letterSpacing: -0.3, lineHeight: 21 },
    taskBody: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },

    // Empty state
    emptyCard: {
      alignItems: 'center', justifyContent: 'center', paddingVertical: 52,
      paddingHorizontal: 24, borderRadius: 24, borderWidth: 1, overflow: 'hidden',
    },
    emptyRing: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
    emptyRingOuter: { width: 160, height: 160 },
    emptyRingInner: { width: 110, height: 110 },
    emptyIconCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textStrong, letterSpacing: -0.4, marginBottom: 6 },
    emptyBody: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },

    // Bottom sheet
    sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    sheetCard: {
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0,
    },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
    sheetHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    },
    sheetTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.textStrong, letterSpacing: -0.5 },
    sheetSubtitle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 3, fontWeight: '500' },
    sheetCloseBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

    // MiniCalendar uses fully inline fixed-px styles (no stylesheet entries needed).
  });