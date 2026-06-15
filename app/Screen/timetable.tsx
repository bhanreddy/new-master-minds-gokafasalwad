import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  TimetableService,
  TimetableSlot,
  DayOfWeek,
  TIMETABLE_DAYS,
  TIMETABLE_DAY_LABELS,
} from '../../src/services/timetableService';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import LogoLoader from '../../src/components/LogoLoader';
// Spacing should be imported from standard react native or theme if custom
// But this code actually uses standard integers or a local Spacing object. If it doesn't exist, we will define it.
const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const Radii = { sm: 4, md: 8, lg: 12, xl: 16, pill: 999 };
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const PERIOD_TIMES: Record<number, {
  start: string;
  end: string;
}> = {
  1: { start: '09:00 AM', end: '09:50 AM' },
  2: { start: '09:50 AM', end: '10:40 AM' },
  3: { start: '10:40 AM', end: '11:10 AM' },
  4: { start: '11:10 AM', end: '12:00 PM' },
  5: { start: '12:00 PM', end: '12:50 PM' },
  6: { start: '01:30 PM', end: '02:20 PM' },
  7: { start: '02:20 AM', end: '03:10 PM' },
  8: { start: '03:10 AM', end: '04:00 PM' }
};
export default function TimetableScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const idx = new Date().getDay(); // 0=Sun..6=Sat
    return idx >= 1 && idx <= 6 ? TIMETABLE_DAYS[idx - 1] : 'monday';
  });
  const router = useRouter();
  useEffect(() => {
    fetchTimetable();
  }, []);

  // Per-day school if slots span more than one weekday.
  const isPerDay = React.useMemo(() => {
    const days = new Set(slots.map((s) => s.day_of_week).filter(Boolean));
    return days.size > 1;
  }, [slots]);

  const visibleSlots = React.useMemo(() => {
    if (!isPerDay) return slots;
    return slots.filter((s) => (s.day_of_week || 'monday') === selectedDay);
  }, [slots, isPerDay, selectedDay]);
  const fetchTimetable = async () => {
    try {
      const data = await TimetableService.getTeacherTimetable();
      // Filter mapping over without day filter, just sort by period
      const todaySlots = data.sort((a, b) => a.period_number - b.period_number);
      setSlots(todaySlots);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const renderDaySchedule = () => {
    // For simplicity, let's assume we're displaying today's timetable or a generic one.
    // In a real app, you'd filter `slots` by the selected day.
    // For this change, we'll just display all available slots grouped by period.
    // If the API returns slots for multiple days, this will show all of them,
    // but the instruction implies removing day dependencies, so we'll just list periods.
    // The original code was filtering by day, so we need to decide how to handle this.
    // Given the instruction "Remove day dependencies and grouping", we'll just iterate through periods
    // and find any slot matching that period number, effectively showing a "merged" timetable
    // or assuming the `slots` array already contains only the relevant day's slots.
    // Let's assume `slots` contains the timetable for a single day (e.g., today).

    return (
      <View style={styles.timetableContainer}>
        {PERIODS.map((periodNum) => {
          const slot = visibleSlots.find((s) => s.period_number === periodNum); // Slot for this period on the selected day
          return (
            <View key={`period-${periodNum}`} style={styles.periodCard as any}>
              <View style={styles.timeColumn}>
                <Text style={styles.periodNumber}>P{periodNum}</Text>
                <Text style={styles.timeText}>{PERIOD_TIMES[periodNum as keyof typeof PERIOD_TIMES].start}</Text>
                <Text style={styles.timeText}>{PERIOD_TIMES[periodNum as keyof typeof PERIOD_TIMES].end}</Text>
              </View>
              <View style={[styles.slotContent, !slot && styles.emptySlot]}>
                {slot ?
                  <>
                    <Text style={styles.subjectText}>{slot.subject_name}</Text>
                    <Text style={styles.teacherText}>{slot.teacher_name}</Text>
                    {slot.room_no && <Text style={styles.roomText}>Room: {slot.room_no}</Text>}
                  </> :

                  <Text style={styles.noClassText}>Free Period</Text>
                }
              </View>
            </View>);

        })}
      </View>);

  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>

          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Timetable</Text>
      </View>

      {isPerDay && !loading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayTabs}
          contentContainerStyle={{ paddingHorizontal: Spacing.md }}
        >
          {TIMETABLE_DAYS.map((d) => {
            const activeDay = selectedDay === d;
            return (
              <Text
                key={d}
                onPress={() => setSelectedDay(d)}
                style={[
                  styles.dayTab,
                  {
                    backgroundColor: activeDay ? theme.colors.primary : theme.colors.card,
                    color: activeDay ? '#FFFFFF' : theme.colors.primary,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                {TIMETABLE_DAY_LABELS[d]}
              </Text>
            );
          })}
        </ScrollView>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>

        {loading ?
          <LogoLoader size={60} color={theme.colors.primary} style={styles.loader} /> :
          slots.length === 0 ?
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No timetable found</Text>
            </View> :

            <View style={styles.timetableContainer}>
              {renderDaySchedule()}
            </View>
        }
      </ScrollView>
    </View>);

}
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  backButton: {
    marginRight: Spacing.md
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  dayTabs: {
    flexGrow: 0,
    paddingVertical: Spacing.sm,
  },
  dayTab: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.md,
    marginHorizontal: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2
  },
  loader: {
    marginTop: Spacing.xl
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl * 2
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: theme.colors.textSecondary
  },
  timetableContainer: {
    marginTop: Spacing.md
  },
  periodCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden'
  },
  timeColumn: {
    width: 80,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border
  },
  periodNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4
  },
  timeText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    textAlign: 'center'
  },
  slotContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'center'
  },
  emptySlot: {
    backgroundColor: isDark ? '#1F2937' : '#F9FAFB'
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4
  },
  teacherText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2
  },
  roomText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600'
  },
  noClassText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic'
  }
});