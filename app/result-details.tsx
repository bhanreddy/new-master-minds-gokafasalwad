// OPT: Student result drill-in — data via useStudentQuery (profile + list + detail) instead of useEffect + StudentService/ResultService.
import React, { useMemo, useCallback, memo } from 'react'; // OPT: Removed useEffect; added memo for display slices.
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Platform } from 'react-native'; // OPT: Same RN primitives; screen orchestration only.
import { useLocalSearchParams, useRouter } from 'expo-router'; // OPT: Unchanged routing.
import { LinearGradient } from 'expo-linear-gradient'; // OPT: Unchanged visuals.
import { Ionicons } from '@expo/vector-icons'; // OPT: Ionicons only — avoids extra Material font subset vs tabs screens.
import Animated, { FadeInDown } from 'react-native-reanimated'; // OPT: Unchanged motion.
import StudentHeader from '../src/components/StudentHeader'; // OPT: Unchanged header.
import type { ExamListEntry, StudentResultDetail, SubjectResult } from '../src/services/resultService'; // OPT: Types for list/detail rows.
import { useAuth } from '../src/hooks/useAuth'; // OPT: Role gate for student-only flows.
import { useTheme } from '../src/hooks/useTheme'; // OPT: Unchanged theming.
import type { SchoolTheme } from '../src/theme/types';
import LogoLoader from '../src/components/LogoLoader'; // OPT: Loading UI.
import { useTranslation } from 'react-i18next'; // OPT: Subscribe memo rows + header when language changes.
import { t_field } from '../src/utils/lang'; // OPT: Bilingual fields.
import { useStudentQuery } from '../src/hooks/useStudentQuery'; // OPT: Shared TTL cache + focus refetch.
import type { Student } from '../src/types/models'; // OPT: Profile typing for /students/profile/me.
import { ErrorBoundary } from '../src/components/ErrorBoundary'; // OPT: Same boundary export as Screen/_layout (isolates screen errors).

type ResultsListPayload = ExamListEntry[] | { records: ExamListEntry[] }; // OPT: Supports paginated or legacy array envelope.

type StudentResultApiEnvelope = { // OPT: Matches GET /results/student/:id unwrap shape.
  student: unknown; // OPT: Unused in UI but returned by API.
  results: StudentResultDetail[]; // OPT: First row is the active exam aggregate.
};

const normalizeExamList = (d: ResultsListPayload | null | undefined): ExamListEntry[] => { // OPT: Normalize list endpoint variants.
  if (!d) return []; // OPT: Empty when not yet loaded.
  if (Array.isArray(d)) return d; // OPT: Legacy array response.
  return d.records ?? []; // OPT: Paginated { records, meta }.
};

