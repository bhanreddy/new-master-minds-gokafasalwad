import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Modal,
  Switch,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import AdminHeader from '../../src/components/AdminHeader';
import AppTextInput from '../../src/components/AppTextInput';
import AppDatePicker from '../../src/components/AppDatePicker';
import LogoLoader from '../../src/components/LogoLoader';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import { t_field } from '../../src/utils/lang';
import { ClassService, ClassInfo, AcademicYear, ClassSection } from '../../src/services/classService';
import { ResultService } from '../../src/services/commonServices';
import { SchoolSettings, SchoolSettingsService } from '../../src/services/schoolSettingsService';
import { EXAM_CATEGORIES, ExamCategory, examCategoryFor } from '../../src/constants/examCategories';
import {
  ExamTimetableService,
  ExamAllocationService,
  ExamListItem,
  ExamPaper,
  ExamTimetableDetail,
  ExamGenerateParams,
  ExamScheduleMode,
  ExamSession,
  ClassSubjectOption,
  ExamRoom,
  ExamRoomAllocation,
  ExamAllocationParams,
  ExamSeatStudent,
  SeatingStrategy,
} from '../../src/services/examService';
import { TimetableService, TimetableTeacher } from '../../src/services/timetableService';
import { downloadHallTicketPdf } from '../../src/utils/hallTicketPdf';
import { SCHOOL_CONFIG } from '../../src/constants/schoolConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Two-stop gradient per exam category for icon tiles & hero accents. */
const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  slip_test: ['#1D4ED8', '#3B82F6'],
  fa_results: ['#047857', '#10B981'],
  sa_results: ['#B45309', '#F59E0B'],
  special: ['#6D28D9', '#8B5CF6'],
  weekend: ['#BE185D', '#EC4899'],
};
function categoryGradient(examType: string, fallback: string): [string, string] {
  return CATEGORY_GRADIENTS[examType] || [fallback, fallback];
}

function hallTicketSchoolSettings(settings: SchoolSettings | null): Partial<SchoolSettings> {
  const configuredName = settings?.school_name?.trim() || '';
  const hasPlaceholderName =
    !configuredName ||
    /^(default\s+school\s+name|school|school\s+name)$/i.test(configuredName);

  return {
    ...settings,
    school_name: hasPlaceholderName ? SCHOOL_CONFIG.name : configuredName,
    school_address: settings?.school_address?.trim() || SCHOOL_CONFIG.address,
    school_phone: settings?.school_phone?.trim() || SCHOOL_CONFIG.contact,
    school_email: settings?.school_email?.trim() || SCHOOL_CONFIG.email,
    school_website: settings?.school_website?.trim() || SCHOOL_CONFIG.website,
    school_tagline: settings?.school_tagline?.trim() || SCHOOL_CONFIG.tagline,
  };
}

/** Subject glyph + stable color, matching the student timetable's language. */
const SUBJECT_GLYPHS: [string, string][] = [
  ['math', 'calculator-outline'],
  ['physic', 'flask-outline'],
  ['chem', 'beaker-outline'],
  ['bio', 'leaf-outline'],
  ['english', 'book-outline'],
  ['hindi', 'document-text-outline'],
  ['telugu', 'language-outline'],
  ['social', 'earth-outline'],
  ['history', 'time-outline'],
  ['geo', 'globe-outline'],
  ['science', 'flask-outline'],
  ['computer', 'desktop-outline'],
];
function subjectIcon(name: string): any {
  const lower = (name || '').toLowerCase();
  for (const [key, icon] of SUBJECT_GLYPHS) {
    if (lower.includes(key)) return icon;
  }
  return 'book-outline';
}
const SUBJECT_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6'];
function subjectColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

