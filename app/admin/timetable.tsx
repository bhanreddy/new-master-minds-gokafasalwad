import React, { useState, useEffect, useRef } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Modal,
  Animated,
  Platform
} from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import AdminHeader from '../../src/components/AdminHeader';
import { ClassService, ClassInfo, Section } from '../../src/services/classService';
import { ResultService, Subject } from '../../src/services/commonServices';
import { StaffService, Staff } from '../../src/services/staffService';
import { TimetableService, TimetableSlot, Period } from '../../src/services/timetableService';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PALETTE = {
  indigo: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA',
    900: '#1E1B4B',
  },
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
  },
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
const fmt = (t: string) => {
  if (!t) return '--:--';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

const getMins = (t: string) => {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getDurationLabel = (s: string, e: string) => {
  const d = getMins(e) - getMins(s);
  if (d <= 0) return null;
  if (d < 60) return `${d}m`;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const minsToTime = (totalMins: number): string => {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};

// ─── Animated Row ──────────────────────────────────────────────────────────────
function AnimatedRow({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Animated Progress Bar ────────────────────────────────────────────────────
function AnimatedProgress({ pct, isDone }: { pct: number; isDone: boolean }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 600, delay: 200, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <Animated.View
      style={{
        height: '100%',
        borderRadius: 99,
        backgroundColor: isDone ? PALETTE.emerald[500] : PALETTE.indigo[500],
        width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
      }}
    />
  );
}

// ─── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ title, icon }: { title: string; icon?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
      {icon && <Ionicons name={icon as any} size={12} color={PALETTE.indigo[500]} />}
      <Text style={{ fontSize: 10, fontWeight: '800', color: PALETTE.slate[400], letterSpacing: 1.4, textTransform: 'uppercase' }}>
        {title}
      </Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TimetableManagement() {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [yearId, setYearId] = useState<string>('');
  const [classTeacherName, setClassTeacherName] = useState<string>('');

  const [modalVisible, setModalVisible] = useState(false);
  const [activeSlotData, setActiveSlotData] = useState<{ period: number } | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [managePeriodsVisible, setManagePeriodsVisible] = useState(false);
  const [editedPeriods, setEditedPeriods] = useState<Period[]>([]);

  const [editPeriodModalVisible, setEditPeriodModalVisible] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);

  const [createPeriodVisible, setCreatePeriodVisible] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [cls, sec, sub, st, year, pds] = await Promise.all([
        ClassService.getClasses(),
        ClassService.getSections(),
        ResultService.getSubjects(),
        StaffService.getAll({ status_id: 1 }),
        ClassService.getCurrentAcademicYear(),
        TimetableService.getPeriods(),
      ]);
      setClasses(cls); setSections(sec); setSubjects(sub);
      setStaff(st); setPeriods(pds);
      if (year) setYearId(year.id);
    } catch {
      alertCompat('Error', 'Failed to load metadata');
    } finally {
      setLoading(false);
      setPeriodsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId && selectedSectionId) findClassSectionAndLoadSlots();
  }, [selectedClassId, selectedSectionId]);

  const findClassSectionAndLoadSlots = async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const mappings = await ClassService.getClassSections(yearId);
      const match = mappings.find(m => m.class_id === selectedClassId && m.section_id === selectedSectionId);
      if (match) {
        setClassSectionId(match.id);
        setClassTeacherName(match.class_teacher_name || '');
        const data = await TimetableService.getClassSlots(match.id, yearId);
        setSlots(data);
      } else {
        setClassSectionId(null); setClassTeacherName(''); setSlots([]);
        alertCompat('Notice', 'No Class-Section mapping found. Please assign section to class in "Academic Structure" first.');
      }
    } catch { } finally { setLoading(false); }
  };

  const handlePeriodPressForSlot = (periodNumber: number) => {
    if (!classSectionId) { alertCompat('Select Class', 'Please select a class and section first'); return; }
    const existing = slots.find(s => s.period_number === periodNumber);
    const periodDef = periods.find(p => p.sort_order === periodNumber);
    setActiveSlotData({ period: periodNumber });
    setStartTime(existing?.start_time || periodDef?.start_time || '09:00:00');
    setEndTime(existing?.end_time || periodDef?.end_time || '10:00:00');
    setSelectedSubjectId(existing?.subject_id || '');
    if (periodNumber === 1 && !existing && classTeacherName) {
      const ct = staff.find(s => (s.display_name || s.first_name || '') === classTeacherName);
      setSelectedTeacherId(ct?.id || '');
    } else { setSelectedTeacherId(existing?.teacher_id || ''); }
    setModalVisible(true);
  };

  const handleSaveSlot = async () => {
    if (!classSectionId || !activeSlotData || !selectedSubjectId) {
      alertCompat('Error', 'Please select a subject'); return;
    }
    try {
      await TimetableService.createSlot({
        academic_year_id: yearId,
        class_section_id: classSectionId,
        period_number: activeSlotData.period,
        subject_id: selectedSubjectId,
        teacher_id: selectedTeacherId || undefined,
        start_time: startTime,
        end_time: endTime,
      });
      setModalVisible(false);
      const data = await TimetableService.getClassSlots(classSectionId, yearId);
      setSlots(data);
    } catch (error: any) {
      alertCompat('Error', error.response?.data?.error || error.message || 'Failed to save slot');
    }
  };

  const handleDeleteSlot = async () => {
    const existing = slots.find(s => activeSlotData && s.period_number === activeSlotData.period);
    if (existing) {
      try {
        await TimetableService.deleteSlot(existing.id);
        setModalVisible(false);
        if (classSectionId) {
          const data = await TimetableService.getClassSlots(classSectionId, yearId);
          setSlots(data);
        }
      } catch { alertCompat('Error', 'Failed to delete'); }
    }
  };

  const getSlotForPeriod = (periodNumber: number) => slots.find(s => s.period_number === periodNumber);

  const openManagePeriods = () => {
    setEditedPeriods(JSON.parse(JSON.stringify(periods)));
    setManagePeriodsVisible(true);
  };

  const handleSavePeriods = async () => {
    try {
      setLoading(true);
      await TimetableService.updatePeriods(editedPeriods);
      setPeriods(editedPeriods);
      setManagePeriodsVisible(false);
      alertCompat('Success', 'Timings updated');
    } catch { alertCompat('Error', 'Failed to update periods'); }
    finally { setLoading(false); }
  };

  const updatePeriodTime = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const updated = [...editedPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setEditedPeriods(updated);
  };

  // Adjust duration of period at `index` by `delta` minutes, then cascade all downstream
  const adjustDuration = (index: number, delta: number) => {
    const updated = [...editedPeriods];
    const current = updated[index];
    const startM = getMins(current.start_time);
    const endM = getMins(current.end_time);
    const newEnd = Math.max(startM + 5, endM + delta); // minimum 5-minute period
    updated[index] = { ...current, end_time: minsToTime(newEnd) };

    // cascade: each following period starts where the previous one ended
    for (let i = index + 1; i < updated.length; i++) {
      const prevEnd = getMins(updated[i - 1].end_time);
      const dur = getMins(updated[i].end_time) - getMins(updated[i].start_time);
      const safeDur = dur > 0 ? dur : 45; // fallback to 45 min if invalid
      updated[i] = {
        ...updated[i],
        start_time: minsToTime(prevEnd),
        end_time: minsToTime(prevEnd + safeDur),
      };
    }
    setEditedPeriods(updated);
  };

  // Insert a break/lunch after the given index
  const insertBreakAfter = (afterIndex: number) => {
    const updated = [...editedPeriods];
    const prevEnd = getMins(updated[afterIndex].end_time);
    const breakDuration = 15;
    const newBreak: Period = {
      id: `temp_break_${Date.now()}`,
      name: 'Break',
      start_time: minsToTime(prevEnd),
      end_time: minsToTime(prevEnd + breakDuration),
      sort_order: afterIndex + 2,
    } as Period;
    updated.splice(afterIndex + 1, 0, newBreak);
    // re-cascade from the inserted break onward
    for (let i = afterIndex + 2; i < updated.length; i++) {
      const pEnd = getMins(updated[i - 1].end_time);
      const d = getMins(updated[i].end_time) - getMins(updated[i].start_time);
      const sd = d > 0 ? d : 45;
      updated[i] = { ...updated[i], start_time: minsToTime(pEnd), end_time: minsToTime(pEnd + sd) };
    }
    // fix sort_order
    updated.forEach((p, i) => { p.sort_order = i + 1; });
    setEditedPeriods(updated);
  };

  // Remove break at given index
  const removeBreak = (index: number) => {
    const updated = [...editedPeriods];
    updated.splice(index, 1);
    // cascade from the removed position onward
    for (let i = index; i < updated.length; i++) {
      if (i === 0) continue;
      const pEnd = getMins(updated[i - 1].end_time);
      const d = getMins(updated[i].end_time) - getMins(updated[i].start_time);
      const sd = d > 0 ? d : 45;
      updated[i] = { ...updated[i], start_time: minsToTime(pEnd), end_time: minsToTime(pEnd + sd) };
    }
    updated.forEach((p, i) => { p.sort_order = i + 1; });
    setEditedPeriods(updated);
  };

  // Adjust the start time of the first period, then cascade everything
  const adjustStartTime = (delta: number) => {
    const updated = [...editedPeriods];
    if (updated.length === 0) return;
    const first = updated[0];
    const newStart = Math.max(0, getMins(first.start_time) + delta);
    const dur = getMins(first.end_time) - getMins(first.start_time);
    const safeDur = dur > 0 ? dur : 45;
    updated[0] = { ...first, start_time: minsToTime(newStart), end_time: minsToTime(newStart + safeDur) };

    for (let i = 1; i < updated.length; i++) {
      const prevEnd = getMins(updated[i - 1].end_time);
      const d = getMins(updated[i].end_time) - getMins(updated[i].start_time);
      const sd = d > 0 ? d : 45;
      updated[i] = {
        ...updated[i],
        start_time: minsToTime(prevEnd),
        end_time: minsToTime(prevEnd + sd),
      };
    }
    setEditedPeriods(updated);
  };

  const handlePeriodPress = (period: Period) => {
    setEditingPeriod({ ...period });
    setEditPeriodModalVisible(true);
  };

  const handleSaveSinglePeriod = async () => {
    if (!editingPeriod) return;
    try {
      setLoading(true);
      await TimetableService.updatePeriods([editingPeriod]);
      setPeriods(periods.map(p => p.id === editingPeriod.id ? editingPeriod : p));
      setEditPeriodModalVisible(false);
      alertCompat('Success', 'Period updated');
    } catch { alertCompat('Error', 'Failed to update period'); }
    finally { setLoading(false); }
  };

  const handleDeletePeriod = () => {
    if (!editingPeriod) return;
    alertCompat(
      'Delete Period',
      `Delete "${editingPeriod.name}"? This will remove all timetable slots for this period across all classes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              setLoading(true);
              await TimetableService.deletePeriod(editingPeriod.id);
              setPeriods(periods.filter(p => p.id !== editingPeriod.id));
              setEditPeriodModalVisible(false);
              if (classSectionId) {
                const data = await TimetableService.getClassSlots(classSectionId, yearId);
                setSlots(data);
              }
              alertCompat('Success', 'Period deleted');
            } catch { alertCompat('Error', 'Failed to delete period'); }
            finally { setLoading(false); }
          },
        },
      ]
    );
  };

  // ─── Slot Row ─────────────────────────────────────────────────────────────────
  const renderSlotRow = (period: Period, slot: TimetableSlot | undefined, index: number) => {
    const isFilled = !!slot;
    return (
      <AnimatedRow key={period.id} delay={index * 40}>
        <View style={styles.rowCard}>
          {/* Accent bar */}
          <View style={[styles.rowAccent, isFilled && styles.rowAccentFilled]} />

          {/* Period tap zone */}
          <TouchableOpacity
            style={styles.periodCell}
            onPress={() => handlePeriodPress(period)}
            activeOpacity={0.65}
          >
            <View style={[styles.periodBadge, isFilled && styles.periodBadgeFilled]}>
              <Text style={styles.periodBadgeText}>{period.sort_order}</Text>
            </View>
            <Text style={styles.periodTime}>{fmt(period.start_time)}</Text>
            <View style={styles.periodTimeDivider} />
            <Text style={[styles.periodTime, { color: PALETTE.slate[400] }]}>{fmt(period.end_time)}</Text>
          </TouchableOpacity>

          {/* Slot tap zone */}
          <TouchableOpacity
            style={styles.slotCell}
            onPress={() => handlePeriodPressForSlot(period.sort_order)}
            activeOpacity={0.6}
          >
            {isFilled ? (
              <View style={styles.slotFilledContent}>
                <Text style={styles.slotSubjectText} numberOfLines={1}>{slot.subject_name}</Text>
                <View style={styles.teacherRow}>
                  <Ionicons
                    name={slot.teacher_name ? 'person-circle-outline' : 'person-outline'}
                    size={12}
                    color={slot.teacher_name ? PALETTE.indigo[400] : PALETTE.slate[300]}
                  />
                  <Text style={[styles.slotTeacherText, !slot.teacher_name && styles.slotTeacherEmpty]} numberOfLines={1}>
                    {slot.teacher_name || 'No teacher assigned'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.slotEmptyContent}>
                <View style={styles.addIconWrap}>
                  <Ionicons name="add" size={16} color={PALETTE.indigo[500]} />
                </View>
                <Text style={styles.slotEmptyText}>Tap to assign</Text>
              </View>
            )}
            <Ionicons
              name={isFilled ? 'create-outline' : 'chevron-forward'}
              size={14}
              color={isFilled ? PALETTE.indigo[300] : PALETTE.slate[300]}
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>
        </View>
      </AnimatedRow>
    );
  };

  // ─── Break Row ────────────────────────────────────────────────────────────────
  const renderBreakRow = (startT: string, endT: string, key: string) => {
    const mins = (() => {
      const [sh, sm] = startT.split(':').map(Number);
      const [eh, em] = endT.split(':').map(Number);
      return (eh * 60 + em) - (sh * 60 + sm);
    })();
    return (
      <View key={key} style={styles.breakRow}>
        <View style={styles.breakLine} />
        <View style={styles.breakPill}>
          <Ionicons name="cafe-outline" size={12} color={PALETTE.amber[600]} />
          <Text style={styles.breakLabel}>
            {mins >= 30 ? 'LUNCH' : 'BREAK'} · {mins}m
          </Text>
        </View>
        <View style={styles.breakLine} />
      </View>
    );
  };

  // ─── Table Rows ───────────────────────────────────────────────────────────────
  const renderTableRows = () => {
    const sorted = [...periods].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const period = sorted[i];
      rows.push(renderSlotRow(period, getSlotForPeriod(period.sort_order), i));
      if (i < sorted.length - 1 && sorted[i + 1].start_time > period.end_time) {
        rows.push(renderBreakRow(period.end_time, sorted[i + 1].start_time, `break-${i}`));
      }
    }
    return rows;
  };

  const filledCount = slots.length;
  const totalCount = periods.length;
  const fillPct = totalCount > 0 ? (filledCount / totalCount) * 100 : 0;
  const isDone = fillPct === 100;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PALETTE.indigo[700]} />

      <AdminHeader
        title="Timetable"
        showBackButton
        rightAction={{ icon: 'time-outline', onPress: openManagePeriods }}
      />

      {/* ── Selectors ── */}
      <View style={styles.selectorPanel}>
        <View style={styles.selectorRow}>
          <View style={styles.selectorGroup}>
            <SectionLabel title="Class" icon="school-outline" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
              {classes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, selectedClassId === c.id && styles.activeChip]}
                  onPress={() => setSelectedClassId(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selectedClassId === c.id && styles.activeChipText]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.selectorDivider} />

          <View style={styles.selectorGroup}>
            <SectionLabel title="Section" icon="grid-outline" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
              {sections.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, selectedSectionId === s.id && styles.activeChip]}
                  onPress={() => setSelectedSectionId(s.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selectedSectionId === s.id && styles.activeChipText]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* ── Class Teacher Banner ── */}
      {classTeacherName ? (
        <View style={styles.teacherBanner}>
          <View style={styles.teacherAvatar}>
            <Ionicons name="person" size={14} color={PALETTE.emerald[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.teacherBannerName}>{classTeacherName}</Text>
            <Text style={styles.teacherBannerSub}>Class Teacher · auto-assigned to Period 1</Text>
          </View>
          <View style={styles.ctBadge}>
            <Text style={styles.ctBadgeText}>CT</Text>
          </View>
        </View>
      ) : null}

      {/* ── Progress Strip ── */}
      {classSectionId && totalCount > 0 && (
        <View style={styles.progressStrip}>
          <View style={styles.progressMeta}>
            <Text style={styles.progressLabel}>
              {filledCount === 0
                ? 'No subjects assigned yet'
                : isDone
                  ? 'Schedule complete'
                  : `${filledCount} of ${totalCount} periods filled`}
            </Text>
            <Text style={[styles.progressPct, isDone && { color: PALETTE.emerald[600] }]}>
              {Math.round(fillPct)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <AnimatedProgress pct={fillPct} isDone={isDone} />
          </View>
        </View>
      )}

      {/* ── Grid ── */}
      <ScrollView style={styles.gridContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.gridHeaderRow}>
          <Text style={[styles.gridHeader, { width: 86 }]}>Period</Text>
          <Text style={[styles.gridHeader, { flex: 1, marginLeft: 10 }]}>Subject · Teacher</Text>
        </View>

        {periodsLoading ? (
          <View style={{ paddingVertical: 56, alignItems: 'center' }}>
            <LogoLoader size={48} color={PALETTE.indigo[500]} />
            <Text style={{ marginTop: 12, fontSize: 13, color: PALETTE.slate[400] }}>Loading schedule…</Text>
          </View>
        ) : periods.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={28} color={PALETTE.indigo[400]} />
            </View>
            <Text style={styles.emptyTitle}>No periods yet</Text>
            <Text style={styles.emptySubtitle}>Add your first period below to get started</Text>
          </View>
        ) : (
          renderTableRows()
        )}

        <TouchableOpacity
          style={styles.addPeriodBtn}
          activeOpacity={0.7}
          onPress={() => { setNewPeriodName(''); setNewPeriodStart(''); setNewPeriodEnd(''); setCreatePeriodVisible(true); }}
        >
          <Ionicons name="add-circle" size={18} color={PALETTE.indigo[500]} />
          <Text style={styles.addPeriodText}>Add Period</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ════════════════════ MODAL: Assign Slot ════════════════════ */}
      <Modal transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Assign Slot</Text>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>Period {activeSlotData?.period}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={16} color={PALETTE.slate[500]} />
              </TouchableOpacity>
            </View>

            {activeSlotData?.period === 1 && (
              <View style={styles.noteCard}>
                <Ionicons name="information-circle" size={16} color={PALETTE.amber[600]} />
                <Text style={styles.noteText}>
                  Period 1 is reserved for the Class Teacher{classTeacherName ? ` (${classTeacherName})` : ''}.
                </Text>
              </View>
            )}

            <Text style={styles.modalSectionLabel}>Subject</Text>
            <ScrollView style={styles.selectList} nestedScrollEnabled>
              {subjects.map(sub => (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.selectItem, selectedSubjectId === sub.id && styles.selectItemActive]}
                  onPress={() => setSelectedSubjectId(sub.id)}
                >
                  <View style={[styles.selectRadio, selectedSubjectId === sub.id && styles.selectRadioActive]}>
                    {selectedSubjectId === sub.id && <View style={styles.selectRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectItemText, selectedSubjectId === sub.id && styles.selectItemTextActive]}>
                      {sub.name}
                    </Text>
                    {sub.code ? <Text style={styles.selectItemSub}>{sub.code}</Text> : null}
                  </View>
                  {selectedSubjectId === sub.id && (
                    <Ionicons name="checkmark-circle" size={18} color={PALETTE.indigo[500]} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalSectionLabel}>
              Teacher <Text style={styles.optionalLabel}>(optional)</Text>
            </Text>
            <ScrollView style={styles.selectList} nestedScrollEnabled>
              <TouchableOpacity
                onPress={() => setSelectedTeacherId('')}
                style={[styles.selectItem, selectedTeacherId === '' && styles.selectItemActive]}
              >
                <View style={[styles.selectRadio, selectedTeacherId === '' && styles.selectRadioActive]}>
                  {selectedTeacherId === '' && <View style={styles.selectRadioDot} />}
                </View>
                <Text style={[styles.selectItemText, selectedTeacherId === '' && styles.selectItemTextActive]}>
                  No Teacher
                </Text>
              </TouchableOpacity>
              {staff.map(st => (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.selectItem, selectedTeacherId === st.id && styles.selectItemActive]}
                  onPress={() => setSelectedTeacherId(st.id)}
                >
                  <View style={[styles.selectRadio, selectedTeacherId === st.id && styles.selectRadioActive]}>
                    {selectedTeacherId === st.id && <View style={styles.selectRadioDot} />}
                  </View>
                  <Text style={[styles.selectItemText, selectedTeacherId === st.id && styles.selectItemTextActive]}>
                    {st.display_name || st.first_name || st.staff_code}
                  </Text>
                  {selectedTeacherId === st.id && (
                    <Ionicons name="checkmark-circle" size={18} color={PALETTE.indigo[500]} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionBtnDanger} onPress={handleDeleteSlot}>
                <Ionicons name="trash-outline" size={15} color={PALETTE.red[500]} />
                <Text style={styles.actionBtnDangerText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnGhost} onPress={() => setModalVisible(false)}>
                <Text style={styles.actionBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleSaveSlot}>
                <Ionicons name="checkmark" size={15} color="#fff" />
                <Text style={styles.actionBtnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════ MODAL: Edit Single Period ════════════════════ */}
      <Modal transparent visible={editPeriodModalVisible} onRequestClose={() => setEditPeriodModalVisible(false)} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Edit Period</Text>
                {editingPeriod && (
                  <View style={styles.modalBadge}>
                    <Text style={styles.modalBadgeText}>{editingPeriod.name}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setEditPeriodModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={16} color={PALETTE.slate[500]} />
              </TouchableOpacity>
            </View>

            {editingPeriod && (
              <>
                <Text style={styles.inputLabel}>Period Name</Text>
                <AppTextInput
                  style={styles.inputField}
                  value={editingPeriod.name}
                  onChangeText={t => setEditingPeriod({ ...editingPeriod, name: t })}
                  placeholder="e.g. Period 1"
                  placeholderTextColor={PALETTE.slate[400]}
                />

                <Text style={styles.inputLabel}>Time Range <Text style={styles.inputHint}>(HH:MM:SS)</Text></Text>
                <View style={styles.timeRangeRow}>
                  <View style={[styles.timeInputWrap, { flex: 1 }]}>
                    <Ionicons name="play-outline" size={11} color={PALETTE.slate[400]} style={{ marginRight: 6 }} />
                    <AppTextInput
                      style={[ds.inputInChrome, styles.timeInput, { flex: 1 }]}
                      value={editingPeriod.start_time}
                      onChangeText={t => setEditingPeriod({ ...editingPeriod, start_time: t })}
                      placeholder="09:00:00"
                      placeholderTextColor={PALETTE.slate[400]}
                    />
                  </View>
                  <Text style={styles.timeArrow}>→</Text>
                  <View style={[styles.timeInputWrap, { flex: 1 }]}>
                    <Ionicons name="stop-outline" size={11} color={PALETTE.slate[400]} style={{ marginRight: 6 }} />
                    <AppTextInput
                      style={[ds.inputInChrome, styles.timeInput, { flex: 1 }]}
                      value={editingPeriod.end_time}
                      onChangeText={t => setEditingPeriod({ ...editingPeriod, end_time: t })}
                      placeholder="10:00:00"
                      placeholderTextColor={PALETTE.slate[400]}
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.actionBtnDanger} onPress={handleDeletePeriod}>
                    <Ionicons name="trash-outline" size={15} color={PALETTE.red[500]} />
                    <Text style={styles.actionBtnDangerText}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnGhost} onPress={() => setEditPeriodModalVisible(false)}>
                    <Text style={styles.actionBtnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleSaveSinglePeriod}>
                    <Ionicons name="checkmark" size={15} color="#fff" />
                    <Text style={styles.actionBtnPrimaryText}>Update</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════════ MODAL: Manage All Periods ════════════════════ */}
      <Modal transparent visible={managePeriodsVisible} onRequestClose={() => setManagePeriodsVisible(false)} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Manage Timings</Text>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>{editedPeriods.length} periods</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setManagePeriodsVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={16} color={PALETTE.slate[500]} />
              </TouchableOpacity>
            </View>

            {/* School Start Time Adjuster */}
            {editedPeriods.length > 0 && (
              <View style={styles.startTimeAdjuster}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="time-outline" size={14} color={PALETTE.indigo[500]} />
                  <Text style={styles.startTimeLabel}>School starts at</Text>
                </View>
                <View style={styles.stepperRow}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustStartTime(-5)}>
                    <Ionicons name="remove" size={16} color={PALETTE.indigo[600]} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{fmt(editedPeriods[0].start_time)}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustStartTime(5)}>
                    <Ionicons name="add" size={16} color={PALETTE.indigo[600]} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {editedPeriods.map((period, index) => {
                const durationMins = getMins(period.end_time) - getMins(period.start_time);
                const duration = getDurationLabel(period.start_time, period.end_time);
                const isBreak = /break|lunch/i.test(period.name);

                return (
                  <React.Fragment key={period.id}>
                    <View style={[styles.bulkPeriodRow, isBreak && styles.bulkPeriodRowBreak]}>
                      <View style={[styles.bulkPeriodNumBadge, isBreak && { backgroundColor: PALETTE.amber[500] }]}>
                        {isBreak ? (
                          <Ionicons name="cafe-outline" size={12} color="#fff" />
                        ) : (
                          <Text style={styles.bulkPeriodNum}>{index + 1}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.bulkHeaderRow}>
                          <Text style={[styles.bulkPeriodName, isBreak && { color: PALETTE.amber[700] }]}>
                            {period.name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.timeRangeLabel, isBreak && { color: PALETTE.amber[600] }]}>
                              {fmt(period.start_time)} – {fmt(period.end_time)}
                            </Text>
                            {isBreak && (
                              <TouchableOpacity onPress={() => removeBreak(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="trash-outline" size={14} color={PALETTE.red[400]} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        <View style={styles.durationStepperRow}>
                          <TouchableOpacity
                            style={[styles.stepperBtn, durationMins <= 5 && styles.stepperBtnDisabled]}
                            onPress={() => adjustDuration(index, -5)}
                            disabled={durationMins <= 5}
                          >
                            <Ionicons name="remove" size={16} color={durationMins <= 5 ? PALETTE.slate[300] : PALETTE.indigo[600]} />
                          </TouchableOpacity>

                          <View style={[styles.durationBadgeLarge, isBreak && styles.durationBadgeBreak]}>
                            <Text style={[styles.durationTextLarge, isBreak && { color: PALETTE.amber[700] }]}>
                              {duration || `${durationMins}m`}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => adjustDuration(index, 5)}
                          >
                            <Ionicons name="add" size={16} color={PALETTE.indigo[600]} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Add Break button between periods */}
                    {index < editedPeriods.length - 1 && !isBreak && !/break|lunch/i.test(editedPeriods[index + 1]?.name) && (
                      <TouchableOpacity style={styles.addBreakBtn} onPress={() => insertBreakAfter(index)}>
                        <View style={styles.addBreakLine} />
                        <View style={styles.addBreakPill}>
                          <Ionicons name="cafe-outline" size={10} color={PALETTE.amber[600]} />
                          <Text style={styles.addBreakText}>Add Break</Text>
                        </View>
                        <View style={styles.addBreakLine} />
                      </TouchableOpacity>
                    )}
                  </React.Fragment>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionBtnGhost} onPress={() => setManagePeriodsVisible(false)}>
                <Text style={styles.actionBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtnPrimary, { flex: 2 }]} onPress={handleSavePeriods}>
                <Ionicons name="save-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnPrimaryText}>Save All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════ MODAL: Create Period ════════════════════ */}
      <Modal transparent visible={createPeriodVisible} onRequestClose={() => setCreatePeriodVisible(false)} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>New Period</Text>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>#{periods.length + 1}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setCreatePeriodVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={16} color={PALETTE.slate[500]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Period Name</Text>
            <AppTextInput
              style={styles.inputField}
              value={newPeriodName}
              onChangeText={setNewPeriodName}
              placeholder={`e.g. Period ${periods.length + 1}`}
              placeholderTextColor={PALETTE.slate[400]}
            />

            <View style={styles.bulkHeaderRow}>
              <Text style={styles.inputLabel}>Time Range <Text style={styles.inputHint}>(HH:MM:SS)</Text></Text>
              {getDurationLabel(newPeriodStart, newPeriodEnd) && (
                <View style={[styles.durationBadge, { marginTop: 14 }]}>
                  <Text style={styles.durationText}>{getDurationLabel(newPeriodStart, newPeriodEnd)}</Text>
                </View>
              )}
            </View>
            <View style={styles.timeRangeRow}>
              <View style={[styles.timeInputWrap, { flex: 1 }]}>
                <Ionicons name="play-outline" size={11} color={PALETTE.slate[400]} style={{ marginRight: 6 }} />
                <AppTextInput
                  style={[ds.inputInChrome, styles.timeInput, { flex: 1 }]}
                  value={newPeriodStart}
                  onChangeText={setNewPeriodStart}
                  placeholder="14:15:00"
                  placeholderTextColor={PALETTE.slate[400]}
                />
              </View>
              <Text style={styles.timeArrow}>→</Text>
              <View style={[styles.timeInputWrap, { flex: 1 }]}>
                <Ionicons name="stop-outline" size={11} color={PALETTE.slate[400]} style={{ marginRight: 6 }} />
                <AppTextInput
                  style={[ds.inputInChrome, styles.timeInput, { flex: 1 }]}
                  value={newPeriodEnd}
                  onChangeText={setNewPeriodEnd}
                  placeholder="15:00:00"
                  placeholderTextColor={PALETTE.slate[400]}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionBtnGhost} onPress={() => setCreatePeriodVisible(false)}>
                <Text style={styles.actionBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtnPrimary, { flex: 2 }]}
                onPress={async () => {
                  if (!newPeriodName || !newPeriodStart || !newPeriodEnd) {
                    alertCompat('Missing fields', 'Please fill in name and both times');
                    return;
                  }
                  try {
                    setLoading(true);
                    const created = await TimetableService.createPeriod({
                      name: newPeriodName,
                      start_time: newPeriodStart,
                      end_time: newPeriodEnd,
                    });
                    setPeriods([...periods, created]);
                    setCreatePeriodVisible(false);
                    alertCompat('Created', `"${created.name}" added to schedule`);
                  } catch (error: any) {
                    alertCompat('Error', error.response?.data?.error || 'Failed to create period');
                  } finally { setLoading(false); }
                }}
              >
                <Ionicons name="add-circle-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnPrimaryText}>Create Period</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },

    // Selector Panel
    selectorPanel: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: isDark ? PALETTE.slate[800] : '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
        android: { elevation: 3 },
      }),
    },
    selectorRow: {
      flexDirection: 'row',
    },
    selectorGroup: {
      flex: 1,
    },
    selectorDivider: {
      width: 1,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
      marginHorizontal: 12,
      marginVertical: 2,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginRight: 6,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[600] : PALETTE.slate[200],
    },
    activeChip: {
      backgroundColor: PALETTE.indigo[600],
      borderColor: PALETTE.indigo[600],
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? PALETTE.slate[300] : PALETTE.slate[600],
    },
    activeChipText: { color: '#ffffff' },

    // Teacher Banner
    teacherBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 12,
      marginTop: 10,
      padding: 11,
      borderRadius: 10,
      backgroundColor: PALETTE.emerald[50],
      borderWidth: 1,
      borderColor: PALETTE.emerald[100],
    },
    teacherAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: PALETTE.emerald[100],
      alignItems: 'center',
      justifyContent: 'center',
    },
    teacherBannerName: {
      fontSize: 13,
      fontWeight: '700',
      color: PALETTE.emerald[700],
    },
    teacherBannerSub: {
      fontSize: 11,
      color: PALETTE.emerald[600],
      marginTop: 1,
    },
    ctBadge: {
      backgroundColor: PALETTE.emerald[600],
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    ctBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.5,
    },

    // Progress Strip
    progressStrip: {
      marginHorizontal: 12,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: isDark ? PALETTE.slate[800] : '#ffffff',
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[700] : PALETTE.slate[200],
    },
    progressMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressLabel: {
      fontSize: 12,
      color: isDark ? PALETTE.slate[400] : PALETTE.slate[500],
      fontWeight: '500',
    },
    progressPct: {
      fontSize: 13,
      color: PALETTE.indigo[500],
      fontWeight: '800',
    },
    progressTrack: {
      height: 6,
      borderRadius: 99,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
      overflow: 'hidden',
    },

    // Grid
    gridContainer: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 12,
    },
    gridHeaderRow: {
      flexDirection: 'row',
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    gridHeader: {
      fontSize: 10,
      fontWeight: '800',
      color: PALETTE.slate[400],
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },

    // Row Card
    rowCard: {
      flexDirection: 'row',
      marginBottom: 7,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: isDark ? PALETTE.slate[800] : '#ffffff',
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[700] : PALETTE.slate[200],
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
        android: { elevation: 1 },
      }),
    },
    rowAccent: {
      width: 3,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.slate[200],
    },
    rowAccentFilled: {
      backgroundColor: PALETTE.indigo[500],
    },

    // Period column
    periodCell: {
      width: 80,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 6,
      gap: 3,
      backgroundColor: isDark ? '#1a2035' : PALETTE.indigo[50],
      borderRightWidth: 1,
      borderRightColor: isDark ? PALETTE.slate[700] : PALETTE.indigo[100],
    },
    periodBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: isDark ? PALETTE.slate[600] : PALETTE.slate[300],
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    periodBadgeFilled: {
      backgroundColor: PALETTE.indigo[500],
    },
    periodBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#ffffff',
    },
    periodTime: {
      fontSize: 10,
      fontWeight: '600',
      color: isDark ? PALETTE.indigo[300] : PALETTE.indigo[600],
      textAlign: 'center',
    },
    periodTimeDivider: {
      width: 16,
      height: 1,
      backgroundColor: isDark ? PALETTE.slate[600] : PALETTE.indigo[200],
      marginVertical: 1,
    },

    // Slot column
    slotCell: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    slotFilledContent: {
      flex: 1,
      gap: 3,
    },
    slotSubjectText: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? PALETTE.slate[100] : PALETTE.slate[800],
      letterSpacing: -0.2,
    },
    teacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    slotTeacherText: {
      fontSize: 12,
      color: isDark ? PALETTE.slate[400] : PALETTE.slate[500],
      fontWeight: '500',
    },
    slotTeacherEmpty: {
      color: PALETTE.slate[300],
      fontStyle: 'italic',
    },
    slotEmptyContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    addIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: PALETTE.indigo[50],
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: PALETTE.indigo[200],
      borderStyle: 'dashed',
    },
    slotEmptyText: {
      fontSize: 13,
      color: PALETTE.slate[400],
      fontWeight: '500',
    },

    // Break Row
    breakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 2,
      marginBottom: 9,
      paddingHorizontal: 4,
    },
    breakLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.amber[200],
    },
    breakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 99,
      backgroundColor: isDark ? PALETTE.slate[800] : PALETTE.amber[50],
      borderWidth: 1,
      borderColor: PALETTE.amber[200],
      marginHorizontal: 10,
    },
    breakLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: PALETTE.amber[600],
      letterSpacing: 0.8,
    },

    // Empty State
    emptyState: {
      alignItems: 'center',
      paddingVertical: 52,
    },
    emptyIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: PALETTE.indigo[50],
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? PALETTE.slate[200] : PALETTE.slate[700],
      marginBottom: 5,
    },
    emptySubtitle: {
      fontSize: 13,
      color: PALETTE.slate[400],
      textAlign: 'center',
    },

    // Add Period Button
    addPeriodBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      marginTop: 6,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: isDark ? PALETTE.slate[600] : PALETTE.indigo[200],
      borderStyle: 'dashed',
      backgroundColor: isDark ? PALETTE.slate[800] : PALETTE.indigo[50],
    },
    addPeriodText: {
      fontSize: 14,
      fontWeight: '700',
      color: PALETTE.indigo[600],
    },

    // Modal Base
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(10,14,30,0.55)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: isDark ? PALETTE.slate[800] : '#ffffff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 20,
      maxHeight: '85%',
    },
    modalCard: {
      backgroundColor: isDark ? PALETTE.slate[800] : '#ffffff',
      borderRadius: 20,
      padding: 20,
      margin: 16,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 99,
      backgroundColor: isDark ? PALETTE.slate[600] : PALETTE.slate[200],
      alignSelf: 'center',
      marginBottom: 18,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: isDark ? PALETTE.slate[100] : PALETTE.slate[800],
      letterSpacing: -0.3,
    },
    modalBadge: {
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.indigo[50],
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[600] : PALETTE.indigo[100],
    },
    modalBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: PALETTE.indigo[600],
    },
    modalCloseBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: PALETTE.slate[400],
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
      marginTop: 10,
    },
    optionalLabel: {
      fontWeight: '400',
      color: PALETTE.slate[400],
      textTransform: 'none',
      letterSpacing: 0,
      fontSize: 11,
    },

    // Select List
    selectList: {
      height: 145,
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[600] : PALETTE.slate[200],
      borderRadius: 10,
      marginBottom: 4,
      backgroundColor: isDark ? PALETTE.slate[900] : PALETTE.slate[50],
    },
    selectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      paddingVertical: 11,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
    },
    selectItemActive: {
      backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : PALETTE.indigo[50],
    },
    selectRadio: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: isDark ? PALETTE.slate[500] : PALETTE.slate[300],
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectRadioActive: {
      borderColor: PALETTE.indigo[500],
    },
    selectRadioDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: PALETTE.indigo[500],
    },
    selectItemText: {
      fontSize: 14,
      color: isDark ? PALETTE.slate[300] : PALETTE.slate[700],
      flex: 1,
    },
    selectItemTextActive: {
      color: PALETTE.indigo[600],
      fontWeight: '600',
    },
    selectItemSub: {
      fontSize: 11,
      color: PALETTE.slate[400],
      marginTop: 1,
    },

    // Note Card
    noteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: PALETTE.amber[50],
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: PALETTE.amber[400],
      borderWidth: 1,
      borderColor: PALETTE.amber[200],
    },
    noteText: {
      flex: 1,
      fontSize: 12,
      color: PALETTE.amber[800],
      lineHeight: 18,
    },

    // Input
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? PALETTE.slate[300] : PALETTE.slate[600],
      marginBottom: 6,
      marginTop: 14,
    },
    inputHint: {
      fontWeight: '400',
      color: PALETTE.slate[400],
    },
    inputField: {
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[600] : '#CBD5E1',
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      color: isDark ? PALETTE.slate[100] : PALETTE.slate[800],
      backgroundColor: isDark ? PALETTE.slate[700] : '#FFFFFF',
    },
    timeRangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timeInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[600] : '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      backgroundColor: isDark ? PALETTE.slate[700] : '#FFFFFF',
    },
    timeInput: {
      fontSize: 13,
      color: isDark ? PALETTE.slate[100] : PALETTE.slate[800],
      padding: 0,
    },
    timeArrow: {
      fontSize: 14,
      color: PALETTE.slate[400],
      fontWeight: '700',
      marginHorizontal: 8,
    },

    // Bulk Period Edit
    bulkPeriodRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 14,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
    },
    bulkPeriodNumBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: PALETTE.indigo[500],
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    bulkPeriodNum: {
      fontSize: 11,
      fontWeight: '800',
      color: '#ffffff',
    },
    bulkPeriodName: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? PALETTE.slate[200] : PALETTE.slate[700],
      marginBottom: 8,
    },
    bulkPeriodRowBreak: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.05)' : PALETTE.amber[50],
      borderBottomColor: isDark ? PALETTE.amber[900] : PALETTE.amber[100],
    },
    bulkHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    durationBadge: {
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    durationBadgeBreak: {
      backgroundColor: isDark ? PALETTE.amber[900] : PALETTE.amber[100],
    },
    durationText: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? PALETTE.slate[400] : PALETTE.slate[500],
    },
    timeInputOverlap: {
      borderColor: PALETTE.red[400],
      backgroundColor: isDark ? 'rgba(239,68,68,0.05)' : PALETTE.red[50],
    },
    overlapWarning: {
      fontSize: 10,
      color: PALETTE.red[500],
      marginTop: 4,
      fontWeight: '600',
    },

    // Start Time Adjuster
    startTimeAdjuster: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.indigo[50],
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[600] : PALETTE.indigo[100],
    },
    startTimeLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? PALETTE.slate[300] : PALETTE.slate[600],
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    stepperBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? PALETTE.slate[600] : '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[500] : PALETTE.slate[200],
    },
    stepperBtnDisabled: {
      opacity: 0.4,
    },
    stepperValue: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? PALETTE.slate[100] : PALETTE.indigo[700],
      minWidth: 70,
      textAlign: 'center',
    },
    timeRangeLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: isDark ? PALETTE.slate[400] : PALETTE.slate[500],
    },
    durationStepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    durationBadgeLarge: {
      flex: 1,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    durationTextLarge: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? PALETTE.slate[200] : PALETTE.indigo[600],
    },

    // Add Break Button (inline)
    addBreakBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      marginTop: -6,
      paddingHorizontal: 4,
    },
    addBreakLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.amber[200],
    },
    addBreakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 99,
      backgroundColor: isDark ? PALETTE.slate[800] : PALETTE.amber[50],
      borderWidth: 1,
      borderColor: isDark ? PALETTE.amber[800] : PALETTE.amber[200],
    },
    addBreakText: {
      fontSize: 10,
      fontWeight: '700',
      color: PALETTE.amber[600],
    },


    // Action Buttons
    modalActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 20,
    },
    actionBtnPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: PALETTE.indigo[600],
      borderRadius: 10,
      paddingVertical: 13,
    },
    actionBtnPrimaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#ffffff',
    },
    actionBtnGhost: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 13,
      backgroundColor: isDark ? PALETTE.slate[700] : PALETTE.slate[100],
      borderWidth: 1,
      borderColor: isDark ? PALETTE.slate[600] : PALETTE.slate[200],
    },
    actionBtnGhostText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? PALETTE.slate[300] : PALETTE.slate[600],
    },
    actionBtnDanger: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: 10,
      paddingVertical: 13,
      backgroundColor: PALETTE.red[50],
      borderWidth: 1,
      borderColor: PALETTE.red[100],
    },
    actionBtnDangerText: {
      fontSize: 14,
      fontWeight: '600',
      color: PALETTE.red[500],
    },
  });