const ExamListCard = memo(function ExamListCard({ // OPT: Pure row — memoized to limit list re-renders.
  exam,
  index,
  styles,
  onOpen,
  formatDateStr,
  gradeForPct,
}: {
  exam: ExamListEntry; // OPT: One exam summary row.
  index: number; // OPT: Stagger index for animation.
  styles: ReturnType<typeof getStyles>;
  onOpen: (e: ExamListEntry) => void; // OPT: Stable callback from parent useCallback.
  formatDateStr: (s: string) => string; // OPT: Pure formatter from parent useCallback.
  gradeForPct: (n: number) => string; // OPT: Pure grade helper from parent useCallback.
}) {
  useTranslation(); // OPT: Re-render on language change so t_field(exam name) updates.
  const onPress = useCallback(() => onOpen(exam), [onOpen, exam]); // OPT: Stable press handler for TouchableOpacity.
  return (
    <Animated.View entering={FadeInDown.delay(100 * index)}>
      <TouchableOpacity style={styles.examCard} onPress={onPress}>
        <View style={styles.examHeader}>
          <Text style={styles.examTitle}>{t_field(exam.name, exam.name_te)}</Text>
          <Text style={styles.examDate}>{formatDateStr(exam.start_date)}</Text>
        </View>
        <View style={styles.examStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Subjects</Text>
            <Text style={styles.statValue}>{exam.subjects_count}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Percentage</Text>
            <Text style={[styles.statValue, { color: exam.percentage >= 35 ? '#10B981' : '#EF4444' }]}>{exam.percentage}%</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Grade</Text>
            <Text style={styles.statValue}>{gradeForPct(exam.percentage)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SubjectBreakdownRow = memo(function SubjectBreakdownRow({ // OPT: Pure subject row in detail view.
  item,
  index,
  styles,
}: {
  item: SubjectResult; // OPT: Align with API subject row shape.
  index: number;
  styles: ReturnType<typeof getStyles>;
}) {
  useTranslation(); // OPT: Re-render on language change so t_field(subject) updates.
  return (
    <Animated.View key={item.subject} entering={FadeInDown.delay(300 + index * 100).duration(600)} style={styles.resultItem}>
      <View style={[styles.iconBox, { backgroundColor: item.is_absent ? '#FEE2E2' : '#EFF6FF' }]}>
        <Ionicons name={item.is_absent ? 'close-circle' : 'book-outline'} size={24} color={item.is_absent ? '#EF4444' : '#3B82F6'} />
      </View>
      <View style={styles.contentBox}>
        <View style={styles.row}>
          <Text style={styles.subjectName}>{t_field(item.subject, item.subject_te || item.name_te)}</Text>
          <Text style={styles.scoreText}>
            {item.is_absent ? (
              <Text style={[styles.scoreValue, { color: '#EF4444' }]}>Absent</Text>
            ) : (
              <>
                <Text style={[styles.scoreValue, { color: '#1F2937' }]}>{item.marks_obtained}</Text>
                <Text style={styles.scoreTotal}> / {item.max_marks}</Text>
              </>
            )}
          </Text>
        </View>
        {!item.is_absent ? (
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${(item.marks_obtained / item.max_marks) * 100}%`, backgroundColor: item.passed ? '#10B981' : '#EF4444' }]} />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
});

const SummaryGradientCard = memo(function SummaryGradientCard({ // OPT: Memoized summary header in detail mode.
  detail,
  styles,
  gradeForPct,
}: {
  detail: StudentResultDetail;
  styles: ReturnType<typeof getStyles>;
  gradeForPct: (n: number) => string;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.summaryCard}>
      <LinearGradient colors={['#1F2937', '#111827']} style={styles.gradientCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.summaryContent}>
          <View>
            <Text style={styles.summaryLabel}>Overall Percentage</Text>
            <Text style={styles.percentageText}>{detail.percentage}%</Text>
            <Text style={styles.gradeText}>Grade: {gradeForPct(detail.percentage)}</Text>
          </View>
          <View style={styles.circularProgress}>
            <Text style={styles.totalScoreText}>{detail.total_obtained}</Text>
            <Text style={styles.maxScoreText}>/ {detail.total_max}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

function ResultDetailsInner() { // OPT: Split inner tree so ErrorBoundary can wrap a single child subtree.
  useTranslation(); // OPT: Re-render on language change so t_field(detail header) updates.
  const { theme } = useTheme(); // OPT: Theme for styles.
  const styles = React.useMemo(() => getStyles(theme), [theme]); // OPT: Stable StyleSheet per theme.
  const { type, title, examId } = useLocalSearchParams(); // OPT: Route params drive which queries are enabled.
  const router = useRouter(); // OPT: Navigation for list → detail.
  const { user } = useAuth(); // OPT: Auth context for student gate + cache user key.
  const roleCode = typeof user?.role === 'object' && user?.role !== null ? (user.role as { code: string }).code : user?.role; // OPT: Normalize role.
  const isStudent = roleCode === 'student'; // OPT: Student-only screen behavior.

  const { data: profile, loading: profileLoading } = useStudentQuery<Student>( // OPT: Cached profile (shared key with tabs).
    '/students/profile/me', // OPT: Canonical profile endpoint.
    'profile', // OPT: Shared cache suffix with other student screens.
    3 * 60 * 1000, // OPT: 3m TTL matches other student surfaces.
    user?.userId, // OPT: Per-user cache partition.
    { enabled: !!user?.userId && isStudent } // OPT: Skip fetch for non-students.
  );

  const pid = profile?.id; // OPT: Student UUID for results routes.

  const needsList = Boolean(pid && type && !examId); // OPT: List mode when category selected without examId.
  const listEndpoint = pid ? `/results/list/student/${pid}` : '/notices'; // OPT: Placeholder path when disabled (never fetched).
  const { data: listPayload, loading: listLoading } = useStudentQuery<ResultsListPayload>( // OPT: Exam list for a type.
    listEndpoint, // OPT: Dynamic student segment when pid known.
    `results:list:${pid}:${String(type)}`, // OPT: Cache key includes student + exam type.
    90 * 1000, // OPT: Shorter TTL for results lists.
    user?.userId, // OPT: Cache partition.
    { enabled: needsList, query: { exam_type: String(type) } } // OPT: Required exam_type query param.
  );

  const listRows = useMemo(() => normalizeExamList(listPayload), [listPayload]); // OPT: Derived list rows.

  const singleAutoExamId = !examId && listRows.length === 1 ? listRows[0].id : ''; // OPT: Auto-drill when exactly one exam.
  const effectiveExamId = (examId as string) || singleAutoExamId || ''; // OPT: Prefer explicit route examId.

  const needsDetail = Boolean(pid && effectiveExamId); // OPT: Detail when we know exam id (route or auto).
  const detailEndpoint = pid ? `/results/student/${pid}` : '/notices'; // OPT: Placeholder when disabled.
  const { data: detailEnvelope, loading: detailLoading } = useStudentQuery<StudentResultApiEnvelope>( // OPT: Aggregated marks for one exam.
    detailEndpoint, // OPT: Student-scoped results endpoint.
    `results:detail:${pid}:${effectiveExamId}`, // OPT: Distinct cache entry per exam.
    90 * 1000, // OPT: TTL for exam detail payload.
    user?.userId, // OPT: Cache partition.
    { enabled: needsDetail, query: { exam_id: effectiveExamId } } // OPT: exam_id filter on server.
  );

  const detail = detailEnvelope?.results?.[0] ?? null; // OPT: Primary row is the exam block.

  const loading = // OPT: Avoid flashing "not found" while the second hop loads for single-exam categories.
    profileLoading || // OPT: Profile gate.
    (needsList && listLoading) || // OPT: List fetch in flight.
    (Boolean(effectiveExamId) && detailLoading && !detail); // OPT: Detail fetch in flight until first row exists.

  const gradeForPct = useCallback((pct: number) => { // OPT: Stable helper for memo children.
    if (pct >= 90) return 'A+'; // OPT: Grade ladder.
    if (pct >= 80) return 'A'; // OPT:
    if (pct >= 70) return 'B'; // OPT:
    if (pct >= 60) return 'C'; // OPT:
    return 'D'; // OPT:
  }, []); // OPT: No deps — pure function.

  const formatDateStr = useCallback((dateString: string) => { // OPT: Stable date formatter for memo list cards.
    if (!dateString) return ''; // OPT: Guard empty.
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); // OPT: Compact display.
  }, []); // OPT: No external deps.

  const handleExamPress = useCallback( // OPT: Stable navigation callback for list items.
    (exam: ExamListEntry) => { // OPT: Target exam row.
      router.push({ pathname: '/result-details', params: { examId: exam.id, title: exam.name } }); // OPT: Deep-link into same screen with examId.
    },
    [router] // OPT: router identity stable enough from expo-router.
  );

  if (!user?.userId || !isStudent) { // OPT: Non-student short-circuit.
    return (
      <View style={styles.container}>
        <StudentHeader showBackButton title={(title as string) || 'Results'} />
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Access denied.</Text>
        </View>
      </View>
    );
  }

  if (loading) { // OPT: Single loader for all dependent queries.
    return (
      <View style={styles.container}>
        <StudentHeader showBackButton title={(title as string) || 'Loading...'} />
        <View style={styles.centerContainer}>
          <LogoLoader size={60} color="#4F46E5" />
        </View>
      </View>
    );
  }

  if (detail) { // OPT: Prefer detail when payload exists (covers route examId + auto single-exam).
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <StudentHeader showBackButton title={t_field(detail.exam_name, detail.exam_name_te) || (title as string) || 'Result Details'} />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SummaryGradientCard detail={detail} styles={styles} gradeForPct={gradeForPct} />
          <View style={styles.listContainer}>
            <Text style={styles.sectionTitle}>Subject Breakdown</Text>
            {(detail?.subjects || []).map((item: any, index: number) => (
              <SubjectBreakdownRow key={`${item.subject}-${index}`} item={item} index={index} styles={styles} />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (needsList && !listLoading && listRows.length === 0) { // OPT: Empty category after list settled.
    return (
      <View style={styles.container}>
        <StudentHeader showBackButton title={(title as string) || 'Results'} />
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No exams found for this category.</Text>
        </View>
      </View>
    );
  }

  if (needsList && listRows.length > 1) { // OPT: Multi-exam list (pick one).
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <StudentHeader showBackButton title={(title as string) || 'Results'} />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.listContainer}>
            {listRows.map((exam, index) => (
              <ExamListCard key={exam.id} exam={exam} index={index} styles={styles} onOpen={handleExamPress} formatDateStr={formatDateStr} gradeForPct={gradeForPct} />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (needsList && listRows.length === 1 && !detailLoading && !detail) { // OPT: Single exam but API returned no detail row.
    return (
      <View style={styles.container}>
        <StudentHeader showBackButton title={(title as string) || 'Result Details'} />
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Result details not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StudentHeader showBackButton title={(title as string) || 'Results'} />
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Select a result category from the Results tab.</Text>
      </View>
    </View>
  );
}

export default function ResultDetails() { // OPT: Default export wraps inner screen with ErrorBoundary per request.
  return (
    <ErrorBoundary>
      <ResultDetailsInner />
    </ErrorBoundary>
  );
}

const getStyles = (theme: SchoolTheme) => {
  const c = theme.colors;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: Platform.OS === 'android' ? 30 : 0 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 16, color: c.textSecondary },
    examCard: {
      backgroundColor: c.background,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: c.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
    },
    examHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    examTitle: { fontSize: 18, fontWeight: 'bold', color: c.textStrong },
    examDate: { fontSize: 14, color: c.textSecondary },
    examStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: c.card,
      padding: 12,
      borderRadius: 12,
    },
    statItem: { alignItems: 'center', flex: 1 },
    statDivider: { width: 1, height: 24, backgroundColor: c.border },
    statLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: 'bold', color: c.textStrong },
    summaryCard: {
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 30,
      elevation: 10,
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    },
    gradientCard: { padding: 25, minHeight: 160, justifyContent: 'center' },
    summaryContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '500', marginBottom: 5 },
    percentageText: { fontSize: 48, fontWeight: 'bold', color: '#FFFFFF', includeFontPadding: false },
    gradeText: {
      color: '#10B981',
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 5,
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    circularProgress: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 8,
      borderColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    totalScoreText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
    maxScoreText: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
    listContainer: { gap: 15 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: c.textStrong, marginBottom: 10 },
    resultItem: {
      flexDirection: 'row',
      backgroundColor: c.background,
      padding: 15,
      borderRadius: 16,
      alignItems: 'center',
      gap: 15,
      shadowColor: c.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    iconBox: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    contentBox: { flex: 1, gap: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    subjectName: { fontSize: 16, fontWeight: '600', color: c.textStrong },
    scoreText: { fontSize: 14 },
    scoreValue: { fontWeight: 'bold', fontSize: 16 },
    scoreTotal: { color: c.textMuted, fontSize: 12 },
    progressBarBg: { height: 6, backgroundColor: c.card, borderRadius: 3, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 3 },
  });
};