function fmtTime(time?: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function fmtDate(date?: string | null): string {
  if (!date) return 'Unscheduled';
  // Tolerate both "YYYY-MM-DD" and full ISO timestamps from the API.
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'Unscheduled';
  return d.toLocaleDateString('default', { weekday: 'short', day: '2-digit', month: 'short' });
}

const TIME_INPUT_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** "09:30:00" → "09:30" for editable inputs. */
function toHHMM(time?: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

interface DateGroup {
  date: string | null;
  papers: ExamPaper[];
}

function groupPapersByDate(papers: ExamPaper[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  for (const p of papers) {
    const key = p.exam_date || 'none';
    let g = map.get(key);
    if (!g) {
      g = { date: p.exam_date, papers: [] };
      map.set(key, g);
    }
    g.papers.push(p);
  }
  return [...map.values()].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : 1;
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminExams() {
  useTranslation();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  // shared data
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);

  // list view
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hallTicketExam, setHallTicketExam] = useState<ExamListItem | null>(null);
  const [signatureVisible, setSignatureVisible] = useState(false);

  // detail view
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExamTimetableDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // seating & invigilation
  const [allocations, setAllocations] = useState<ExamRoomAllocation[]>([]);
  const [allocParams, setAllocParams] = useState<ExamAllocationParams | null>(null);

  // modals
  const [createVisible, setCreateVisible] = useState(false);
  const [genVisible, setGenVisible] = useState(false);
  const [editPaper, setEditPaper] = useState<ExamPaper | null>(null);
  const [roomsVisible, setRoomsVisible] = useState(false);
  const [allocVisible, setAllocVisible] = useState(false);
  const [roomDetail, setRoomDetail] = useState<ExamRoomAllocation | null>(null);
  const [addRoomSitting, setAddRoomSitting] = useState<{ exam_date: string; session_start: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      const [examData, yearData, classData] = await Promise.all([
        ResultService.getExams(),
        ClassService.getCurrentAcademicYear(),
        ClassService.getClasses(),
      ]);
      setExams(examData as ExamListItem[]);
      setCurrentYear(yearData);
      setClasses(classData);
    } catch {
      alertCompat('Error', 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const openDetail = useCallback(async (examId: string) => {
    setSelectedExamId(examId);
    setDetailLoading(true);
    try {
      const [data, allocData] = await Promise.all([
        ExamTimetableService.getTimetable(examId),
        ExamAllocationService.getAllocations(examId).catch(() => null),
      ]);
      setDetail(data);
      setAllocations(allocData?.allocations || []);
      setAllocParams(allocData?.allocation_params || null);
    } catch {
      alertCompat('Error', 'Failed to load exam timetable');
      setSelectedExamId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshDetail = useCallback(async () => {
    if (!selectedExamId) return;
    try {
      const [data, allocData] = await Promise.all([
        ExamTimetableService.getTimetable(selectedExamId),
        ExamAllocationService.getAllocations(selectedExamId).catch(() => null),
      ]);
      setDetail(data);
      setAllocations(allocData?.allocations || []);
      setAllocParams(allocData?.allocation_params || null);
    } catch {
      // keep the stale view; the next action will surface the error
    }
  }, [selectedExamId]);

  const closeDetail = useCallback(() => {
    setSelectedExamId(null);
    setDetail(null);
    setAllocations([]);
    setAllocParams(null);
    loadExams();
  }, [loadExams]);

  const handlePublishToggle = useCallback(() => {
    if (!detail) return;
    const publishing = !detail.exam.timetable_published;
    const doIt = async () => {
      try {
        setSaving(true);
        await ExamTimetableService.setPublished(detail.exam.id, publishing);
        await refreshDetail();
        alertCompat(
          publishing ? 'Published' : 'Unpublished',
          publishing
            ? 'The exam timetable is now visible to students and teachers.'
            : 'The exam timetable is now hidden from students and teachers.'
        );
      } catch (err: any) {
        alertCompat('Error', err?.message || 'Failed to update publish state');
      } finally {
        setSaving(false);
      }
    };
    if (publishing) {
      const hasSeating = allocations.length > 0;
      alertCompat(
        'Publish timetable?',
        hasSeating
          ? 'Students and teachers will immediately see this exam schedule, seating and invigilators.'
          : 'Students and teachers will see the schedule. Seating isn’t allocated yet — you can still auto-seat afterwards.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Publish', onPress: doIt },
        ]
      );
    } else {
      doIt();
    }
  }, [detail, refreshDetail, allocations.length]);

  /** One-click seating: reuse last params, or all rooms + all staff. */
  const handleQuickAllocate = useCallback(async () => {
    if (!detail) return;

    const run = async () => {
      try {
        setSaving(true);
        let params = allocParams;
        if (!params?.room_ids?.length) {
          const [rooms, teachers] = await Promise.all([
            ExamAllocationService.getRooms(),
            TimetableService.getTeacherOptions().catch(() => [] as TimetableTeacher[]),
          ]);
          if (rooms.length === 0) {
            alertCompat(
              'Add rooms first',
              'Define at least one exam room, then seating can be allocated automatically.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Manage rooms', onPress: () => setRoomsVisible(true) },
              ]
            );
            return;
          }
          params = {
            room_ids: rooms.map((r) => r.id),
            strategy: 'sequential',
            invigilator_staff_ids: teachers.map((t) => t.id),
          };
        }
        const result = await ExamAllocationService.generate(detail.exam.id, params);
        await refreshDetail();
        const lines = [
          `${result.students_seated} student(s) seated across ${result.sittings} sitting(s).`,
          ...(result.warnings || []),
        ];
        alertCompat('Seating ready', lines.join('\n'));
      } catch (err: any) {
        alertCompat('Could not allocate', err?.message || 'Allocation failed');
      } finally {
        setSaving(false);
      }
    };

    if (allocations.length > 0) {
      alertCompat(
        'Reallocate seating?',
        'Current room and invigilator assignments will be replaced.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reallocate', onPress: () => { void run(); } },
        ]
      );
    } else {
      await run();
    }
  }, [detail, allocParams, refreshDetail, allocations.length]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminHeader title={selectedExamId ? 'Exam Timetable' : 'Exams'} showBackButton />

      {selectedExamId ? (
        detailLoading || !detail ? (
          <LogoLoader />
        ) : (
          <ExamDetailView
            styles={styles}
            theme={theme}
            detail={detail}
            allocations={allocations}
            saving={saving}
            onBack={closeDetail}
            onGenerate={() => setGenVisible(true)}
            onEditPaper={setEditPaper}
            onPublishToggle={handlePublishToggle}
            onQuickAllocate={handleQuickAllocate}
            onCustomizeAllocate={() => setAllocVisible(true)}
            onManageRooms={() => setRoomsVisible(true)}
            onOpenRoom={setRoomDetail}
            onAddRoomToSitting={setAddRoomSitting}
            onHallTickets={() => setHallTicketExam(detail.exam)}
          />
        )
      ) : loading ? (
        <LogoLoader />
      ) : (
        <ExamListView
          styles={styles}
          theme={theme}
          exams={exams}
          onOpen={openDetail}
          onHallTickets={setHallTicketExam}
          onCreate={() => setCreateVisible(true)}
          onManageSignature={() => setSignatureVisible(true)}
        />
      )}

      {hallTicketExam && (
        <HallTicketModal
          exam={hallTicketExam}
          styles={styles}
          theme={theme}
          onClose={() => setHallTicketExam(null)}
        />
      )}

      <PrincipalSignatureModal
        visible={signatureVisible}
        styles={styles}
        theme={theme}
        onClose={() => setSignatureVisible(false)}
      />

      <CreateExamModal
        visible={createVisible}
        styles={styles}
        theme={theme}
        currentYear={currentYear}
        existingNames={exams.map((e) => `${e.exam_type}|${e.name}`)}
        onClose={() => setCreateVisible(false)}
        onCreated={(examId) => {
          setCreateVisible(false);
          loadExams();
          openDetail(examId);
        }}
      />

      {detail && (
        <GenerateModal
          visible={genVisible}
          styles={styles}
          theme={theme}
          isDark={isDark}
          classes={classes}
          academicYearId={detail.exam.academic_year_id}
          initialParams={detail.exam.timetable_params || null}
          hasExistingPapers={detail.papers.length > 0}
          onClose={() => setGenVisible(false)}
          onSubmit={async (params) => {
            try {
              setSaving(true);
              const result = await ExamTimetableService.generate(detail.exam.id, params);
              setGenVisible(false);
              await refreshDetail();
              const summary = [`${result.inserted} paper(s) scheduled.`, ...(result.warnings || [])].join('\n');
              // Offer one-tap seating so admins don't hunt for a second wizard.
              try {
                const rooms = await ExamAllocationService.getRooms();
                if (rooms.length > 0) {
                  alertCompat('Timetable ready', `${summary}\n\nSeat students automatically?`, [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Auto-seat', onPress: () => { void handleQuickAllocate(); } },
                  ]);
                } else {
                  alertCompat('Timetable ready', summary);
                }
              } catch {
                alertCompat('Timetable ready', summary);
              }
            } catch (err: any) {
              alertCompat('Could not generate', err?.message || 'Generation failed');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {editPaper && (
        <EditPaperModal
          paper={editPaper}
          styles={styles}
          theme={theme}
          isDark={isDark}
          onClose={() => setEditPaper(null)}
          onSaved={async () => {
            setEditPaper(null);
            await refreshDetail();
          }}
        />
      )}

      {/* Standalone rooms manager (from the detail view). While the allocation
          wizard is open, the wizard renders its own NESTED rooms modal instead —
          two sibling RN modals would stack in mount order and hide this one. */}
      {!allocVisible && (
        <RoomsModal
          visible={roomsVisible}
          styles={styles}
          theme={theme}
          onClose={() => setRoomsVisible(false)}
        />
      )}

      {detail && (
        <AllocateModal
          visible={allocVisible}
          styles={styles}
          theme={theme}
          initialParams={allocParams}
          hasExisting={allocations.length > 0}
          roomsVisible={roomsVisible}
          onManageRooms={() => setRoomsVisible(true)}
          onCloseRooms={() => setRoomsVisible(false)}
          onClose={() => setAllocVisible(false)}
          onSubmit={async (params) => {
            try {
              setSaving(true);
              const result = await ExamAllocationService.generate(detail.exam.id, params);
              setAllocVisible(false);
              await refreshDetail();
              const lines = [
                `${result.students_seated} student(s) seated across ${result.sittings} sitting(s).`,
                ...(result.warnings || []),
              ];
              alertCompat('Seating allocated', lines.join('\n'));
            } catch (err: any) {
              alertCompat('Could not allocate', err?.message || 'Allocation failed');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {roomDetail && (
        <RoomDetailModal
          allocation={roomDetail}
          siblingRooms={allocations.filter(
            (a) =>
              a.id !== roomDetail.id &&
              a.exam_date === roomDetail.exam_date &&
              a.session_start === roomDetail.session_start
          )}
          styles={styles}
          theme={theme}
          onClose={() => setRoomDetail(null)}
          onChanged={refreshDetail}
        />
      )}

      {detail && addRoomSitting && (
        <AddRoomToSittingModal
          sitting={addRoomSitting}
          usedRoomIds={allocations
            .filter(
              (a) =>
                a.exam_date === addRoomSitting.exam_date &&
                a.session_start === addRoomSitting.session_start
            )
            .map((a) => a.room_id)}
          styles={styles}
          theme={theme}
          onClose={() => setAddRoomSitting(null)}
          onPick={async (roomId) => {
            try {
              setSaving(true);
              await ExamAllocationService.addToSitting(detail.exam.id, {
                exam_date: addRoomSitting.exam_date,
                session_start: addRoomSitting.session_start,
                room_id: roomId,
              });
              setAddRoomSitting(null);
              await refreshDetail();
            } catch (err: any) {
              alertCompat('Could not add room', err?.message || 'Add failed');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </View>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

type ExamFilter = 'all' | 'live' | 'draft' | 'setup';

function examNeedsSetup(exam: ExamListItem): boolean {
  return !exam.timetable_published && (exam.papers_count || 0) === 0;
}

function examIsDraft(exam: ExamListItem): boolean {
  return !exam.timetable_published && (exam.papers_count || 0) > 0;
}

const ExamCard = React.memo(function ExamCard({
  exam,
  styles,
  theme,
  onPress,
  onHallTickets,
}: {
  exam: ExamListItem;
  styles: Styles;
  theme: Theme;
  onPress: (id: string) => void;
  onHallTickets: (exam: ExamListItem) => void;
}) {
  const category = examCategoryFor(exam.exam_type);
  const gradient = categoryGradient(exam.exam_type, category.color);
  const live = !!exam.timetable_published;
  const hasPapers = (exam.papers_count || 0) > 0;
  const nextHint = live
    ? null
    : !hasPapers
      ? 'Generate timetable'
      : 'Finish & publish';

  return (
    <TouchableOpacity style={styles.examCard} activeOpacity={0.72} onPress={() => onPress(exam.id)}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.examCardIconGradient}
      >
        <Ionicons name={category.icon} size={20} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.examCardBody}>
        <View style={styles.examCardTitleRow}>
          <Text style={styles.examCardTitle} numberOfLines={1}>
            {t_field(exam.name, exam.name_te)}
          </Text>
          {live ? (
            <View style={[styles.statusPill, { backgroundColor: `${theme.colors.success}14` }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.colors.success }]} />
              <Text style={[styles.statusPillText, { color: theme.colors.success }]}>Live</Text>
            </View>
          ) : hasPapers ? (
            <View style={[styles.statusPill, { backgroundColor: `${theme.colors.warning}16` }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.colors.warning }]} />
              <Text style={[styles.statusPillText, { color: theme.colors.warning }]}>Draft</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, { backgroundColor: theme.colors.borderLight }]}>
              <Text style={[styles.statusPillText, { color: theme.colors.textTertiary }]}>Setup</Text>
            </View>
          )}
        </View>
        <Text style={styles.examCardSub} numberOfLines={1}>
          {category.title}
          {exam.start_date ? ` · ${fmtDate(exam.start_date)} – ${fmtDate(exam.end_date)}` : ' · Not scheduled'}
          {hasPapers ? ` · ${exam.papers_count} papers` : ''}
        </Text>
        {nextHint && (
          <Text style={styles.examCardHint} numberOfLines={1}>
            Next: {nextHint}
          </Text>
        )}
      </View>
      {live && hasPapers && (
        <TouchableOpacity
          style={styles.hallTicketIconBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Download hall tickets for ${exam.name}`}
          onPress={(e) => {
            (e as any)?.stopPropagation?.();
            onHallTickets(exam);
          }}
        >
          <Ionicons name="download-outline" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
    </TouchableOpacity>
  );
});

function ExamListView({
  styles,
  theme,
  exams,
  onOpen,
  onHallTickets,
  onCreate,
  onManageSignature,
}: {
  styles: Styles;
  theme: Theme;
  exams: ExamListItem[];
  onOpen: (id: string) => void;
  onHallTickets: (exam: ExamListItem) => void;
  onCreate: () => void;
  onManageSignature: () => void;
}) {
  const [filter, setFilter] = useState<ExamFilter>('all');

  const counts = useMemo(
    () => ({
      all: exams.length,
      live: exams.filter((e) => e.timetable_published).length,
      draft: exams.filter(examIsDraft).length,
      setup: exams.filter(examNeedsSetup).length,
    }),
    [exams]
  );

  const filtered = useMemo(() => {
    if (filter === 'live') return exams.filter((e) => e.timetable_published);
    if (filter === 'draft') return exams.filter(examIsDraft);
    if (filter === 'setup') return exams.filter(examNeedsSetup);
    return exams;
  }, [exams, filter]);

  const filters: { key: ExamFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'live', label: 'Live', count: counts.live },
    { key: 'draft', label: 'Drafts', count: counts.draft },
    { key: 'setup', label: 'Setup', count: counts.setup },
  ];

  const renderItem = useCallback(
    ({ item, index }: { item: ExamListItem; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(280)}>
        <ExamCard
          exam={item}
          styles={styles}
          theme={theme}
          onPress={onOpen}
          onHallTickets={onHallTickets}
        />
      </Animated.View>
    ),
    [styles, theme, onOpen, onHallTickets]
  );

  return (
    <View style={styles.flex}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Animated.View entering={FadeIn.duration(280)} style={styles.listHeader}>
              <View style={styles.listHeaderTop}>
                <View>
                  <Text style={styles.listHeaderTitle}>Exams</Text>
                  <Text style={styles.listHeaderSub}>
                    {counts.live} live · {counts.draft} draft · {counts.setup} to set up
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.signatureHeaderBtn}
                    activeOpacity={0.75}
                    onPress={onManageSignature}
                    accessibilityRole="button"
                    accessibilityLabel="Manage principal signature"
                  >
                    <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.signatureHeaderBtnText}>Principal signature</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} onPress={onCreate}>
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.headerNewBtn}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.headerNewBtnText}>New</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {filters.map((f) => {
                  if (f.key !== 'all' && f.count === 0) return null;
                  const active = filter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setFilter(f.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        {f.label}
                        {f.key !== 'all' ? ` ${f.count}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
        }
        ListEmptyComponent={
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyWrap}>
            {exams.length > 0 ? (
              <>
                <Text style={styles.emptyTitle}>Nothing in this filter</Text>
                <Text style={styles.emptyText}>Try another tab, or create a new exam.</Text>
              </>
            ) : (
              <>
                <View style={styles.emptyIconRing}>
                  <Ionicons name="calendar-outline" size={34} color={theme.colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Plan your first exam</Text>
                <Text style={styles.emptyText}>
                  Choose classes and dates — timetable, seating and invigilation are built for you.
                </Text>
                <TouchableOpacity activeOpacity={0.85} onPress={onCreate}>
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.emptyCta}
                  >
                    <Ionicons name="add" size={17} color="#FFFFFF" />
                    <Text style={styles.emptyCtaText}>Create exam</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        }
      />
    </View>
  );
}

// ─── Principal signature ──────────────────────────────────────────────────────

function PrincipalSignatureModal({
  visible,
  styles,
  theme,
  onClose,
}: {
  visible: boolean;
  styles: Styles;
  theme: Theme;
  onClose: () => void;
}) {
  const [school, setSchool] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    SchoolSettingsService.getSettings()
      .then((settings) => {
        if (active) setSchool(settings);
      })
      .catch((error: any) => {
        if (active) alertCompat('Could not load signature', error?.message || 'Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const chooseSignature = async () => {
    if (saving) return;
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alertCompat('Photos permission needed', 'Allow photo library access to choose the principal signature.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 1],
      quality: 0.95,
    });
    if (result.canceled || !result.assets?.length) return;

    try {
      setSaving(true);
      const asset = result.assets[0];
      const signatureUrl = await SchoolSettingsService.uploadPrincipalSignature(asset.uri, asset.mimeType);
      setSchool((current) => current ? { ...current, principal_signature_url: signatureUrl } : current);
      alertCompat('Signature saved', 'New hall tickets will use this principal signature automatically.');
    } catch (error: any) {
      alertCompat('Upload failed', error?.message || 'Could not save the principal signature.');
    } finally {
      setSaving(false);
    }
  };

  const removeSignature = () => {
    if (!school?.principal_signature_url || saving) return;
    alertCompat(
      'Remove principal signature?',
      'Future hall tickets will return to a blank principal signing line.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await SchoolSettingsService.removePrincipalSignature();
              setSchool((current) => current ? { ...current, principal_signature_url: '' } : current);
            } catch (error: any) {
              alertCompat('Could not remove signature', error?.message || 'Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const signatureUrl = school?.principal_signature_url?.trim() || '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !saving && onClose()}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.modalTitle}>Principal signature</Text>
              <Text style={styles.signatureModalSubtitle}>Used automatically on every hall ticket</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Close principal signature"
            >
              <Ionicons name="close" size={23} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.signatureLoading}>
              <LogoLoader size={44} color={theme.colors.primary} />
            </View>
          ) : (
            <>
              <View style={styles.signaturePreview}>
                {signatureUrl ? (
                  <Image
                    source={{ uri: signatureUrl }}
                    resizeMode="contain"
                    style={styles.signaturePreviewImage}
                  />
                ) : (
                  <View style={styles.signatureEmpty}>
                    <View style={styles.signatureEmptyIcon}>
                      <Ionicons name="pencil-outline" size={24} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.signatureEmptyTitle}>No signature added</Text>
                    <Text style={styles.signatureEmptyText}>Hall tickets currently show a blank signing line.</Text>
                  </View>
                )}
              </View>

              <View style={styles.hallTicketInfo}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.hallTicketInfoText}>
                  Use a clear signature on a plain white or transparent background. The image is trimmed and resized automatically.
                </Text>
              </View>

              <View style={styles.signatureActions}>
                {signatureUrl ? (
                  <TouchableOpacity
                    style={styles.signatureRemoveBtn}
                    onPress={removeSignature}
                    disabled={saving}
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                    <Text style={styles.signatureRemoveText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, styles.signatureUploadBtn, saving && styles.disabledBtn]}
                  onPress={chooseSignature}
                  disabled={saving}
                  accessibilityRole="button"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="image-outline" size={17} color="#FFFFFF" />
                  )}
                  <Text style={styles.modalPrimaryBtnText}>
                    {saving ? 'Saving…' : signatureUrl ? 'Replace signature' : 'Choose signature'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Hall-ticket download ─────────────────────────────────────────────────────

function HallTicketModal({
  exam,
  styles,
  theme,
  onClose,
}: {
  exam: ExamListItem;
  styles: Styles;
  theme: Theme;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ExamTimetableDetail | null>(null);
  const [mappings, setMappings] = useState<ClassSection[]>([]);
  const [school, setSchool] = useState<SchoolSettings | null>(null);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingOptions(true);
    Promise.all([
      ExamTimetableService.getTimetable(exam.id),
      ClassService.getClassSections(),
      SchoolSettingsService.getSettings().catch(() => null),
    ])
      .then(([timetable, classMappings, settings]) => {
        if (!active) return;
        setDetail(timetable);
        setMappings(
          classMappings.filter(
            (mapping) => mapping.academic_year_id === timetable.exam.academic_year_id,
          ),
        );
        setSchool(settings);
      })
      .catch((err: any) => {
        if (active) {
          alertCompat('Could not load hall tickets', err?.message || 'Please try again.');
          onClose();
        }
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, [exam.id, onClose]);

  const examClassIds = useMemo(
    () => new Set((detail?.papers || []).map((paper) => paper.class_id)),
    [detail],
  );
  const classOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const mapping of mappings) {
      if (examClassIds.has(mapping.class_id)) {
        byId.set(mapping.class_id, { id: mapping.class_id, name: mapping.class_name });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [examClassIds, mappings]);
  const sectionOptions = useMemo(
    () =>
      mappings
        .filter((mapping) => mapping.class_id === classId)
        .map((mapping) => ({ id: mapping.section_id, name: mapping.section_name }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [classId, mappings],
  );

  useEffect(() => {
    if (classOptions.length === 1 && !classId) setClassId(classOptions[0].id);
  }, [classId, classOptions]);

  useEffect(() => {
    if (sectionOptions.length === 1 && !sectionId) setSectionId(sectionOptions[0].id);
  }, [sectionId, sectionOptions]);

  const handleClassPress = (nextClassId: string) => {
    setClassId(nextClassId);
    setSectionId('');
  };

  const handleDownload = async () => {
    if (!classId || !sectionId) {
      alertCompat('Select class and section', 'Both filters are required to create the hall-ticket batch.');
      return;
    }

    try {
      setDownloading(true);
      const data = await ExamTimetableService.getHallTicketData(exam.id, classId, sectionId);
      if (data.students.length === 0) {
        alertCompat('No students found', 'There are no active students in this class and section.');
        return;
      }

      const fileName = await downloadHallTicketPdf({
        examName: t_field(data.exam.name, data.exam.name_te),
        academicYear: data.exam.academic_year,
        className: data.class_section.class_name,
        sectionName: data.class_section.section_name,
        students: data.students,
        papers: data.papers,
        school: hallTicketSchoolSettings(school),
      });
      if (Platform.OS === 'web') {
        alertCompat(
          'Hall tickets downloaded',
          `${data.students.length} hall ticket${data.students.length === 1 ? '' : 's'} saved as ${fileName}.`,
        );
      }
    } catch (err: any) {
      alertCompat('Download failed', err?.message || 'Could not generate hall tickets.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !downloading && onClose()}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.modalTitle}>Download hall tickets</Text>
              <Text style={styles.hallTicketModalExam} numberOfLines={1}>
                {t_field(exam.name, exam.name_te)}
              </Text>
            </View>
            <TouchableOpacity
              disabled={downloading}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loadingOptions ? (
            <View style={styles.hallTicketLoading}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.helperText}>Loading classes and sections…</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.hallTicketInfo}>
                <Ionicons name="cut-outline" size={17} color={theme.colors.primary} />
                <Text style={styles.hallTicketInfoText}>
                  Four compact tearable hall tickets per A4 page, with subjects arranged horizontally
                  and your school icon in the header and watermark.
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Class</Text>
              <View style={styles.chipWrap}>
                {classOptions.map((item) => {
                  const active = item.id === classId;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.chip, active && styles.chipActive]}
                      activeOpacity={0.7}
                      onPress={() => handleClassPress(item.id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {classOptions.length === 0 && (
                <Text style={styles.helperText}>No scheduled classes are available for this exam.</Text>
              )}

              <Text style={styles.fieldLabel}>Section</Text>
              {!classId ? (
                <Text style={styles.helperText}>Select a class to see its sections.</Text>
              ) : sectionOptions.length === 0 ? (
                <Text style={styles.helperText}>No sections are mapped to this class for the exam year.</Text>
              ) : (
                <View style={styles.chipWrap}>
                  {sectionOptions.map((item) => {
                    const active = item.id === sectionId;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.chip, active && styles.chipActive]}
                        activeOpacity={0.7}
                        onPress={() => setSectionId(item.id)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.modalPrimaryBtn,
                  (!classId || !sectionId || downloading) && styles.disabledBtn,
                ]}
                activeOpacity={0.8}
                disabled={!classId || !sectionId || downloading}
                onPress={handleDownload}
              >
                <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                <Text style={styles.modalPrimaryBtnText}>
                  {downloading ? 'Creating PDF…' : 'Download A4 hall tickets'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function ExamDetailView({
  styles,
  theme,
  detail,
  allocations,
  saving,
  onBack,
  onGenerate,
  onEditPaper,
  onPublishToggle,
  onQuickAllocate,
  onCustomizeAllocate,
  onManageRooms,
  onOpenRoom,
  onAddRoomToSitting,
  onHallTickets,
}: {
  styles: Styles;
  theme: Theme;
  detail: ExamTimetableDetail;
  allocations: ExamRoomAllocation[];
  saving: boolean;
  onBack: () => void;
  onGenerate: () => void;
  onEditPaper: (p: ExamPaper) => void;
  onPublishToggle: () => void;
  onQuickAllocate: () => void;
  onCustomizeAllocate: () => void;
  onManageRooms: () => void;
  onOpenRoom: (a: ExamRoomAllocation) => void;
  onAddRoomToSitting: (s: { exam_date: string; session_start: string }) => void;
  onHallTickets: () => void;
}) {
  const { exam, papers } = detail;
  const category = examCategoryFor(exam.exam_type);
  const groups = useMemo(() => groupPapersByDate(papers), [papers]);
  const published = !!exam.timetable_published;
  const missingTeachers = papers.filter((p) => p.has_teacher === false).length;
  const hasSeating = allocations.length > 0;
  const [seatingOpen, setSeatingOpen] = useState(!published || !hasSeating);

  // Group room allocations into sittings (date + session).
  const sittingGroups = useMemo(() => {
    const map = new Map<string, { exam_date: string; session_start: string; rooms: ExamRoomAllocation[] }>();
    for (const a of allocations) {
      const key = `${a.exam_date}|${a.session_start}`;
      let g = map.get(key);
      if (!g) {
        g = { exam_date: a.exam_date, session_start: a.session_start, rooms: [] };
        map.set(key, g);
      }
      g.rooms.push(a);
    }
    return [...map.values()].sort((a, b) =>
      `${a.exam_date}|${a.session_start}`.localeCompare(`${b.exam_date}|${b.session_start}`)
    );
  }, [allocations]);

  const seatedCount = allocations.reduce((n, a) => n + (a.seats_count || 0), 0);
  const invigilatorCount = new Set(
    allocations.map((a) => a.invigilator_staff_id).filter(Boolean)
  ).size;
  const missingInvigilators = allocations.filter((a) => !a.invigilator_staff_id).length;

  // One clear next step — never show three competing primary buttons.
  // Publish stays on the bottom bar once schedule + seating are done.
  type NextStep =
    | { kind: 'generate'; title: string; subtitle: string; cta: string; onPress: () => void }
    | { kind: 'seat'; title: string; subtitle: string; cta: string; onPress: () => void }
    | null;

  const nextStep: NextStep = published
    ? null
    : papers.length === 0
      ? {
          kind: 'generate',
          title: 'Build the timetable',
          subtitle: 'Pick classes and dates — papers are scheduled automatically.',
          cta: 'Generate timetable',
          onPress: onGenerate,
        }
      : !hasSeating
        ? {
            kind: 'seat',
            title: 'Seat students',
            subtitle: 'Auto-assign rooms and balance invigilators in one tap.',
            cta: 'Auto-seat',
            onPress: onQuickAllocate,
          }
        : null;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.detailContent}>
        <TouchableOpacity style={styles.backRow} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={16} color={theme.colors.primary} />
          <Text style={styles.backRowText}>All exams</Text>
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.duration(280)} style={styles.summaryCard}>
          <LinearGradient
            colors={categoryGradient(exam.exam_type, category.color)}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.summaryAccent}
          />
          <View style={styles.summaryInner}>
            <View style={styles.summaryTop}>
              <LinearGradient
                colors={categoryGradient(exam.exam_type, category.color)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.examCardIconGradient}
              >
                <Ionicons name={category.icon} size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.flex}>
                <Text style={styles.detailTitle}>{t_field(exam.name, exam.name_te)}</Text>
                <Text style={styles.examCardSub}>
                  {category.title}
                  {exam.academic_year ? ` · ${exam.academic_year}` : ''}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: published ? `${theme.colors.success}14` : `${theme.colors.warning}16` },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: published ? theme.colors.success : theme.colors.warning }]}
                />
                <Text
                  style={[styles.statusPillText, { color: published ? theme.colors.success : theme.colors.warning }]}
                >
                  {published ? 'Live' : 'Draft'}
                </Text>
              </View>
            </View>

            <Text style={styles.summaryMetaLine} numberOfLines={1}>
              {exam.start_date ? `${fmtDate(exam.start_date)} – ${fmtDate(exam.end_date)}` : 'Not scheduled'}
              {papers.length > 0 ? ` · ${papers.length} papers` : ''}
              {hasSeating ? ` · ${seatedCount} seated` : ''}
            </Text>

            {/* Progress: Schedule → Seating → Live */}
            <View style={styles.progressRow}>
              {[
                { label: 'Schedule', done: papers.length > 0 },
                { label: 'Seating', done: hasSeating },
                { label: 'Live', done: published },
              ].map((step, i, arr) => (
                <React.Fragment key={step.label}>
                  <View style={styles.progressStep}>
                    <View
                      style={[
                        styles.progressDot,
                        {
                          backgroundColor: step.done ? theme.colors.success : theme.colors.borderLight,
                        },
                      ]}
                    >
                      {step.done && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
                    </View>
                    <Text
                      style={[
                        styles.progressLabel,
                        { color: step.done ? theme.colors.textStrong : theme.colors.textTertiary },
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                  {i < arr.length - 1 && (
                    <View
                      style={[
                        styles.progressLine,
                        { backgroundColor: step.done ? theme.colors.success : theme.colors.borderLight },
                      ]}
                    />
                  )}
                </React.Fragment>
              ))}
            </View>

            {papers.length > 0 && (
              <View style={styles.quietActions}>
                <TouchableOpacity onPress={onGenerate} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6 }}>
                  <Text style={styles.quietActionText}>Regenerate</Text>
                </TouchableOpacity>
                <Text style={styles.quietActionDot}>·</Text>
                <TouchableOpacity onPress={onHallTickets} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6 }}>
                  <Text style={styles.quietActionText}>Hall tickets</Text>
                </TouchableOpacity>
                <Text style={styles.quietActionDot}>·</Text>
                <TouchableOpacity onPress={onManageRooms} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6 }}>
                  <Text style={styles.quietActionText}>Rooms</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Single next-step card — the only loud CTA on drafts */}
        {nextStep && (
          <Animated.View entering={FadeInDown.delay(60).duration(280)} style={styles.nextStepCard}>
            <View style={styles.flex}>
              <Text style={styles.nextStepTitle}>{nextStep.title}</Text>
              <Text style={styles.nextStepSub}>{nextStep.subtitle}</Text>
              {nextStep.kind === 'seat' && (
                <TouchableOpacity onPress={onCustomizeAllocate} activeOpacity={0.7} style={styles.nextStepAlt}>
                  <Text style={styles.quietActionText}>Customize rooms & invigilators</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity activeOpacity={0.85} disabled={saving} onPress={nextStep.onPress}>
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.nextStepBtn, saving && styles.disabledBtn]}
              >
                <Ionicons
                  name={nextStep.kind === 'generate' ? 'sparkles' : 'grid-outline'}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={styles.nextStepBtnText}>{nextStep.cta}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Schedule first — the thing people actually read */}
        {groups.length > 0 && (
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconChip}>
              <Ionicons name="calendar-outline" size={13} color={theme.colors.primary} />
            </View>
            <Text style={styles.sectionHeaderText}>Schedule</Text>
          </View>
        )}
        {missingTeachers > 0 && (
          <View style={styles.compactWarn}>
            <Ionicons name="person-outline" size={14} color={theme.colors.warning} />
            <Text style={styles.compactWarnText}>
              {missingTeachers} paper{missingTeachers > 1 ? 's' : ''} without a subject teacher — assign in Academics
              so teachers can add syllabus.
            </Text>
          </View>
        )}
        {groups.map((group, gi) => (
          <Animated.View
            key={group.date || 'none'}
            entering={FadeInDown.delay(Math.min(gi, 5) * 45).duration(280)}
            style={styles.dateGroup}
          >
            <Text style={styles.dateHeader}>{fmtDate(group.date)}</Text>
            <View style={styles.dateCard}>
              {group.papers.map((paper, i) => {
                const sColor = subjectColor(paper.subject_name);
                return (
                  <TouchableOpacity
                    key={paper.id}
                    style={[styles.paperRow, i > 0 && styles.paperRowBorder]}
                    activeOpacity={0.7}
                    onPress={() => onEditPaper(paper)}
                  >
                    <View style={[styles.subjectTile, { backgroundColor: `${sColor}14` }]}>
                      <Ionicons name={subjectIcon(paper.subject_name)} size={17} color={sColor} />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.paperTitleRow}>
                        <Text style={styles.paperSubject} numberOfLines={1}>
                          {t_field(paper.subject_name, paper.subject_name_te)}
                        </Text>
                        <View style={styles.classChip}>
                          <Text style={styles.classChipText}>{paper.class_name}</Text>
                        </View>
                      </View>
                      <View style={styles.paperMetaRow}>
                        <Ionicons name="time-outline" size={11} color={theme.colors.textTertiary} />
                        <Text style={styles.paperMeta}>
                          {paper.start_time
                            ? `${fmtTime(paper.start_time)} – ${fmtTime(paper.end_time)}`
                            : 'Time not set'}
                        </Text>
                        <Text style={styles.paperMetaDot}>·</Text>
                        <Text style={styles.paperMeta}>Max {Number(paper.max_marks)}</Text>
                        {(paper.syllabus?.length || 0) > 0 && (
                          <>
                            <Text style={styles.paperMetaDot}>·</Text>
                            <Text style={[styles.paperMeta, { color: theme.colors.primary }]}>
                              {paper.syllabus!.length} topics
                            </Text>
                          </>
                        )}
                        {paper.has_teacher === false && (
                          <>
                            <Text style={styles.paperMetaDot}>·</Text>
                            <Text style={[styles.paperMeta, { color: theme.colors.warning }]}>No teacher</Text>
                          </>
                        )}
                        {paper.has_marks && (
                          <>
                            <Text style={styles.paperMetaDot}>·</Text>
                            <Ionicons name="lock-closed" size={10} color={theme.colors.warning} />
                            <Text style={[styles.paperMeta, { color: theme.colors.warning }]}>Marks</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={styles.editHint}>
                      <Ionicons name="pencil" size={12} color={theme.colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        ))}

        {/* Seating — collapsed by default when live */}
        {papers.length > 0 && (
          <View style={styles.dateGroup}>
            <TouchableOpacity
              style={styles.seatingHeaderRow}
              activeOpacity={0.75}
              onPress={() => setSeatingOpen((v) => !v)}
            >
              <View style={[styles.sectionHeaderRow, { marginBottom: 0 }]}>
                <View style={styles.sectionIconChip}>
                  <Ionicons name="grid-outline" size={13} color={theme.colors.primary} />
                </View>
                <Text style={styles.sectionHeaderText}>Seating</Text>
              </View>
              <View style={styles.seatingHeaderMeta}>
                {hasSeating ? (
                  <Text style={styles.seatingSummary}>
                    {allocations.length} rooms · {seatedCount} seats
                    {invigilatorCount > 0 ? ` · ${invigilatorCount} invigilators` : ''}
                  </Text>
                ) : (
                  <Text style={[styles.seatingSummary, { color: theme.colors.warning }]}>Not allocated</Text>
                )}
                <Ionicons
                  name={seatingOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.colors.textTertiary}
                />
              </View>
            </TouchableOpacity>

            {missingInvigilators > 0 && seatingOpen && (
              <View style={styles.compactWarn}>
                <Ionicons name="alert-circle-outline" size={14} color={theme.colors.warning} />
                <Text style={styles.compactWarnText}>
                  {missingInvigilators} room{missingInvigilators > 1 ? 's' : ''} without an invigilator
                </Text>
              </View>
            )}

            {seatingOpen && (
              <>
                {sittingGroups.length === 0 ? (
                  <View style={styles.seatingEmptyCard}>
                    <Text style={styles.seatingEmptyText}>
                      Rooms and invigilators aren’t assigned yet. Auto-seat uses all rooms and balances duties.
                    </Text>
                    <View style={styles.seatingEmptyActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={saving}
                        onPress={onQuickAllocate}
                        style={[styles.inlinePrimaryBtn, saving && styles.disabledBtn]}
                      >
                        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                        <Text style={styles.inlinePrimaryBtnText}>Auto-seat</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={onCustomizeAllocate} activeOpacity={0.7}>
                        <Text style={styles.quietActionText}>Customize</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    {sittingGroups.map((sitting) => (
                      <View key={`${sitting.exam_date}|${sitting.session_start}`} style={styles.sittingBlock}>
                        <Text style={styles.sittingLabel}>
                          {fmtDate(sitting.exam_date)}
                          {sitting.session_start !== '00:00:00' ? ` · ${fmtTime(sitting.session_start)}` : ''}
                        </Text>
                        <View style={styles.dateCard}>
                          {sitting.rooms.map((room, i) => {
                            const fill = room.capacity > 0 ? Math.min(1, room.seats_count / room.capacity) : 0;
                            const fillColor =
                              fill >= 1
                                ? theme.colors.danger
                                : fill >= 0.85
                                  ? theme.colors.warning
                                  : theme.colors.success;
                            return (
                              <TouchableOpacity
                                key={room.id}
                                style={[styles.paperRow, i > 0 && styles.paperRowBorder]}
                                activeOpacity={0.7}
                                onPress={() => onOpenRoom(room)}
                              >
                                <View style={[styles.subjectTile, { backgroundColor: `${theme.colors.primary}12` }]}>
                                  <Ionicons name="business-outline" size={16} color={theme.colors.primary} />
                                </View>
                                <View style={styles.flex}>
                                  <View style={styles.paperTitleRow}>
                                    <Text style={styles.paperSubject} numberOfLines={1}>
                                      {room.room_name}
                                    </Text>
                                    <Text style={styles.roomCount}>
                                      {room.seats_count}
                                      <Text style={styles.roomCountTotal}>/{room.capacity}</Text>
                                    </Text>
                                  </View>
                                  <View style={styles.capacityTrack}>
                                    <View
                                      style={[
                                        styles.capacityFill,
                                        { width: `${Math.round(fill * 100)}%`, backgroundColor: fillColor },
                                      ]}
                                    />
                                  </View>
                                  <View style={styles.paperMetaRow}>
                                    {room.invigilator_name ? (
                                      <>
                                        <View style={styles.invigAvatar}>
                                          <Text style={styles.invigAvatarText}>
                                            {room.invigilator_name.slice(0, 1).toUpperCase()}
                                          </Text>
                                        </View>
                                        <Text style={styles.paperMeta} numberOfLines={1}>
                                          {room.invigilator_name}
                                        </Text>
                                      </>
                                    ) : (
                                      <>
                                        <Ionicons name="alert-circle" size={11} color={theme.colors.warning} />
                                        <Text style={[styles.paperMeta, { color: theme.colors.warning }]}>
                                          No invigilator
                                        </Text>
                                      </>
                                    )}
                                    {room.class_names ? (
                                      <>
                                        <Text style={styles.paperMetaDot}>·</Text>
                                        <Text style={styles.paperMeta} numberOfLines={1}>
                                          {room.class_names}
                                        </Text>
                                      </>
                                    ) : null}
                                  </View>
                                </View>
                                <Ionicons name="chevron-forward" size={15} color={theme.colors.textTertiary} />
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            style={[styles.paperRow, styles.paperRowBorder]}
                            activeOpacity={0.7}
                            onPress={() =>
                              onAddRoomToSitting({
                                exam_date: sitting.exam_date,
                                session_start: sitting.session_start,
                              })
                            }
                          >
                            <View style={styles.classChip}>
                              <Ionicons name="add" size={14} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.paperMeta, { color: theme.colors.primary, fontWeight: '700' }]}>
                              Add room
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    <View style={styles.quietActions}>
                      <TouchableOpacity
                        onPress={onQuickAllocate}
                        disabled={saving}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6 }}
                      >
                        <Text style={styles.quietActionText}>Reallocate</Text>
                      </TouchableOpacity>
                      <Text style={styles.quietActionDot}>·</Text>
                      <TouchableOpacity
                        onPress={onCustomizeAllocate}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6 }}
                      >
                        <Text style={styles.quietActionText}>Customize</Text>
                      </TouchableOpacity>
                      <Text style={styles.quietActionDot}>·</Text>
                      <TouchableOpacity
                        onPress={onManageRooms}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6 }}
                      >
                        <Text style={styles.quietActionText}>Manage rooms</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {papers.length === 0 && !nextStep && (
          <View style={styles.emptyWrap}>
            <Ionicons name="sparkles-outline" size={44} color={theme.colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptyText}>
              Generate a timetable from classes and dates — you can fine-tune every paper afterwards.
            </Text>
          </View>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {papers.length > 0 && (
        <View style={styles.publishBar}>
          <View
            style={[
              styles.publishStateDot,
              { backgroundColor: published ? theme.colors.success : theme.colors.warning },
            ]}
          />
          <View style={styles.flex}>
            <Text style={styles.publishTitle}>
              {published ? 'Live for students & staff' : hasSeating ? 'Draft — ready to publish' : 'Draft'}
            </Text>
            <Text style={styles.publishSub}>
              {published
                ? 'Everyone sees this schedule'
                : hasSeating
                  ? 'Only admins can see this'
                  : 'Seat students, then publish'}
            </Text>
          </View>
          {published ? (
            <TouchableOpacity
              style={[styles.unpublishBtn, saving && styles.disabledBtn]}
              activeOpacity={0.85}
              disabled={saving}
              onPress={onPublishToggle}
            >
              <Ionicons name="eye-off-outline" size={15} color={theme.colors.text} />
              <Text style={styles.unpublishBtnText}>Unpublish</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity activeOpacity={0.85} disabled={saving} onPress={onPublishToggle}>
              <LinearGradient
                colors={['#059669', '#10B981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.publishBtn, saving && styles.disabledBtn]}
              >
                <Ionicons name="megaphone-outline" size={15} color="#FFFFFF" />
                <Text style={styles.publishBtnText}>Publish</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Create exam modal ────────────────────────────────────────────────────────

function CreateExamModal({
  visible,
  styles,
  theme,
  currentYear,
  existingNames,
  onClose,
  onCreated,
}: {
  visible: boolean;
  styles: Styles;
  theme: Theme;
  currentYear: AcademicYear | null;
  existingNames: string[];
  onClose: () => void;
  onCreated: (examId: string) => void;
}) {
  const [category, setCategory] = useState<ExamCategory>(EXAM_CATEGORIES[1]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const suggestions = (category.subExams || []).filter(
    (s) => !existingNames.includes(`${category.key}|${s}`)
  );

  const submit = async () => {
    const finalName = name.trim();
    if (!finalName) {
      alertCompat('Missing name', 'Give the exam a name, e.g. FA-1.');
      return;
    }
    if (!currentYear) {
      alertCompat('No academic year', 'Set up the current academic year in Academics first.');
      return;
    }
    if (existingNames.includes(`${category.key}|${finalName}`)) {
      alertCompat('Already exists', 'An exam with this name already exists for this category.');
      return;
    }
    try {
      setBusy(true);
      const created = await ResultService.createExam({
        name: finalName,
        academic_year_id: currentYear.id,
        exam_type: category.key,
      });
      const examId = (created as any)?.exam?.id || (created as any)?.id;
      setName('');
      onCreated(examId);
    } catch {
      alertCompat('Error', 'Failed to create exam');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Exam</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipWrap}>
              {EXAM_CATEGORIES.map((cat) => {
                const active = cat.key === category.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.chip, active && { backgroundColor: `${cat.color}18`, borderColor: cat.color }]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && { color: cat.color, fontWeight: '700' }]}>
                      {cat.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Exam name</Text>
            {suggestions.length > 0 && (
              <View style={styles.chipWrap}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, name === s && styles.chipActive]}
                    onPress={() => setName(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, name === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <AppTextInput
              value={name}
              onChangeText={setName}
              placeholder={`e.g. ${category.examPrefix}-1`}
              style={styles.input}
            />
            {currentYear && (
              <Text style={styles.helperText}>Academic year: {currentYear.code}</Text>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[styles.modalPrimaryBtn, busy && styles.disabledBtn]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.modalPrimaryBtnText}>{busy ? 'Creating…' : 'Create & set up timetable'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Generate modal (the "parameters" wizard) ─────────────────────────────────

function GenerateModal({
  visible,
  styles,
  theme,
  isDark,
  classes,
  academicYearId,
  initialParams,
  hasExistingPapers,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  styles: Styles;
  theme: Theme;
  isDark: boolean;
  classes: ClassInfo[];
  academicYearId: string;
  initialParams: ExamGenerateParams | null;
  hasExistingPapers: boolean;
  onClose: () => void;
  onSubmit: (params: ExamGenerateParams) => Promise<void>;
}) {
  const [classIds, setClassIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sessions, setSessions] = useState<ExamSession[]>([
    { start_time: '09:30', end_time: '12:30' },
  ]);
  const [includeSaturdays, setIncludeSaturdays] = useState(true);
  const [excludeHolidays, setExcludeHolidays] = useState(true);
  const [gapDays, setGapDays] = useState(0);
  const [mode, setMode] = useState<ExamScheduleMode>('aligned');
  const [maxMarks, setMaxMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('35');
  const [busy, setBusy] = useState(false);
  // Subject picker: options come from the selected classes' subject mappings;
  // subjectSel is the ordered selection = the exam order.
  const [subjectOptions, setSubjectOptions] = useState<ClassSubjectOption[]>([]);
  const [subjectSel, setSubjectSel] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const initialSubjectIds = React.useRef<string[] | null>(null);

  // Pre-fill from the last generation so "regenerate with tweaks" is painless.
  useEffect(() => {
    if (!visible) return;
    if (initialParams) {
      setClassIds(initialParams.class_ids || []);
      setStartDate(initialParams.start_date || '');
      setEndDate(initialParams.end_date || '');
      const savedSessions = (initialParams.sessions || []).map((s) => ({
        start_time: toHHMM(s.start_time) || null,
        end_time: toHHMM(s.end_time) || null,
      }));
      setSessions(
        savedSessions.length > 0
          ? savedSessions
          : [
              {
                start_time: toHHMM(initialParams.start_time) || '09:30',
                end_time: toHHMM(initialParams.end_time) || '12:30',
              },
            ]
      );
      setIncludeSaturdays(initialParams.include_saturdays !== false);
      setExcludeHolidays(initialParams.exclude_holidays !== false);
      setGapDays(initialParams.gap_days || 0);
      setMode(initialParams.mode === 'per_class' ? 'per_class' : 'aligned');
      setMaxMarks(String(initialParams.max_marks ?? 100));
      setPassingMarks(String(initialParams.passing_marks ?? 35));
      initialSubjectIds.current = initialParams.subject_ids || null;
    }
  }, [visible, initialParams]);

  // Refresh the subject list whenever the class selection changes.
  // Rules: saved selection order wins on first load; a subject the admin
  // deselected stays deselected; subjects that become newly available (from
  // adding a class) join the selection at the end.
  const prevOptionIds = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!visible) return;
    if (classIds.length === 0) {
      setSubjectOptions([]);
      setSubjectSel([]);
      prevOptionIds.current = new Set();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setSubjectsLoading(true);
        const options = await ExamTimetableService.getClassSubjects(classIds, academicYearId);
        if (cancelled) return;
        setSubjectOptions(options);
        const available = options.map((o) => o.id);
        const availableSet = new Set(available);
        const wasKnown = prevOptionIds.current;
        prevOptionIds.current = availableSet;
        const saved = initialSubjectIds.current;
        initialSubjectIds.current = null;
        setSubjectSel((prev) => {
          if (saved) return saved.filter((id) => availableSet.has(id));
          if (wasKnown.size === 0) return available; // fresh open: everything in
          const kept = prev.filter((id) => availableSet.has(id));
          const newOnes = available.filter((id) => !wasKnown.has(id) && !kept.includes(id));
          return [...kept, ...newOnes];
        });
      } catch {
        // silent — generation still works server-side with all subjects
      } finally {
        if (!cancelled) setSubjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, academicYearId, classIds]);

  const toggleClass = (id: string) => {
    setClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const toggleSubject = (id: string) => {
    setSubjectSel((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const moveSubject = (id: string, dir: -1 | 1) => {
    setSubjectSel((prev) => {
      const idx = prev.indexOf(id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const setSessionCount = (count: number) => {
    setSessions((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push({ start_time: '', end_time: '' });
      }
      return next.slice(0, count);
    });
  };

  const setSessionTime = (index: number, field: 'start_time' | 'end_time', value: string) => {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const submit = async () => {
    if (classIds.length === 0) {
      alertCompat('Select classes', 'Pick at least one class for this exam.');
      return;
    }
    if (!startDate || !endDate) {
      alertCompat('Select dates', 'Choose the exam window start and end dates.');
      return;
    }
    if (subjectSel.length === 0) {
      alertCompat('Select subjects', 'Keep at least one subject in the exam.');
      return;
    }
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const needTimes = sessions.length > 1;
      if ((needTimes || s.start_time) && !TIME_INPUT_RE.test(s.start_time || '')) {
        alertCompat('Invalid time', `Session ${i + 1} start must look like 09:30 (24h).`);
        return;
      }
      if ((needTimes || s.end_time) && !TIME_INPUT_RE.test(s.end_time || '')) {
        alertCompat('Invalid time', `Session ${i + 1} end must look like 12:30 (24h).`);
        return;
      }
      if (s.start_time && s.end_time && s.end_time <= s.start_time) {
        alertCompat('Invalid time', `Session ${i + 1} must end after it starts.`);
        return;
      }
    }
    const params: ExamGenerateParams = {
      class_ids: classIds,
      start_date: startDate,
      end_date: endDate,
      sessions: sessions.map((s) => ({
        start_time: s.start_time || null,
        end_time: s.end_time || null,
      })),
      subject_ids: subjectSel,
      include_saturdays: includeSaturdays,
      exclude_holidays: excludeHolidays,
      gap_days: gapDays,
      max_marks: Number(maxMarks) || 100,
      passing_marks: Number(passingMarks) || 35,
      mode,
    };
    const run = async () => {
      setBusy(true);
      try {
        await onSubmit(params);
      } finally {
        setBusy(false);
      }
    };
    if (hasExistingPapers) {
      alertCompat(
        'Regenerate timetable?',
        'The current schedule will be replaced. Papers that already have marks are kept unchanged.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Regenerate', onPress: run },
        ]
      );
    } else {
      run();
    }
  };

  const pickerColors = {
    isDark,
    textColor: theme.colors.textStrong,
    borderColor: theme.colors.border,
    accentColor: theme.colors.primary,
    iconColor: theme.colors.textSecondary,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={[styles.modalCard, styles.modalCardTall]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Timetable parameters</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Classes</Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                style={[styles.chip, classIds.length === classes.length && styles.chipActive]}
                onPress={() =>
                  setClassIds(classIds.length === classes.length ? [] : classes.map((c) => c.id))
                }
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.chipText, classIds.length === classes.length && styles.chipTextActive]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {classes.map((c) => {
                const active = classIds.includes(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleClass(c.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.subjectHeaderRow}>
              <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>
                Subjects & order ({subjectSel.length}/{subjectOptions.length})
              </Text>
              {subjectsLoading && <Text style={styles.helperInline}>loading…</Text>}
            </View>
            {classIds.length === 0 ? (
              <Text style={styles.helperText}>Select classes to load their subjects.</Text>
            ) : subjectOptions.length === 0 && !subjectsLoading ? (
              <Text style={styles.helperText}>
                No subjects mapped to the selected classes yet — assign them in Academics.
              </Text>
            ) : (
              <View style={styles.subjectList}>
                {[
                  ...subjectSel
                    .map((id) => subjectOptions.find((o) => o.id === id))
                    .filter(Boolean) as ClassSubjectOption[],
                  ...subjectOptions.filter((o) => !subjectSel.includes(o.id)),
                ].map((option) => {
                  const selIdx = subjectSel.indexOf(option.id);
                  const selected = selIdx >= 0;
                  return (
                    <View key={option.id} style={[styles.subjectRow, !selected && styles.subjectRowOff]}>
                      <TouchableOpacity
                        style={styles.subjectToggle}
                        onPress={() => toggleSubject(option.id)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name={selected ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={selected ? theme.colors.primary : theme.colors.textTertiary}
                        />
                      </TouchableOpacity>
                      {selected && <Text style={styles.subjectOrderNum}>{selIdx + 1}</Text>}
                      <View style={styles.flex}>
                        <Text style={[styles.subjectName, !selected && styles.subjectNameOff]} numberOfLines={1}>
                          {t_field(option.name, option.name_te)}
                        </Text>
                        {classIds.length > 1 && option.class_count < classIds.length && (
                          <Text style={styles.subjectHint}>
                            {option.class_count} of {classIds.length} classes
                          </Text>
                        )}
                      </View>
                      {selected && (
                        <View style={styles.orderArrows}>
                          <TouchableOpacity
                            onPress={() => moveSubject(option.id, -1)}
                            disabled={selIdx === 0}
                            style={[styles.orderArrowBtn, selIdx === 0 && styles.disabledBtn]}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="chevron-up" size={16} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => moveSubject(option.id, 1)}
                            disabled={selIdx === subjectSel.length - 1}
                            style={[styles.orderArrowBtn, selIdx === subjectSel.length - 1 && styles.disabledBtn]}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.fieldLabel}>Exam window</Text>
            <View style={styles.rowTwo}>
              <View style={styles.flex}>
                <AppDatePicker value={startDate} onChange={setStartDate} placeholder="Start date" {...pickerColors} />
              </View>
              <View style={styles.flex}>
                <AppDatePicker value={endDate} onChange={setEndDate} placeholder="End date" minimumDate={startDate || undefined} {...pickerColors} />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Sessions per day</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setSessionCount(Math.max(1, sessions.length - 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={16} color={theme.colors.textStrong} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{sessions.length}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setSessionCount(Math.min(3, sessions.length + 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={theme.colors.textStrong} />
                </TouchableOpacity>
              </View>
            </View>
            {sessions.map((session, i) => (
              <View key={i} style={styles.sessionRow}>
                <Text style={styles.sessionLabel}>
                  {sessions.length > 1 ? `Session ${i + 1}` : 'Timing (24h)'}
                </Text>
                <View style={[styles.rowTwo, styles.flex]}>
                  <View style={styles.flex}>
                    <AppTextInput
                      value={session.start_time || ''}
                      onChangeText={(v: string) => setSessionTime(i, 'start_time', v)}
                      placeholder="09:30"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.flex}>
                    <AppTextInput
                      value={session.end_time || ''}
                      onChangeText={(v: string) => setSessionTime(i, 'end_time', v)}
                      placeholder="12:30"
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>
            ))}
            {sessions.length > 1 && (
              <Text style={styles.helperText}>
                {sessions.length} papers are scheduled per day — subjects fill Session 1, then
                Session 2{sessions.length > 2 ? ', then Session 3' : ''}.
              </Text>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Include Saturdays</Text>
              <Switch
                value={includeSaturdays}
                onValueChange={setIncludeSaturdays}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Skip holidays from Events</Text>
              <Switch
                value={excludeHolidays}
                onValueChange={setExcludeHolidays}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Rest days between papers</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setGapDays((g) => Math.max(0, g - 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={16} color={theme.colors.textStrong} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{gapDays}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setGapDays((g) => Math.min(3, g + 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={theme.colors.textStrong} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Scheduling style</Text>
            <View style={styles.segment}>
              {(
                [
                  ['aligned', 'Aligned', 'Same subject on the same day for every class'],
                  ['per_class', 'Per class', 'Each class fills its own consecutive days'],
                ] as const
              ).map(([value, label, hint]) => {
                const active = mode === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                    onPress={() => setMode(value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
                    <Text style={[styles.segmentHint, active && styles.segmentHintActive]} numberOfLines={2}>
                      {hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Marks per paper</Text>
            <View style={styles.rowTwo}>
              <View style={styles.flex}>
                <Text style={styles.inputSubLabel}>Maximum marks</Text>
                <AppTextInput
                  value={maxMarks}
                  onChangeText={setMaxMarks}
                  placeholder="e.g. 100"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.inputSubLabel}>Passing marks</Text>
                <AppTextInput
                  value={passingMarks}
                  onChangeText={setPassingMarks}
                  placeholder="e.g. 35"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>
            <Text style={styles.helperText}>
              Sundays are always skipped. Subjects come from each class subject mapping in Academics.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[styles.modalPrimaryBtn, busy && styles.disabledBtn]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
            <Text style={styles.modalPrimaryBtnText}>{busy ? 'Generating…' : 'Generate timetable'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Edit paper modal ─────────────────────────────────────────────────────────

function EditPaperModal({
  paper,
  styles,
  theme,
  isDark,
  onClose,
  onSaved,
}: {
  paper: ExamPaper;
  styles: Styles;
  theme: Theme;
  isDark: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(paper.exam_date || '');
  const [startTime, setStartTime] = useState(toHHMM(paper.start_time));
  const [endTime, setEndTime] = useState(toHHMM(paper.end_time));
  const [maxMarks, setMaxMarks] = useState(String(Number(paper.max_marks)));
  const [passingMarks, setPassingMarks] = useState(String(Number(paper.passing_marks)));
  // Syllabus editor rows: topic + weightage as strings for smooth typing.
  const [syllabus, setSyllabus] = useState<{ topic: string; marks: string }[]>(
    (paper.syllabus || []).map((s) => ({ topic: s.topic, marks: s.marks != null ? String(s.marks) : '' }))
  );
  const [busy, setBusy] = useState(false);

  const setSyllabusField = (index: number, field: 'topic' | 'marks', value: string) => {
    setSyllabus((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };
  const weightageTotal = syllabus.reduce((n, row) => n + (Number(row.marks) || 0), 0);
  const hasWeightage = syllabus.some((row) => row.marks.trim() !== '');
  const weightageMatches = weightageTotal === (Number(maxMarks) || 0);

  const save = async () => {
    if (startTime && !TIME_INPUT_RE.test(startTime)) {
      alertCompat('Invalid time', 'Start time must look like 09:30 (24h).');
      return;
    }
    if (endTime && !TIME_INPUT_RE.test(endTime)) {
      alertCompat('Invalid time', 'End time must look like 12:30 (24h).');
      return;
    }
    const badRow = syllabus.find(
      (row) => row.topic.trim() !== '' && row.marks.trim() !== '' && (Number.isNaN(Number(row.marks)) || Number(row.marks) < 0)
    );
    if (badRow) {
      alertCompat('Invalid weightage', `Check the marks for "${badRow.topic.trim()}".`);
      return;
    }
    try {
      setBusy(true);
      await ExamTimetableService.updatePaper(paper.id, {
        exam_date: date || null,
        start_time: startTime || null,
        end_time: endTime || null,
        max_marks: Number(maxMarks) || Number(paper.max_marks),
        passing_marks: Number(passingMarks) || Number(paper.passing_marks),
        syllabus: syllabus
          .filter((row) => row.topic.trim() !== '')
          .map((row) => ({
            topic: row.topic.trim(),
            marks: row.marks.trim() === '' ? null : Number(row.marks),
          })),
      });
      onSaved();
    } catch (err: any) {
      alertCompat('Could not save', err?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    alertCompat('Remove this paper?', `${paper.subject_name} — ${paper.class_name}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            await ExamTimetableService.deletePaper(paper.id);
            onSaved();
          } catch (err: any) {
            alertCompat('Could not remove', err?.message || 'Delete failed');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {paper.subject_name}
              </Text>
              <Text style={styles.examCardSub}>{paper.class_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {paper.has_marks && (
              <View style={styles.lockNote}>
                <Ionicons name="lock-closed" size={13} color={theme.colors.warning} />
                <Text style={styles.lockNoteText}>
                  Marks are already recorded for this paper — it can be rescheduled but not removed.
                </Text>
              </View>
            )}
            <Text style={styles.fieldLabel}>Date</Text>
            <AppDatePicker
              value={date}
              onChange={setDate}
              placeholder="Exam date"
              isDark={isDark}
              textColor={theme.colors.textStrong}
              borderColor={theme.colors.border}
              accentColor={theme.colors.primary}
              iconColor={theme.colors.textSecondary}
            />
            <Text style={styles.fieldLabel}>Session time (24h)</Text>
            <View style={styles.rowTwo}>
              <View style={styles.flex}>
                <Text style={styles.inputSubLabel}>Starts</Text>
                <AppTextInput value={startTime} onChangeText={setStartTime} placeholder="09:30" style={styles.input} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.inputSubLabel}>Ends</Text>
                <AppTextInput value={endTime} onChangeText={setEndTime} placeholder="12:30" style={styles.input} />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Marks</Text>
            <View style={styles.rowTwo}>
              <View style={styles.flex}>
                <Text style={styles.inputSubLabel}>Maximum marks</Text>
                <AppTextInput
                  value={maxMarks}
                  onChangeText={setMaxMarks}
                  placeholder="e.g. 100"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.inputSubLabel}>Passing marks</Text>
                <AppTextInput
                  value={passingMarks}
                  onChangeText={setPassingMarks}
                  placeholder="e.g. 35"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.subjectHeaderRow}>
              <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>
                Syllabus & weightage
              </Text>
              {hasWeightage && (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: weightageMatches ? `${theme.colors.success}14` : `${theme.colors.warning}16` },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: weightageMatches ? theme.colors.success : theme.colors.warning },
                    ]}
                  >
                    {weightageTotal}/{Number(maxMarks) || 0} marks
                  </Text>
                </View>
              )}
            </View>
            {syllabus.map((row, i) => (
              <View key={i} style={styles.syllabusRow}>
                <View style={styles.flex}>
                  <AppTextInput
                    value={row.topic}
                    onChangeText={(v: string) => setSyllabusField(i, 'topic', v)}
                    placeholder={`Topic ${i + 1} — e.g. Chapter ${i + 1}`}
                    style={styles.input}
                  />
                </View>
                <View style={styles.syllabusMarks}>
                  <AppTextInput
                    value={row.marks}
                    onChangeText={(v: string) => setSyllabusField(i, 'marks', v)}
                    placeholder="Marks"
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
                <TouchableOpacity
                  style={styles.syllabusRemove}
                  activeOpacity={0.7}
                  onPress={() => setSyllabus((prev) => prev.filter((_, idx) => idx !== i))}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close-circle" size={18} color={theme.colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.syllabusAdd}
              activeOpacity={0.7}
              onPress={() => setSyllabus((prev) => [...prev, { topic: '', marks: '' }])}
            >
              <Ionicons name="add" size={15} color={theme.colors.primary} />
              <Text style={styles.allocateCtaText}>Add topic</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>
              Topics and their weightage are shown to students and teachers with the timetable.
              Weightage is optional per topic.
            </Text>
          </ScrollView>

          <View style={styles.rowTwo}>
            {!paper.has_marks && (
              <TouchableOpacity
                style={[styles.modalDangerBtn, busy && styles.disabledBtn]}
                onPress={remove}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, styles.flex, busy && styles.disabledBtn]}
              onPress={save}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.modalPrimaryBtnText}>{busy ? 'Saving…' : 'Save changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Rooms registry modal ─────────────────────────────────────────────────────

function RoomsModal({
  visible,
  styles,
  theme,
  onClose,
}: {
  visible: boolean;
  styles: Styles;
  theme: Theme;
  onClose: () => void;
}) {
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRooms(await ExamAllocationService.getRooms());
    } catch {
      // list stays; retry on next open
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      load();
      setEditingId(null);
      setName('');
      setCapacity('30');
    }
  }, [visible, load]);

  const submit = async () => {
    const trimmed = name.trim();
    const cap = Number(capacity);
    if (!trimmed) {
      alertCompat('Missing name', 'Give the room a name, e.g. Hall A.');
      return;
    }
    if (!(cap > 0)) {
      alertCompat('Invalid capacity', 'Capacity must be a positive number.');
      return;
    }
    try {
      setBusy(true);
      if (editingId) {
        await ExamAllocationService.updateRoom(editingId, { name: trimmed, capacity: cap });
      } else {
        await ExamAllocationService.addRoom({ name: trimmed, capacity: cap });
      }
      setName('');
      setCapacity('30');
      setEditingId(null);
      await load();
    } catch (err: any) {
      alertCompat('Could not save room', err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = (room: ExamRoom) => {
    alertCompat('Remove room?', `${room.name} (capacity ${room.capacity})`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await ExamAllocationService.deleteRoom(room.id);
            await load();
          } catch (err: any) {
            alertCompat('Could not remove', err?.message || 'Room is in use');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Exam rooms</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {loading && rooms.length === 0 ? (
              <Text style={styles.helperText}>Loading rooms…</Text>
            ) : rooms.length === 0 ? (
              <Text style={styles.helperText}>No rooms yet — add the halls/classrooms used for exams.</Text>
            ) : (
              <View style={styles.subjectList}>
                {rooms.map((room) => (
                  <View key={room.id} style={styles.subjectRow}>
                    <Ionicons name="business-outline" size={16} color={theme.colors.textSecondary} />
                    <View style={styles.flex}>
                      <Text style={styles.subjectName}>{room.name}</Text>
                      <Text style={styles.subjectHint}>Capacity {room.capacity}</Text>
                    </View>
                    <View style={styles.orderArrows}>
                      <TouchableOpacity
                        style={styles.orderArrowBtn}
                        activeOpacity={0.7}
                        onPress={() => {
                          setEditingId(room.id);
                          setName(room.name);
                          setCapacity(String(room.capacity));
                        }}
                      >
                        <Ionicons name="pencil-outline" size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.orderArrowBtn}
                        activeOpacity={0.7}
                        onPress={() => remove(room)}
                      >
                        <Ionicons name="trash-outline" size={14} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.fieldLabel}>{editingId ? 'Edit room' : 'Add room'}</Text>
            <View style={styles.rowTwo}>
              <View style={[styles.flex, { flexGrow: 2 }]}>
                <Text style={styles.inputSubLabel}>Room name</Text>
                <AppTextInput value={name} onChangeText={setName} placeholder="e.g. Hall A" style={styles.input} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.inputSubLabel}>Capacity</Text>
                <AppTextInput
                  value={capacity}
                  onChangeText={setCapacity}
                  placeholder="30"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>
            {editingId && (
              <TouchableOpacity
                onPress={() => {
                  setEditingId(null);
                  setName('');
                  setCapacity('30');
                }}
              >
                <Text style={[styles.helperText, { color: theme.colors.primary }]}>Cancel edit</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.modalPrimaryBtn, busy && styles.disabledBtn]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.modalPrimaryBtnText}>
              {busy ? 'Saving…' : editingId ? 'Save room' : 'Add room'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Allocation wizard modal ──────────────────────────────────────────────────

function AllocateModal({
  visible,
  styles,
  theme,
  initialParams,
  hasExisting,
  roomsVisible,
  onManageRooms,
  onCloseRooms,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  styles: Styles;
  theme: Theme;
  initialParams: ExamAllocationParams | null;
  hasExisting: boolean;
  roomsVisible: boolean;
  onManageRooms: () => void;
  onCloseRooms: () => void;
  onClose: () => void;
  onSubmit: (params: ExamAllocationParams) => Promise<void>;
}) {
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [teachers, setTeachers] = useState<TimetableTeacher[]>([]);
  const [roomSel, setRoomSel] = useState<string[]>([]);
  const [staffSel, setStaffSel] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<SeatingStrategy>('sequential');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const [roomData, teacherData] = await Promise.all([
          ExamAllocationService.getRooms(),
          TimetableService.getTeacherOptions().catch(() => [] as TimetableTeacher[]),
        ]);
        setRooms(roomData);
        setTeachers(teacherData);
        if (initialParams) {
          const roomIds = new Set(roomData.map((r) => r.id));
          const staffIds = new Set(teacherData.map((t) => t.id));
          setRoomSel((initialParams.room_ids || []).filter((id) => roomIds.has(id)));
          setStaffSel((initialParams.invigilator_staff_ids || []).filter((id) => staffIds.has(id)));
          setStrategy(
            initialParams.strategy === 'mixed' || initialParams.strategy === 'balanced'
              ? initialParams.strategy
              : 'sequential'
          );
        } else {
          setStaffSel(teacherData.map((t) => t.id));
        }
      } catch {
        // fields stay empty; user can close and retry
      }
    })();
  }, [visible]);

  // Re-fetch the room list after the nested rooms manager closes, so freshly
  // added/edited rooms appear immediately; selection is pruned to live rooms.
  const reloadRooms = useCallback(async () => {
    try {
      const roomData = await ExamAllocationService.getRooms();
      setRooms(roomData);
      setRoomSel((prev) => prev.filter((id) => roomData.some((r) => r.id === id)));
    } catch {
      // keep the stale list
    }
  }, []);

  const toggleRoom = (id: string) => {
    setRoomSel((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };
  const toggleStaff = (id: string) => {
    setStaffSel((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const teacherLabel = (t: TimetableTeacher) =>
    t.display_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.staff_code;

  const selectedCapacity = roomSel.reduce(
    (n, id) => n + (rooms.find((r) => r.id === id)?.capacity || 0),
    0
  );

  const submit = () => {
    if (roomSel.length === 0) {
      alertCompat('Select rooms', 'Pick at least one room, in the order they should fill.');
      return;
    }
    const run = async () => {
      setBusy(true);
      try {
        await onSubmit({ room_ids: roomSel, strategy, invigilator_staff_ids: staffSel });
      } finally {
        setBusy(false);
      }
    };
    if (hasExisting) {
      alertCompat(
        'Reallocate seating?',
        'The current room and invigilator assignments will be replaced.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reallocate', onPress: run },
        ]
      );
    } else {
      run();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.modalCardTall]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rooms & invigilators</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.subjectHeaderRow}>
              <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>
                Rooms (fill order) · capacity {selectedCapacity}
              </Text>
              <TouchableOpacity onPress={onManageRooms} activeOpacity={0.7}>
                <Text style={styles.seatingLink}>Manage rooms</Text>
              </TouchableOpacity>
            </View>
            {rooms.length === 0 ? (
              <Text style={styles.helperText}>No rooms defined yet — add them via Manage rooms.</Text>
            ) : (
              <View style={styles.chipWrap}>
                {rooms.map((room) => {
                  const idx = roomSel.indexOf(room.id);
                  const active = idx >= 0;
                  return (
                    <TouchableOpacity
                      key={room.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleRoom(room.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {active ? `${idx + 1}. ` : ''}{room.name} ({room.capacity})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={styles.fieldLabel}>Seating style</Text>
            <View style={styles.segment}>
              {(
                [
                  ['sequential', 'By class', 'Each class as a block, room after room'],
                  ['balanced', 'Even split', 'Every room seats an equal share of each class'],
                  ['mixed', 'Mixed', 'Alternate classes seat-by-seat (anti-copying)'],
                ] as const
              ).map(([value, label, hint]) => {
                const active = strategy === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                    onPress={() => setStrategy(value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
                    <Text style={[styles.segmentHint, active && styles.segmentHintActive]} numberOfLines={2}>
                      {hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>
              Invigilator pool ({staffSel.length}/{teachers.length})
            </Text>
            {teachers.length === 0 ? (
              <Text style={styles.helperText}>No staff found — rooms will be allocated without invigilators.</Text>
            ) : (
              <View style={styles.chipWrap}>
                <TouchableOpacity
                  style={[styles.chip, staffSel.length === teachers.length && styles.chipActive]}
                  onPress={() =>
                    setStaffSel(staffSel.length === teachers.length ? [] : teachers.map((t) => t.id))
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.chipText, staffSel.length === teachers.length && styles.chipTextActive]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {teachers.map((t) => {
                  const active = staffSel.includes(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleStaff(t.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{teacherLabel(t)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <Text style={styles.helperText}>
              Duties are balanced across the pool; nobody invigilates two rooms in one sitting. Every
              room and invigilator stays editable after allocation.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[styles.modalPrimaryBtn, busy && styles.disabledBtn]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="grid-outline" size={16} color="#FFFFFF" />
            <Text style={styles.modalPrimaryBtnText}>
              {busy ? 'Allocating…' : hasExisting ? 'Reallocate seating' : 'Allocate seating'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nested so it stacks ABOVE this wizard (sibling modals stack in
            mount order and would render underneath). */}
        <RoomsModal
          visible={roomsVisible}
          styles={styles}
          theme={theme}
          onClose={() => {
            onCloseRooms();
            reloadRooms();
          }}
        />
      </View>
    </Modal>
  );
}

// ─── Add-room-to-sitting picker ───────────────────────────────────────────────

function AddRoomToSittingModal({
  sitting,
  usedRoomIds,
  styles,
  theme,
  onClose,
  onPick,
}: {
  sitting: { exam_date: string; session_start: string };
  usedRoomIds: string[];
  styles: Styles;
  theme: Theme;
  onClose: () => void;
  onPick: (roomId: string) => Promise<void>;
}) {
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setRooms(await ExamAllocationService.getRooms());
      } catch {
        // empty list shown; closing retries
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const available = rooms.filter((r) => !usedRoomIds.includes(r.id));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.modalTitle}>Add room</Text>
              <Text style={styles.examCardSub}>
                {fmtDate(sitting.exam_date)}
                {sitting.session_start !== '00:00:00' ? ` · ${fmtTime(sitting.session_start)}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {loading ? (
              <Text style={styles.helperText}>Loading rooms…</Text>
            ) : available.length === 0 ? (
              <Text style={styles.helperText}>
                Every defined room is already in this sitting — add more rooms via Manage rooms.
              </Text>
            ) : (
              <View style={styles.subjectList}>
                {available.map((room) => (
                  <TouchableOpacity
                    key={room.id}
                    style={styles.subjectRow}
                    activeOpacity={0.7}
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        await onPick(room.id);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Ionicons name="business-outline" size={16} color={theme.colors.textSecondary} />
                    <View style={styles.flex}>
                      <Text style={styles.subjectName}>{room.name}</Text>
                      <Text style={styles.subjectHint}>Capacity {room.capacity}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.helperText}>
              The room is added empty — move students into it from any other room of this sitting.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Room detail modal (students + invigilator) ───────────────────────────────

function RoomDetailModal({
  allocation,
  siblingRooms,
  styles,
  theme,
  onClose,
  onChanged,
}: {
  allocation: ExamRoomAllocation;
  siblingRooms: ExamRoomAllocation[];
  styles: Styles;
  theme: Theme;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [students, setStudents] = useState<ExamSeatStudent[]>([]);
  const [teachers, setTeachers] = useState<TimetableTeacher[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [seatData, teacherData] = await Promise.all([
        ExamAllocationService.getAllocationStudents(allocation.id),
        TimetableService.getTeacherOptions().catch(() => [] as TimetableTeacher[]),
      ]);
      setStudents(seatData);
      setTeachers(teacherData);
    } catch {
      // shown as empty; closing and reopening retries
    } finally {
      setLoading(false);
    }
  }, [allocation.id]);

  useEffect(() => {
    load();
  }, [load]);

  const teacherLabel = (t: TimetableTeacher) =>
    t.display_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.staff_code;

  const setInvigilator = async (staffId: string | null) => {
    try {
      setBusy(true);
      await ExamAllocationService.setInvigilator(allocation.id, staffId);
      setPickerOpen(false);
      await onChanged();
      onClose();
    } catch (err: any) {
      alertCompat('Could not update', err?.message || 'Invigilator update failed');
    } finally {
      setBusy(false);
    }
  };

  const removeRoom = () => {
    alertCompat('Remove this room from the sitting?', allocation.room_name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            await ExamAllocationService.removeAllocation(allocation.id);
            await onChanged();
            onClose();
          } catch (err: any) {
            alertCompat('Could not remove', err?.message || 'Remove failed');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const moveStudent = (student: ExamSeatStudent) => {
    if (siblingRooms.length === 0) {
      alertCompat(
        'No other rooms',
        'This sitting uses only one room. Use "Add room to this sitting" first, then move students into it.'
      );
      return;
    }
    alertCompat(
      `Move ${student.display_name}?`,
      'Choose the room to move this student into.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...siblingRooms.map((room) => ({
          text: `${room.room_name} (${room.seats_count}/${room.capacity})`,
          onPress: async () => {
            try {
              setBusy(true);
              await ExamAllocationService.moveSeat(student.seat_id, room.id);
              await onChanged();
              await load();
            } catch (err: any) {
              alertCompat('Could not move', err?.message || 'Move failed');
            } finally {
              setBusy(false);
            }
          },
        })),
      ]
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.modalCardTall]}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.modalTitle}>{allocation.room_name}</Text>
              <Text style={styles.examCardSub}>
                {fmtDate(allocation.exam_date)}
                {allocation.session_start !== '00:00:00' ? ` · ${fmtTime(allocation.session_start)}` : ''}
                {` · ${allocation.seats_count}/${allocation.capacity} seated`}
              </Text>
            </View>
            {!loading && students.length === 0 && (
              <TouchableOpacity
                onPress={removeRoom}
                disabled={busy}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.invigilatorRow}
            activeOpacity={0.7}
            onPress={() => setPickerOpen((v) => !v)}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.invigilatorText} numberOfLines={1}>
              {allocation.invigilator_name || 'Assign invigilator'}
            </Text>
            <Ionicons
              name={pickerOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {pickerOpen && (
              <View style={[styles.subjectList, { marginBottom: 10 }]}>
                <TouchableOpacity
                  style={styles.subjectRow}
                  activeOpacity={0.7}
                  disabled={busy}
                  onPress={() => setInvigilator(null)}
                >
                  <Ionicons name="close-circle-outline" size={16} color={theme.colors.textTertiary} />
                  <Text style={[styles.subjectName, { color: theme.colors.textSecondary }]}>
                    No invigilator
                  </Text>
                </TouchableOpacity>
                {teachers.map((t) => {
                  const active = t.id === allocation.invigilator_staff_id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.subjectRow}
                      activeOpacity={0.7}
                      disabled={busy}
                      onPress={() => setInvigilator(t.id)}
                    >
                      <Ionicons
                        name={active ? 'radio-button-on' : 'radio-button-off'}
                        size={16}
                        color={active ? theme.colors.primary : theme.colors.textTertiary}
                      />
                      <Text style={styles.subjectName}>{teacherLabel(t)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {loading ? (
              <Text style={styles.helperText}>Loading students…</Text>
            ) : students.length === 0 ? (
              <Text style={styles.helperText}>No students seated in this room.</Text>
            ) : (
              <View style={styles.subjectList}>
                {students.map((s) => (
                  <View key={s.seat_id} style={styles.subjectRow}>
                    <Text style={styles.seatNo}>{s.seat_no ?? '—'}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.subjectName} numberOfLines={1}>{s.display_name}</Text>
                      <Text style={styles.subjectHint}>
                        {s.class_name}-{s.section_name}
                        {s.roll_number != null ? ` · Roll ${s.roll_number}` : ''} · {s.admission_no}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.orderArrowBtn}
                      activeOpacity={0.7}
                      disabled={busy}
                      onPress={() => moveStudent(s)}
                    >
                      <Ionicons name="swap-horizontal" size={14} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof getStyles>;

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    listContent: { padding: 16, paddingBottom: 40 },
    detailContent: { padding: 16 },
    bottomSpacer: { height: 96 },

    // exam list
    listHeader: { marginBottom: 12, gap: 12 },
    listHeaderTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    listHeaderTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: theme.colors.textStrong,
    },
    listHeaderSub: {
      fontSize: 12.5,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 8,
    },
    signatureHeaderBtn: {
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}32`,
      backgroundColor: `${theme.colors.primary}0D`,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    signatureHeaderBtnText: {
      color: theme.colors.primary,
      fontSize: 12.5,
      fontWeight: '700',
    },
    headerNewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
    },
    headerNewBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.card,
      borderWidth: 1,
      borderColor: isDark ? theme.colors.border : theme.colors.borderLight,
    },
    filterChipActive: {
      backgroundColor: `${theme.colors.primary}14`,
      borderColor: `${theme.colors.primary}44`,
    },
    filterChipText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    filterChipTextActive: { color: theme.colors.primary, fontWeight: '700' },

    examCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? theme.colors.border : theme.colors.borderLight,
      marginBottom: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      ...(Platform.OS === 'ios'
        ? { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 8 }
        : Platform.OS === 'web'
          ? ({ boxShadow: isDark ? 'none' : '0 2px 10px rgba(15,23,42,0.04)' } as any)
          : { elevation: 1 }),
    },
    examCardOpen: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    hallTicketIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}10`,
    },
    hallTicketCardBtn: {
      width: 72,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderLeftWidth: 1,
      borderLeftColor: isDark ? theme.colors.border : theme.colors.borderLight,
      backgroundColor: `${theme.colors.primary}08`,
    },
    hallTicketCardBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.primary,
      textAlign: 'center',
    },
    examCardIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    examCardIconGradient: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    examCardBody: { flex: 1, gap: 2 },
    examCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    examCardTitle: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: theme.colors.textStrong,
    },
    examCardSub: { fontSize: 12, color: theme.colors.textSecondary },
    examCardHint: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.primary,
      marginTop: 2,
    },
    examCardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3.5,
    },
    metaChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3.5,
      borderRadius: 20,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },

    statsStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? theme.colors.border : theme.colors.borderLight,
      paddingVertical: 14,
      marginBottom: 14,
    },
    statCell: { flex: 1, alignItems: 'center', gap: 2 },
    statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: theme.colors.textStrong },
    statLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: theme.colors.textTertiary,
    },
    statDivider: { width: 1, height: 26, backgroundColor: theme.colors.borderLight },

    fabWrap: {
      position: 'absolute',
      right: 16,
      bottom: 24,
      borderRadius: 16,
    },
    primaryFab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: 16,
    },
    primaryFabText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

    emptyWrap: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32, gap: 10 },
    emptyIconRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}10`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}22`,
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: theme.colors.textStrong },
    emptyText: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 19, maxWidth: 340 },
    emptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      marginTop: 8,
    },
    emptyCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

    // detail
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    backRowText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? theme.colors.border : theme.colors.borderLight,
      marginBottom: 14,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    summaryAccent: { width: 4 },
    summaryInner: { flex: 1, padding: 14, gap: 10 },
    summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    detailTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.textStrong },
    summaryDates: { fontSize: 13, color: theme.colors.textSecondary },
    summaryMetaLine: { fontSize: 12.5, color: theme.colors.textSecondary },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 2,
    },
    progressStep: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    progressDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressLabel: { fontSize: 11.5, fontWeight: '700' },
    progressLine: { flex: 1, height: 2, marginHorizontal: 8, borderRadius: 1 },
    quietActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 2,
    },
    quietActionText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },
    quietActionDot: { fontSize: 12.5, color: theme.colors.textTertiary },
    nextStepCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? theme.colors.border : theme.colors.borderLight,
      padding: 14,
      marginBottom: 16,
    },
    nextStepTitle: { fontSize: 14.5, fontWeight: '700', color: theme.colors.textStrong },
    nextStepSub: { fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 17 },
    nextStepAlt: { marginTop: 6 },
    nextStepBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 12,
    },
    nextStepBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 13,
      paddingVertical: 12,
    },
    generateBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    compactWarn: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: `${theme.colors.warning}12`,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 10,
    },
    compactWarnText: { flex: 1, fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary },

    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionIconChip: {
      width: 24,
      height: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}12`,
    },
    sectionHeaderText: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      color: theme.colors.textStrong,
    },
    infoNote: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      backgroundColor: theme.colors.alertBg,
      borderWidth: 1,
      borderColor: theme.colors.alertBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
    },
    infoNoteText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.colors.alertText },

    dateGroup: { marginBottom: 16 },
    dateHeader: {
      fontSize: 11.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textTertiary,
      marginBottom: 6,
      marginLeft: 4,
    },
    dateCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? theme.colors.border : theme.colors.borderLight,
      overflow: 'hidden',
    },
    paperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
      minHeight: 56,
    },
    paperRowBorder: { borderTopWidth: 1, borderTopColor: isDark ? theme.colors.border : theme.colors.borderLight },
    subjectTile: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    paperTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    classChip: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.background,
      borderRadius: 7,
      paddingHorizontal: 7,
      paddingVertical: 2.5,
    },
    classChipText: { fontSize: 10.5, fontWeight: '700', color: theme.colors.textSecondary },
    paperSubject: {
      flexShrink: 1,
      fontSize: 14.5,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: theme.colors.textStrong,
    },
    paperMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
    paperMeta: { fontSize: 11.5, fontWeight: '500', color: theme.colors.textSecondary },
    paperMetaDot: { fontSize: 11.5, color: theme.colors.textTertiary, marginHorizontal: 2 },
    editHint: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
    },

    // seating rows
    roomCount: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2, color: theme.colors.textStrong },
    roomCountTotal: { fontSize: 11, fontWeight: '600', color: theme.colors.textTertiary },
    capacityTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : theme.colors.borderLight,
      marginTop: 6,
      overflow: 'hidden',
    },
    capacityFill: { height: 4, borderRadius: 2 },
    invigAvatar: {
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}18`,
    },
    invigAvatarText: { fontSize: 9, fontWeight: '800', color: theme.colors.primary },

    // seating & invigilation
    seatingHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingRight: 4,
      gap: 8,
    },
    seatingHeaderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    seatingSummary: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, flexShrink: 1 },
    seatingLink: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },
    seatingEmptyCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? theme.colors.border : theme.colors.borderLight,
      padding: 14,
      gap: 12,
    },
    seatingEmptyText: { fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary },
    seatingEmptyActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    inlinePrimaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
    },
    inlinePrimaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    allocateCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      paddingVertical: 11,
      marginTop: 4,
    },
    allocateCtaText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
    sittingBlock: { marginBottom: 10 },
    sittingLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginBottom: 4,
      marginLeft: 4,
    },
    invigilatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
    },
    invigilatorText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textStrong },
    seatNo: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.primary,
      minWidth: 24,
      textAlign: 'center',
    },

    publishBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingBottom: Platform.OS === 'ios' ? 28 : 14,
      backgroundColor: theme.colors.card,
      borderTopWidth: 1,
      borderTopColor: isDark ? theme.colors.border : theme.colors.borderLight,
    },
    publishStateDot: { width: 8, height: 8, borderRadius: 4 },
    publishTitle: { fontSize: 13.5, fontWeight: '700', letterSpacing: -0.1, color: theme.colors.textStrong },
    publishSub: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 1 },
    publishBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 13,
    },
    unpublishBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    publishBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    unpublishBtnText: { color: theme.colors.text, fontSize: 13.5, fontWeight: '600' },
    disabledBtn: { opacity: 0.5 },

    // modals
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.55)',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 22,
      padding: 20,
      maxHeight: '86%',
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
      gap: 8,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 24px 60px rgba(2,6,23,0.35)' } as any)
        : Platform.OS === 'ios'
          ? { shadowColor: '#020617', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.3, shadowRadius: 40 }
          : { elevation: 10 }),
    },
    modalCardTall: { minHeight: 420 },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
      gap: 12,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.textStrong },
    hallTicketModalExam: {
      marginTop: 3,
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    hallTicketLoading: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    signatureModalSubtitle: {
      marginTop: 3,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    signatureLoading: {
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signaturePreview: {
      minHeight: 170,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    signaturePreviewImage: {
      width: '100%',
      height: 130,
    },
    signatureEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    signatureEmptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}12`,
      marginBottom: 10,
    },
    signatureEmptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textStrong,
    },
    signatureEmptyText: {
      marginTop: 4,
      fontSize: 11.5,
      color: theme.colors.textTertiary,
      textAlign: 'center',
    },
    signatureActions: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 8,
    },
    signatureUploadBtn: {
      flexGrow: 1,
      maxWidth: 260,
      marginTop: 0,
    },
    signatureRemoveBtn: {
      minHeight: 42,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${theme.colors.danger}32`,
      backgroundColor: `${theme.colors.danger}0C`,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    signatureRemoveText: {
      color: theme.colors.danger,
      fontSize: 12.5,
      fontWeight: '700',
    },
    hallTicketInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: `${theme.colors.primary}0D`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}22`,
    },
    hallTicketInfoText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textSecondary,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
      marginTop: 14,
      marginBottom: 8,
    },
    inputSubLabel: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 5,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    chipActive: {
      backgroundColor: `${theme.colors.primary}18`,
      borderColor: theme.colors.primary,
    },
    chipText: { fontSize: 13, fontWeight: '500', color: theme.colors.text },
    chipTextActive: { color: theme.colors.primary, fontWeight: '700' },
    input: { marginBottom: 0 },
    rowTwo: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    helperText: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 10, lineHeight: 17 },
    subjectHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      marginBottom: 8,
    },
    helperInline: { fontSize: 11, color: theme.colors.textTertiary },
    subjectList: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      overflow: 'hidden',
    },
    subjectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minHeight: 44,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
      backgroundColor: theme.colors.card,
    },
    subjectRowOff: { backgroundColor: theme.colors.background },
    subjectToggle: { padding: 2 },
    subjectOrderNum: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.primary,
      minWidth: 18,
      textAlign: 'center',
    },
    subjectName: { fontSize: 14, fontWeight: '600', color: theme.colors.textStrong },
    subjectNameOff: { color: theme.colors.textTertiary, fontWeight: '500' },
    subjectHint: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
    orderArrows: { flexDirection: 'row', gap: 2 },
    orderArrowBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
    },
    sessionLabel: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      width: 84,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      minHeight: 32,
    },
    switchLabel: { fontSize: 14, fontWeight: '500', color: theme.colors.text },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepperBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    stepperValue: { fontSize: 15, fontWeight: '700', color: theme.colors.textStrong, minWidth: 18, textAlign: 'center' },
    segment: { flexDirection: 'row', gap: 8 },
    segmentItem: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      padding: 10,
      gap: 3,
    },
    segmentItemActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}12`,
    },
    segmentLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
    segmentLabelActive: { color: theme.colors.primary },
    segmentHint: { fontSize: 11, color: theme.colors.textTertiary, lineHeight: 15 },
    segmentHintActive: { color: theme.colors.textSecondary },
    modalPrimaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 13,
      paddingVertical: 13,
      marginTop: 14,
    },
    modalPrimaryBtnText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
    modalDangerBtn: {
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: `${theme.colors.danger}55`,
      marginTop: 14,
    },
    syllabusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    syllabusMarks: { width: 84 },
    syllabusRemove: { padding: 2 },
    syllabusAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: `${theme.colors.primary}55`,
      borderStyle: 'dashed',
      paddingVertical: 9,
      marginTop: 2,
    },
    lockNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.alertBg,
      borderWidth: 1,
      borderColor: theme.colors.alertBorder,
      borderRadius: 10,
      padding: 10,
      marginTop: 4,
    },
    lockNoteText: { flex: 1, fontSize: 12, color: theme.colors.alertText, lineHeight: 16 },
  });
