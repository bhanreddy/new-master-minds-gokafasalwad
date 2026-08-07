import React, { useMemo, useState } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../src/constants/adminTheme';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { StudentService } from '../../src/services/studentService';
import {
  SCHOOL_CONFIG,
  schoolColorWithAlpha,
  schoolTheme,
} from '@/src/constants/schoolConfig';
import { Image } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

// --- Types ---
interface SubjectMark {
  subject: string;
  maxMarks: number;
  passingMarks?: number;
  obtained: number | null;
  grade: string;
  is_absent?: boolean;
  hasMarks?: boolean;
}

interface ExamResult {
  exam_id: string;
  exam_name: string;
  exam_type: string;
  subjects: SubjectMark[];
}

interface StudentResult {
  id: string;
  admissionNo: string;
  name: string;
  fatherName: string;
  motherName: string;
  class: string;
  rollNo: string;
  dob: string;
  academicYear: string;
  attendance: string;
  attendanceDetail: string;
  exams: ExamResult[];
  selectedExamIndex: number;
  marks: SubjectMark[];
  totalMax: number;
  totalObtained: number;
  percentage: number;
  result: 'PASS' | 'FAIL' | 'PENDING';
  division: string;
  gradedSubjects: number;
  pendingSubjects: number;
}

function formatDob(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function subjectHasScore(m: SubjectMark): boolean {
  return Boolean(m.hasMarks) && !m.is_absent && m.obtained != null;
}

function formatObtained(m: SubjectMark): string {
  if (m.is_absent) return 'AB';
  if (!m.hasMarks || m.obtained == null) return '—';
  const n = Number(m.obtained);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function computeSummary(marks: SubjectMark[]) {
  let totalMax = 0;
  let totalObtained = 0;
  let hasFailed = false;
  let gradedSubjects = 0;
  let pendingSubjects = 0;

  marks.forEach((m) => {
    if (!m.hasMarks && !m.is_absent) {
      pendingSubjects += 1;
      return;
    }
    gradedSubjects += 1;
    totalMax += m.maxMarks;
    if (m.is_absent) {
      hasFailed = true;
      return;
    }
    const obtained = Number(m.obtained ?? 0);
    totalObtained += obtained;
    const passingMarks = m.passingMarks || Math.round(m.maxMarks * 0.35);
    if (obtained < passingMarks) hasFailed = true;
  });

  if (gradedSubjects === 0) {
    return {
      totalMax: marks.reduce((s, m) => s + m.maxMarks, 0),
      totalObtained: 0,
      percentage: 0,
      result: 'PENDING' as const,
      division: '—',
      gradedSubjects: 0,
      pendingSubjects: marks.length,
    };
  }

  const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const result: 'PASS' | 'FAIL' = hasFailed ? 'FAIL' : 'PASS';
  let division = '—';
  if (result === 'PASS') {
    if (percentage >= 75) division = 'Distinction';
    else if (percentage >= 60) division = 'First Class';
    else if (percentage >= 50) division = 'Second Class';
    else division = 'Third Class';
  }

  return {
    totalMax,
    totalObtained: parseFloat(totalObtained.toFixed(2)),
    percentage: parseFloat(percentage.toFixed(2)),
    result,
    division,
    gradedSubjects,
    pendingSubjects,
  };
}

function normalizeSubjects(raw: any[]): SubjectMark[] {
  return (raw || []).map((sm) => {
    const hasMarks =
      typeof sm.hasMarks === 'boolean'
        ? sm.hasMarks
        : sm.obtained != null || sm.is_absent === true;
    return {
      subject: sm.subject,
      maxMarks: Number(sm.maxMarks) || 0,
      passingMarks: Number(sm.passingMarks) || undefined,
      obtained: hasMarks && !sm.is_absent ? Number(sm.obtained) : null,
      grade: sm.grade || (sm.is_absent ? 'AB' : '—'),
      is_absent: Boolean(sm.is_absent),
      hasMarks,
    };
  });
}

// -------------------------------------------------------------------
// buildReportHTML — compact A4 letterhead for print / PDF
// -------------------------------------------------------------------
function buildReportHTML(
  resultData: StudentResult,
  schoolConfig: typeof SCHOOL_CONFIG,
  logoDataUri: string
): string {
  const c = schoolTheme.light.colors;
  const ribbon = schoolConfig.theme;
  const examName =
    resultData.exams[resultData.selectedExamIndex]?.exam_name?.toUpperCase() ||
    'PROGRESS REPORT';
  const isPass = resultData.result === 'PASS';
  const isPending = resultData.result === 'PENDING';
  const badgeColor = isPending ? c.warning : isPass ? c.success : c.danger;
  const badgeBg = isPending
    ? schoolColorWithAlpha(c.warning, 0.16)
    : isPass
      ? schoolColorWithAlpha(c.success, 0.16)
      : schoolColorWithAlpha(c.danger, 0.14);

  const tableRows = resultData.marks
    .map((m, i) => {
      const scored = subjectHasScore(m);
      const passMark = m.passingMarks || Math.round(m.maxMarks * 0.35);
      const isFail = scored && Number(m.obtained) < passMark;
      const color = m.is_absent || isFail ? c.danger : c.textPrimary;
      const bg = i % 2 === 0 ? schoolColorWithAlpha(c.primary, 0.04) : '#fff';
      return `
      <tr style="background:${bg}">
        <td class="sub">${escapeHtml(m.subject)}</td>
        <td>${m.maxMarks}</td>
        <td style="color:${color};font-weight:${isFail || m.is_absent ? '700' : '600'}">${formatObtained(m)}</td>
        <td>${escapeHtml(m.grade || '—')}</td>
      </tr>`;
    })
    .join('');

  const contactLine = [
    schoolConfig.address,
    schoolConfig.contact ? `Ph: ${schoolConfig.contact}` : '',
    schoolConfig.email || '',
  ]
    .filter(Boolean)
    .join('  ·  ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Progress Report - ${escapeHtml(resultData.name)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: ${c.textPrimary}; background: #fff;
      font-size: 11.5px; line-height: 1.35;
    }
    .sheet { position: relative; min-height: 100%; }
    .wm {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 0; pointer-events: none; opacity: 0.07;
    }
    .wm img { width: 340px; height: 340px; object-fit: contain; }
    .content { position: relative; z-index: 1; }

    .letterhead {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 14px 10px;
      background: linear-gradient(135deg, ${ribbon.ribbonGradient[0]}, ${ribbon.ribbonGradient[1]} 55%, ${ribbon.ribbonGradient[2]});
      color: #fff; border-radius: 6px 6px 0 0;
    }
    .logo {
      width: 52px; height: 52px; border-radius: 50%;
      background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; flex-shrink: 0;
    }
    .logo img { width: 42px; height: 42px; object-fit: contain; }
    .lh-text { flex: 1; text-align: center; }
    .school { font-size: 18px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; }
    .tagline { font-size: 10px; color: ${ribbon.ribbonTagline}; margin-top: 2px; font-weight: 600; }
    .contact { font-size: 9.5px; color: rgba(255,255,255,0.9); margin-top: 4px; }

    .accent { height: 3px; background: ${ribbon.accent}; }

    .title-band {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 10px 4px 8px; border-bottom: 1.5px solid ${c.border};
      margin-bottom: 10px;
    }
    .exam-title {
      font-size: 13px; font-weight: 800; letter-spacing: 1.4px;
      color: ${c.primaryDark}; text-transform: uppercase;
    }
    .year { font-size: 11px; color: ${c.textSecondary}; font-weight: 600; }

    .info {
      display: grid; grid-template-columns: 1fr 1fr 1fr;
      gap: 6px 14px; padding: 10px 12px; margin-bottom: 12px;
      border: 1px solid ${c.border}; border-radius: 6px;
      background: ${schoolColorWithAlpha(c.primary, 0.03)};
    }
    .info .lab {
      font-size: 9px; font-weight: 700; letter-spacing: 0.6px;
      text-transform: uppercase; color: ${c.textMuted};
    }
    .info .val { font-size: 12px; font-weight: 700; color: ${c.textStrong}; margin-top: 1px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    thead th {
      background: ${c.primaryDark}; color: #fff;
      padding: 7px 8px; font-size: 10.5px; font-weight: 700;
      text-align: center; letter-spacing: 0.3px;
    }
    thead th:first-child { text-align: left; border-radius: 4px 0 0 0; }
    thead th:last-child { border-radius: 0 4px 0 0; }
    td { padding: 6px 8px; text-align: center; font-size: 11.5px; border-bottom: 1px solid ${c.borderLight}; }
    td.sub { text-align: left; font-weight: 600; }

    .summary {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
      margin-bottom: 28px;
    }
    .stat {
      border: 1px solid ${c.border}; border-radius: 6px;
      padding: 8px 10px; text-align: center;
      background: #fff;
    }
    .stat .lab { font-size: 9px; font-weight: 700; text-transform: uppercase; color: ${c.textMuted}; letter-spacing: 0.5px; }
    .stat .val { font-size: 14px; font-weight: 800; color: ${c.textStrong}; margin-top: 2px; }
    .badge {
      display: inline-block; background: ${badgeBg}; color: ${badgeColor};
      padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;
    }

    .sigs {
      display: flex; justify-content: space-between; gap: 16px;
      margin-top: 36px; padding: 0 6px;
    }
    .sig { width: 28%; text-align: center; }
    .sig-line { border-bottom: 1px solid ${c.textMuted}; height: 28px; margin-bottom: 6px; }
    .sig-lab { font-size: 10px; font-weight: 700; color: ${c.textSecondary}; text-transform: uppercase; letter-spacing: 0.4px; }

    .footnote {
      margin-top: 16px; text-align: center; font-size: 9px; color: ${c.textMuted};
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="wm"><img src="${logoDataUri}" alt="" /></div>
    <div class="content">
      <div class="letterhead">
        <div class="logo"><img src="${logoDataUri}" alt="logo" /></div>
        <div class="lh-text">
          <div class="school">${escapeHtml(schoolConfig.name)}</div>
          ${schoolConfig.tagline ? `<div class="tagline">${escapeHtml(schoolConfig.tagline)}</div>` : ''}
          <div class="contact">${escapeHtml(contactLine)}</div>
        </div>
        <div style="width:52px;flex-shrink:0"></div>
      </div>
      <div class="accent"></div>

      <div class="title-band">
        <div class="exam-title">${escapeHtml(examName)}</div>
        <div class="year">Academic Year ${escapeHtml(resultData.academicYear)}</div>
      </div>

      <div class="info">
        <div><div class="lab">Student Name</div><div class="val">${escapeHtml(resultData.name)}</div></div>
        <div><div class="lab">Class &amp; Section</div><div class="val">${escapeHtml(resultData.class)}</div></div>
        <div><div class="lab">Roll No</div><div class="val">${escapeHtml(resultData.rollNo)}</div></div>
        <div><div class="lab">Admission No</div><div class="val">${escapeHtml(resultData.admissionNo)}</div></div>
        <div><div class="lab">Father's Name</div><div class="val">${escapeHtml(resultData.fatherName)}</div></div>
        <div><div class="lab">Date of Birth</div><div class="val">${escapeHtml(resultData.dob)}</div></div>
        <div><div class="lab">Attendance</div><div class="val">${escapeHtml(resultData.attendance)}</div></div>
        <div><div class="lab">Mother / Guardian</div><div class="val">${escapeHtml(resultData.motherName)}</div></div>
        <div><div class="lab">Exam</div><div class="val">${escapeHtml(resultData.exams[resultData.selectedExamIndex]?.exam_name || '—')}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Max Marks</th>
            <th>Obtained</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <div class="summary">
        <div class="stat">
          <div class="lab">Total Marks</div>
          <div class="val">${resultData.totalObtained} / ${resultData.totalMax}</div>
        </div>
        <div class="stat">
          <div class="lab">Percentage</div>
          <div class="val">${resultData.percentage}%</div>
        </div>
        <div class="stat">
          <div class="lab">Result</div>
          <div class="val"><span class="badge">${escapeHtml(resultData.result)}</span></div>
        </div>
        <div class="stat">
          <div class="lab">Division</div>
          <div class="val">${escapeHtml(isPass ? resultData.division : '—')}</div>
        </div>
      </div>

      <div class="sigs">
        <div class="sig"><div class="sig-line"></div><div class="sig-lab">Class Teacher</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-lab">Principal</div></div>
        <div class="sig"><div class="sig-line"></div><div class="sig-lab">Parent / Guardian</div></div>
      </div>
      <div class="footnote">Computer-generated progress report · ${escapeHtml(schoolConfig.name)}</div>
    </div>
  </div>
</body>
</html>`;
}

async function getLogoDataUri(): Promise<string> {
  const { bundledAssetToBase64Uri } = await import('../../src/utils/toBase64Uri');
  return (
    (await bundledAssetToBase64Uri(
      require('../../assets/images/icon.png'),
      'image/png'
    )) ?? ''
  );
}

export default function ProgressReportGenerator() {
  const { theme, isDark } = useTheme();
  const schoolColors = isDark ? schoolTheme.dark.colors : schoolTheme.light.colors;
  const styles = useMemo(
    () => getStyles(theme, schoolColors, isDark),
    [theme, schoolColors, isDark]
  );

  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState<StudentResult | null>(null);

  const buildStudentResult = (
    studentMeta: {
      id: string;
      admissionNo: string;
      name: string;
      fatherName: string;
      motherName: string;
      classLabel: string;
      rollNo: string;
      dob: string;
    },
    resultsResponse: any,
    selectedIndex = 0
  ): StudentResult => {
    const exams: ExamResult[] = (resultsResponse?.exams || []).map((ex: any) => ({
      exam_id: ex.exam_id,
      exam_name: ex.exam_name,
      exam_type: ex.exam_type,
      subjects: normalizeSubjects(ex.subjects || []),
    }));

    const attendanceData = resultsResponse?.attendance;
    const academicYear = resultsResponse?.academic_year || 'N/A';
    let attendanceStr = '—';
    let attendanceDetail = 'No attendance records';
    if (attendanceData && attendanceData.total > 0) {
      attendanceStr = `${attendanceData.percentage}%`;
      attendanceDetail = `${attendanceData.present + attendanceData.late}/${attendanceData.total} days`;
    }

    const selectedMarks = exams.length > 0 ? exams[selectedIndex]?.subjects || [] : [];
    const summary =
      selectedMarks.length > 0
        ? computeSummary(selectedMarks)
        : {
            totalMax: 0,
            totalObtained: 0,
            percentage: 0,
            result: 'PENDING' as const,
            division: '—',
            gradedSubjects: 0,
            pendingSubjects: 0,
          };

    return {
      id: studentMeta.id,
      admissionNo: studentMeta.admissionNo,
      name: studentMeta.name,
      fatherName: studentMeta.fatherName,
      motherName: studentMeta.motherName,
      class: studentMeta.classLabel,
      rollNo: studentMeta.rollNo,
      dob: studentMeta.dob,
      academicYear,
      attendance: attendanceStr,
      attendanceDetail,
      exams,
      selectedExamIndex: selectedIndex,
      marks: selectedMarks,
      ...summary,
    };
  };

  const handleSearch = async () => {
    if (!studentId.trim()) {
      alertCompat('Error', 'Please enter Admission No, Roll No, or student name');
      return;
    }
    setLoading(true);
    setResultData(null);
    try {
      let student: any = null;
      const searchResults = await StudentService.search(studentId, 5, {
        lifecycle: 'all',
      });
      if (searchResults && searchResults.length > 0) {
        const exactMatch = searchResults.find(
          (s: any) =>
            String(s.admission_no || '').toLowerCase() ===
            studentId.trim().toLowerCase()
        );
        student = exactMatch || searchResults[0];
      }

      if (!student) {
        try {
          student = await StudentService.getById(studentId);
        } catch {
          // not found by ID
        }
      }
      if (!student) {
        alertCompat('Error', 'Student not found');
        return;
      }

      const resultsResponse = await StudentService.getResults(student.id).catch(
        () => null
      );

      // Prefer profile from results API (single DB-backed payload)
      const profile = resultsResponse?.student;
      const currentEnrollment = student.current_enrollment;
      const fatherObj = student.parents?.find(
        (p: any) =>
          String(p.relation || p.relationship || '').toLowerCase() === 'father'
      );
      const motherObj = student.parents?.find((p: any) => {
        const rel = String(p.relation || p.relationship || '').toLowerCase();
        return rel === 'mother' || rel === 'guardian';
      });

      const fatherFromList = fatherObj
        ? [fatherObj.first_name, fatherObj.last_name].filter(Boolean).join(' ') ||
          fatherObj.display_name
        : '';
      const motherFromList = motherObj
        ? [motherObj.first_name, motherObj.last_name].filter(Boolean).join(' ') ||
          motherObj.display_name
        : '';

      const cls =
        profile?.class ||
        [
          currentEnrollment?.class_code || currentEnrollment?.class_name,
          currentEnrollment?.section_name,
        ]
          .filter(Boolean)
          .join(' ') ||
        'N/A';

      const data = buildStudentResult(
        {
          id: student.id,
          admissionNo:
            profile?.admission_no || student.admission_no || '—',
          name:
            profile?.name ||
            student.display_name ||
            `${student.first_name || ''} ${student.last_name || ''}`.trim() ||
            'Student',
          fatherName: profile?.father_name || fatherFromList || '—',
          motherName:
            profile?.mother_or_guardian_name || motherFromList || '—',
          classLabel: cls,
          rollNo:
            profile?.roll_number ||
            currentEnrollment?.roll_number?.toString() ||
            '—',
          dob: formatDob(profile?.dob || student.dob),
        },
        resultsResponse,
        0
      );

      setResultData(data);
    } catch {
      alertCompat('Error', 'Student not found or error fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const selectExam = (index: number) => {
    if (!resultData || !resultData.exams[index]) return;
    const selectedMarks = resultData.exams[index].subjects;
    const summary =
      selectedMarks.length > 0
        ? computeSummary(selectedMarks)
        : {
            totalMax: 0,
            totalObtained: 0,
            percentage: 0,
            result: 'PENDING' as const,
            division: '—',
            gradedSubjects: 0,
            pendingSubjects: 0,
          };
    setResultData({
      ...resultData,
      selectedExamIndex: index,
      marks: selectedMarks,
      ...summary,
    });
  };

  const handlePrint = async () => {
    if (!resultData) return;
    if (resultData.exams.length === 0 || resultData.marks.length === 0) {
      alertCompat('Nothing to print', 'No exam marks available for this student.');
      return;
    }
    try {
      const logoDataUri = await getLogoDataUri();
      const html = buildReportHTML(resultData, SCHOOL_CONFIG, logoDataUri);

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank', 'width=900,height=1200');
        if (!printWindow) {
          alertCompat(
            'Print Error',
            'Popup blocked. Please allow popups for this site.'
          );
          return;
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 400);
        printWindow.addEventListener('afterprint', () => {
          try {
            printWindow.close();
          } catch {
            /* ignore */
          }
        });
      } else {
        const Print = await import('expo-print');
        await Print.printAsync({ html });
      }
    } catch (err: any) {
      alertCompat('Print Error', err?.message || 'Could not generate PDF.');
    }
  };

  const renderExamPicker = () => {
    if (!resultData || resultData.exams.length <= 1) return null;
    return (
      <View style={styles.examPickerContainer}>
        <Text style={styles.examPickerLabel}>Select exam</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.examPickerScroll}
        >
          {resultData.exams.map((exam, index) => {
            const active = index === resultData.selectedExamIndex;
            return (
              <Pressable
                key={exam.exam_id}
                style={[styles.examChip, active && styles.examChipActive]}
                onPress={() => selectExam(index)}
              >
                <Text
                  style={[
                    styles.examChipText,
                    active && styles.examChipTextActive,
                  ]}
                >
                  {exam.exam_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderNoResults = () => (
    <Animated.View entering={FadeInDown.springify()} style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name="document-text-outline"
          size={36}
          color={schoolColors.primary}
        />
      </View>
      <Text style={styles.emptyTitle}>No exam papers for this class</Text>
      <Text style={styles.emptySubtitle}>
        {resultData?.name} ({resultData?.class}) has no published exam subjects
        yet for {resultData?.academicYear}.
        {'\n'}Attendance: {resultData?.attendance} ({resultData?.attendanceDetail})
      </Text>
    </Animated.View>
  );

  const renderReportCard = () => {
    if (!resultData) return null;
    if (resultData.exams.length === 0 || resultData.marks.length === 0) {
      return (
        <>
          {renderExamPicker()}
          {renderNoResults()}
        </>
      );
    }

    const isPass = resultData.result === 'PASS';
    const isPending = resultData.result === 'PENDING';

    return (
      <Animated.View entering={FadeInDown.springify()} style={styles.previewWrap}>
        {renderExamPicker()}

        <View style={styles.paperSheet}>
          <LinearGradient
            colors={[
              SCHOOL_CONFIG.theme.ribbonGradient[0],
              SCHOOL_CONFIG.theme.ribbonGradient[1],
              SCHOOL_CONFIG.theme.ribbonGradient[2],
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.letterhead}
          >
            <View style={styles.logoCircle}>
              <Image
                source={SCHOOL_CONFIG.logo}
                style={styles.logoImg}
              />
            </View>
            <View style={styles.letterheadCenter}>
              <Text style={styles.schoolName}>{SCHOOL_CONFIG.name}</Text>
              {!!SCHOOL_CONFIG.tagline && (
                <Text style={styles.tagline}>{SCHOOL_CONFIG.tagline}</Text>
              )}
              <Text style={styles.contactLine} numberOfLines={2}>
                {SCHOOL_CONFIG.address}
              </Text>
            </View>
            <View style={{ width: 44 }} />
          </LinearGradient>
          <View style={styles.accentBar} />

          <View style={styles.titleBand}>
            <Text style={styles.examTitle}>
              {resultData.exams[
                resultData.selectedExamIndex
              ]?.exam_name?.toUpperCase() || 'PROGRESS REPORT'}
            </Text>
            <Text style={styles.yearText}>{resultData.academicYear}</Text>
          </View>

          <View style={styles.detailsGrid}>
            {[
              ['Student', resultData.name],
              ['Class & Sec', resultData.class],
              ['Roll No', resultData.rollNo],
              ['Admission No', resultData.admissionNo],
              ["Father's Name", resultData.fatherName],
              ['D.O.B', resultData.dob],
              ['Attendance', `${resultData.attendance}`],
              ['Mother / Guardian', resultData.motherName],
            ].map(([label, value]) => (
              <View key={label} style={styles.detailItem}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {value}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colSubject, styles.th]}>Subject</Text>
              <Text style={[styles.colMarks, styles.th]}>Max</Text>
              <Text style={[styles.colMarks, styles.th]}>Obt</Text>
              <Text style={[styles.colGrade, styles.th]}>Grade</Text>
            </View>
            {resultData.marks.map((m, i) => {
              const scored = subjectHasScore(m);
              const passingMarks =
                m.passingMarks || Math.round(m.maxMarks * 0.35);
              const isFail = scored && Number(m.obtained) < passingMarks;
              return (
                <View
                  key={`${m.subject}-${i}`}
                  style={[styles.tableRow, i % 2 === 0 && styles.rowAlt]}
                >
                  <Text style={[styles.colSubject, styles.td]}>{m.subject}</Text>
                  <Text style={[styles.colMarks, styles.td]}>{m.maxMarks}</Text>
                  <Text
                    style={[
                      styles.colMarks,
                      styles.td,
                      (isFail || m.is_absent) && styles.textDanger,
                      !scored && !m.is_absent && styles.textMuted,
                    ]}
                  >
                    {formatObtained(m)}
                  </Text>
                  <Text style={[styles.colGrade, styles.td]}>
                    {m.grade || '—'}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>
                {resultData.totalObtained}/{resultData.totalMax}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Percentage</Text>
              <Text style={styles.statValue}>{resultData.percentage}%</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Result</Text>
              <View
                style={[
                  styles.resultBadge,
                  isPending
                    ? styles.badgePending
                    : isPass
                      ? styles.badgePass
                      : styles.badgeFail,
                ]}
              >
                <Text
                  style={[
                    styles.resultText,
                    isPending
                      ? styles.textPending
                      : isPass
                        ? styles.textPass
                        : styles.textFail,
                  ]}
                >
                  {resultData.result}
                </Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Division</Text>
              <Text style={styles.statValue}>
                {isPass ? resultData.division : '—'}
              </Text>
            </View>
          </View>

          {resultData.pendingSubjects > 0 && (
            <Text style={styles.pendingNote}>
              {resultData.pendingSubjects} subject
              {resultData.pendingSubjects === 1 ? '' : 's'} pending marks entry
            </Text>
          )}

          <View style={styles.footerSignatures}>
            {['Class Teacher', 'Principal', 'Parent'].map((label) => (
              <View key={label} style={styles.signBox}>
                <Text style={styles.signLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View pointerEvents="none" style={styles.watermark}>
            <Image
              source={SCHOOL_CONFIG.logo}
              style={styles.watermarkImg}
            />
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[
          schoolColors.background,
          schoolColorWithAlpha(schoolColors.primary, isDark ? 0.18 : 0.08),
        ]}
        style={StyleSheet.absoluteFill}
      />
      <AdminHeader title="Progress Reports" showBackButton />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          resultData?.marks?.length ? { paddingBottom: 110 } : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Animated.View entering={FadeIn.duration(280)} style={styles.searchCard}>
            <Text style={styles.searchTitle}>Find student</Text>
            <Text style={styles.searchHint}>
              Search by admission number, roll number, or name
            </Text>
            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={ADMIN_THEME.colors.text.muted}
                  style={styles.searchIcon}
                />
                <AppTextInput
                  style={styles.input}
                  placeholder="e.g. 01, Class roll, Nikhil"
                  placeholderTextColor={ADMIN_THEME.colors.text.muted}
                  value={studentId}
                  onChangeText={setStudentId}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity
                style={[styles.searchBtn, loading && styles.disabledBtn]}
                onPress={handleSearch}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <LogoLoader size={28} color="#FFF" />
                ) : (
                  <Feather name="arrow-right" size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {renderReportCard()}
        </View>
      </ScrollView>

      {resultData && resultData.marks.length > 0 && (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.printBar}>
          <TouchableOpacity
            style={styles.printBtn}
            onPress={handlePrint}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[
                SCHOOL_CONFIG.theme.ribbonGradient[0],
                SCHOOL_CONFIG.theme.ribbonGradient[1],
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.printGradient}
            >
              <Feather name="printer" size={18} color="#FFF" />
              <Text style={styles.printText}>Print / Save PDF</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const getStyles = (
  theme: Theme,
  sc: (typeof schoolTheme.light)['colors'],
  isDark: boolean
) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { paddingBottom: 40 },
    content: { padding: 16, maxWidth: 860, width: '100%', alignSelf: 'center' },
    searchCard: {
      backgroundColor: isDark ? sc.card : '#FFF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: sc.border,
      marginBottom: 16,
      ...ADMIN_THEME.shadows.sm,
    },
    searchTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: sc.textPrimary,
      marginBottom: 4,
    },
    searchHint: {
      fontSize: 12,
      color: sc.textMuted,
      marginBottom: 12,
    },
    inputRow: { flexDirection: 'row', gap: 10 },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? sc.background : ADMIN_THEME.colors.background.surface,
      borderWidth: 1,
      borderColor: sc.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 48,
    },
    searchIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 15, color: sc.textPrimary },
    searchBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: sc.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    disabledBtn: { opacity: 0.7 },
    examPickerContainer: { marginBottom: 12, width: '100%' },
    examPickerLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: sc.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    examPickerScroll: { paddingRight: 8, gap: 8 },
    examChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? sc.card : '#FFF',
      borderWidth: 1,
      borderColor: sc.border,
      marginRight: 8,
    },
    examChipActive: {
      backgroundColor: sc.primary,
      borderColor: sc.primary,
    },
    examChipText: { fontSize: 13, fontWeight: '600', color: sc.textSecondary },
    examChipTextActive: { color: SCHOOL_CONFIG.theme.ribbonTitle },
    emptyCard: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: isDark ? sc.card : '#FFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: sc.border,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: schoolColorWithAlpha(sc.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: sc.textPrimary,
    },
    emptySubtitle: {
      fontSize: 13,
      color: sc.textMuted,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    previewWrap: { width: '100%' },
    paperSheet: {
      width: '100%',
      backgroundColor: isDark ? sc.card : sc.surface,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: sc.border,
      ...ADMIN_THEME.shadows.md,
    },
    letterhead: {
      paddingVertical: 16,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    logoImg: { width: 36, height: 36, resizeMode: 'contain' },
    letterheadCenter: { flex: 1, alignItems: 'center' },
    schoolName: {
      fontSize: 16,
      fontWeight: '800',
      color: SCHOOL_CONFIG.theme.ribbonTitle,
      letterSpacing: 0.4,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    tagline: {
      fontSize: 11,
      color: SCHOOL_CONFIG.theme.ribbonTagline,
      marginTop: 2,
      fontWeight: '600',
    },
    contactLine: {
      fontSize: 10,
      color: SCHOOL_CONFIG.theme.ribbonBodyMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    accentBar: { height: 3, backgroundColor: SCHOOL_CONFIG.theme.accent },
    titleBand: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: sc.border,
    },
    examTitle: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: sc.primaryDark || sc.primary,
      flex: 1,
      paddingRight: 8,
    },
    yearText: {
      fontSize: 12,
      fontWeight: '600',
      color: sc.textSecondary,
    },
    detailsGrid: {
      padding: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: schoolColorWithAlpha(sc.primary, isDark ? 0.08 : 0.04),
      gap: 4,
    },
    detailItem: { width: '50%', paddingVertical: 6, paddingHorizontal: 4 },
    detailLabel: {
      fontSize: 10,
      color: sc.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      fontSize: 13,
      color: sc.textStrong,
      fontWeight: '700',
      marginTop: 2,
    },
    tableContainer: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: sc.primaryDark || sc.primary,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 6,
      marginBottom: 2,
    },
    th: {
      color: SCHOOL_CONFIG.theme.ribbonTitle,
      fontWeight: '700',
      fontSize: 12,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: sc.border,
    },
    rowAlt: { backgroundColor: schoolColorWithAlpha(sc.primary, 0.05) },
    td: { color: sc.textPrimary, fontSize: 13, fontWeight: '500' },
    colSubject: { flex: 2.2 },
    colMarks: { flex: 1, textAlign: 'center' },
    colGrade: { flex: 1, textAlign: 'center' },
    textDanger: { color: sc.danger, fontWeight: '700' },
    textMuted: { color: sc.textMuted },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      padding: 12,
    },
    statCard: {
      flexGrow: 1,
      flexBasis: '45%',
      minWidth: 120,
      borderWidth: 1,
      borderColor: sc.border,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      backgroundColor: isDark ? sc.background : '#FFF',
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: sc.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '800',
      color: sc.textStrong,
    },
    resultBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgePass: { backgroundColor: schoolColorWithAlpha(sc.success, 0.18) },
    badgeFail: { backgroundColor: schoolColorWithAlpha(sc.danger, 0.14) },
    badgePending: { backgroundColor: schoolColorWithAlpha(sc.warning, 0.18) },
    textPass: { color: sc.success },
    textFail: { color: sc.danger },
    textPending: { color: sc.warning },
    resultText: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    pendingNote: {
      textAlign: 'center',
      fontSize: 12,
      color: sc.warning,
      fontWeight: '600',
      paddingBottom: 8,
    },
    footerSignatures: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 36,
      paddingBottom: 20,
    },
    signBox: {
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: sc.textMuted,
      width: '28%',
      paddingTop: 8,
    },
    signLabel: {
      fontSize: 10,
      color: sc.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    watermark: {
      position: 'absolute',
      top: '42%',
      left: '50%',
      transform: [{ translateX: -130 }, { translateY: -130 }],
      zIndex: 0,
      opacity: 0.08,
    },
    watermarkImg: {
      width: 260,
      height: 260,
      resizeMode: 'contain',
    },
    printBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      backgroundColor: schoolColorWithAlpha(sc.background, 0.94),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: sc.border,
    },
    printBtn: {
      width: '100%',
      maxWidth: 860,
      alignSelf: 'center',
      borderRadius: 12,
      overflow: 'hidden',
      ...ADMIN_THEME.shadows.md,
    },
    printGradient: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 10,
    },
    printText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  });
