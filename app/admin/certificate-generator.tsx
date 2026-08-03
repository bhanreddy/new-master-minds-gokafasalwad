import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Image, Platform, Pressable,
  Modal, ActivityIndicator, Switch,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, {
  FadeIn, FadeInDown, SlideInDown,
  useSharedValue, useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { StudentService } from '@/src/services/studentService';
import type { Student } from '@/src/types/models';
import { CertificateService } from '@/src/services/certificateService';
import { FeeService } from '@/src/services/feeService';
import { SchoolSettingsService, SchoolSettings } from '@/src/services/schoolSettingsService';
import { SCHOOL_CONFIG, SCHOOL_RECOGNITION_LINE } from '@/src/constants/schoolConfig';
import { SCHOOL_ID } from '@/src/constants/school';
import { useTheme } from '../../src/hooks/useTheme';
import { useAccountsWebChrome } from '../../src/contexts/AccountsWebChromeContext';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import {
  downloadCertificatePdf,
  getLogoDataUri,
  injectCertificatePrintStyles,
  printCertificateElement,
  resolveCertificateElement,
} from '@/src/utils/certificatePrint';
import { dobToWords } from '@/src/utils/dobToWords';

const { width, height } = Dimensions.get('window');

// ─── Paper size constants ─────────────────────────────────────────────────────
// TC Full: A4 portrait 210mm × 297mm.
// TC A4 Half: A5 landscape 210mm × 148.5mm.
// Bonafide: HALF an A4 sheet → A5 landscape (210mm × 148.5mm).
export const PAPER = {
  // 210mm = 595.3pt, 297mm = 841.9pt — standard A4.
  A4: { widthPt: 595.3, heightPt: 841.9, label: 'A4 (210 × 297 mm)' },
  TC_A4_HALF: { widthPt: 595.3, heightPt: 420.9, label: 'A4 Half (Landscape)' },
  // 210mm = 595.3pt, 148.5mm = 420.9pt — exactly half of an A4 sheet.
  BONAFIDE_A5_LANDSCAPE: { widthPt: 595.3, heightPt: 420.9, label: 'Half A4 (210 × 148.5 mm)' },
} as const;

export type TcLayout = 'A4' | 'A4_HALF';
/** Legacy = original double-frame letterhead (default); Modern = redesigned header. */
export type BonafideHeaderTheme = 'legacy' | 'modern';

export const TC_PAPER_MAP: Record<TcLayout, typeof PAPER.A4 | typeof PAPER.TC_A4_HALF> = {
  A4: PAPER.A4,
  A4_HALF: PAPER.TC_A4_HALF,
};

const BONAFIDE_BLUE = '#1e3a8a';
const TC_NAVY = '#1e3a8a';
const TC_GOLD = '#A16207';
const TC_PAPER_BG = '#FFFEF9';

interface SchoolProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  affiliation: string;
  recognition: string;
  medium: string;
  logoUrl: string;
  principal: string;
}

function mapSchoolSettings(settings: Partial<SchoolSettings>): SchoolProfile {
  return {
    name: settings.school_name || SCHOOL_CONFIG.name,
    address: settings.school_address || SCHOOL_CONFIG.address || '',
    phone: settings.school_phone || SCHOOL_CONFIG.contact || '',
    email: settings.school_email || SCHOOL_CONFIG.email || '',
    affiliation: settings.school_affiliation?.trim() || '',
    recognition: settings.school_recognition?.trim() || '',
    medium: settings.school_medium?.trim() || '',
    logoUrl: settings.school_logo_url || '',
    principal: settings.school_principal || 'Head Master',
  };
}

/** Geethanjali High School (school_id = 17): classes 1–5 use Talent School letterhead. */
const GEETHANJALI_SCHOOL_ID = 17;
const GEETHANJALI_TALENT_SCHOOL_NAME = 'Geethanjali Talent School';
/** Geethanjali only: TC may be issued for Class 1–6. */
const GEETHANJALI_TC_MAX_CLASS = 6;

const ROMAN_CLASS_TO_NUMBER: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
};

/** Extract class grade (1–12) from labels like "5", "V", "Class 5 – A", "VIII – B". */
function parseClassNumber(classLabel?: string): number | null {
  if (!classLabel?.trim()) return null;
  const arabic = classLabel.match(/\b(\d{1,2})\b/);
  if (arabic) {
    const n = parseInt(arabic[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  const roman = classLabel.toUpperCase().match(/\b(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
  if (roman) return ROMAN_CLASS_TO_NUMBER[roman[1]] ?? null;
  return null;
}

/**
 * Geethanjali (17) only: classes 1–5 → "Geethanjali Talent School";
 * classes 6–10 keep the original Geethanjali High School name from settings.
 */
function resolveCertificateSchoolName(baseName: string, classLabel?: string): string {
  if (SCHOOL_ID !== GEETHANJALI_SCHOOL_ID) return baseName;
  const classNum = parseClassNumber(classLabel);
  if (classNum !== null && classNum >= 1 && classNum <= 5) {
    return GEETHANJALI_TALENT_SCHOOL_NAME;
  }
  return baseName;
}

function withCertificateSchoolName(school: SchoolProfile, classLabel?: string): SchoolProfile {
  const name = resolveCertificateSchoolName(school.name, classLabel);
  return name === school.name ? school : { ...school, name };
}

/** Geethanjali (17) only: TC allowed for classes 1–6. Other schools unrestricted. */
function isTcAllowedForClass(classLabel?: string): { allowed: boolean; classNum: number | null } {
  const classNum = parseClassNumber(classLabel);
  if (SCHOOL_ID !== GEETHANJALI_SCHOOL_ID) return { allowed: true, classNum };
  if (classNum === null) return { allowed: true, classNum };
  return { allowed: classNum <= GEETHANJALI_TC_MAX_CLASS, classNum };
}

function formatRecognitionLine(recognition: string, medium: string): string {
  if (!recognition) return '';
  let line = `Recognised by Govt. ${recognition}`;
  if (medium) {
    const m = medium.toLowerCase();
    if (m === 'e' || m.includes('english')) line += ' (E/M)';
    else if (m === 't' || m.includes('telugu')) line += ' (T/M)';
    else line += ` (${medium})`;
  }
  return line;
}

function resolveSchoolLogoSource(school: SchoolProfile) {
  return school.logoUrl?.trim() ? { uri: school.logoUrl.trim() } : SCHOOL_CONFIG.logo;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type CertificateType = 'TC' | 'BONAFIDE' | null;

function getActivePaper(selectedType: CertificateType, tcLayout: TcLayout) {
  if (selectedType === 'TC') return TC_PAPER_MAP[tcLayout];
  if (selectedType === 'BONAFIDE') return PAPER.BONAFIDE_A5_LANDSCAPE;
  return PAPER.A4;
}

function getPdfFormat(selectedType: CertificateType, tcLayout: TcLayout): 'TC' | 'TC_A4_HALF' | 'BONAFIDE' {
  if (selectedType === 'TC') return tcLayout === 'A4_HALF' ? 'TC_A4_HALF' : 'TC';
  return 'BONAFIDE';
}

interface StudentData {
  id: string;
  name: string;
  fatherName: string;
  motherName: string;
  parentName: string;
  genderId: number;
  genderLabel: string;
  class: string;
  dob: string;
  dobWords: string;
  admissionNo: string;
  academicYear: string;
  fromClass: string;
  fromYear: string;
  toClass: string;
  toYear: string;
  penNo: string;
  address: string;
  nationality: string;
  category: string;
  admissionDate: string;
  isFormerStudent: boolean;
}

interface TCEditableFields {
  cbseAffiliationNo: string;
  schoolCode: string;
  // Items 9–23 (the ones that were dots before)
  examResult: string;
  failedDetails: string;
  subjects: [string, string, string, string, string, string];
  qualifiedPromotion: string;
  promotionClass: string;
  schoolDuesPaid: string;
  feeConcession: string;
  totalWorkingDays: string;
  workingDaysPresent: string;
  nccDetails: string;
  extraCurricular: string;
  generalConduct: string;
  applicationDate: string;
  leavingReason: string;
  otherRemarks: string;
}

const DEFAULT_TC_FIELDS: TCEditableFields = {
  cbseAffiliationNo: SCHOOL_CONFIG.cbseAffiliationNo || '',
  schoolCode: SCHOOL_CONFIG.schoolCode || '',
  examResult: '',
  failedDetails: 'N/A',
  subjects: ['', '', '', '', '', ''],
  qualifiedPromotion: '',
  promotionClass: '',
  schoolDuesPaid: '',
  feeConcession: 'None',
  totalWorkingDays: '',
  workingDaysPresent: '',
  nccDetails: 'N/A',
  extraCurricular: '',
  generalConduct: 'Good',
  applicationDate: new Date().toLocaleDateString('en-IN'),
  leavingReason: '',
  otherRemarks: 'N/A',
};

// ─── Utility ──────────────────────────────────────────────────────────────────
function formatDDMMYYYY(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return typeof dateStr === 'string' ? dateStr : 'N/A';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function classToRoman(className: string): string {
  if (!className) return '';
  return className.replace(/\b(\d+)\b/g, (match) => {
    const num = parseInt(match, 10);
    if (num >= 1 && num <= 12) {
      const romanMap = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
      return romanMap[num - 1];
    }
    return match;
  });
}

function formatInr(amount: number): string {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function genderHonorific(genderId?: number): string {
  if (genderId === 1) return 'Master';
  if (genderId === 2) return 'Kumari';
  return 'Master/Kumari';
}

function genderPronouns(genderId?: number) {
  if (genderId === 2) return { subject: 'She', possessive: 'her', verb: 'is' };
  if (genderId === 1) return { subject: 'He', possessive: 'his', verb: 'is' };
  return { subject: 'He/She', possessive: 'his/her', verb: 'is/was' };
}

function line(val?: string) {
  const v = val?.trim();
  return v || '________________________';
}

function dot(val: string) {
  return val?.trim() ? val : '..............................';
}

// ─── Certificate Config ───────────────────────────────────────────────────────
const CERT_CONFIG = {
  TC: {
    label: 'Transfer Certificate', short: 'TC',
    icon: 'file-move-outline' as const,
    iconColor: '#4F46E5', iconBg: '#EEF2FF',
    accentLight: '#4F46E5', accentDark: '#818CF8',
    gradFrom: '#4F46E5', gradTo: '#818CF8',
    desc: 'For students leaving or transferring to another institution.',
  },
  BONAFIDE: {
    label: 'Bonafide Certificate', short: 'BON',
    icon: 'certificate-outline' as const,
    iconColor: '#059669', iconBg: '#ECFDF5',
    accentLight: '#059669', accentDark: '#34D399',
    gradFrom: '#059669', gradTo: '#10B981',
    paper: PAPER.BONAFIDE_A5_LANDSCAPE,
    desc: 'Official proof of enrolment and conduct.',
  },
} as const;

// ─── Animated Type Card ───────────────────────────────────────────────────────
function TypeCard({ type, isDark, onPress }: { type: keyof typeof CERT_CONFIG; isDark: boolean; onPress: () => void }) {
  const cfg = CERT_CONFIG[type];
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cardBg = isDark ? '#1C1F2A' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  return (
    <Animated.View style={[aStyle, { flex: 1 }]}>
      <Pressable
        style={[tcStyles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 20 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20 }); }}
      >
        <View style={[tcStyles.iconBox, { backgroundColor: isDark ? `${cfg.iconColor}22` : cfg.iconBg }]}>
          <MaterialCommunityIcons name={cfg.icon} size={26} color={isDark ? (type === 'TC' ? '#818CF8' : '#34D399') : cfg.iconColor} />
        </View>
        <Text style={[tcStyles.title, { color: isDark ? '#F9FAFB' : '#111827' }]}>{cfg.label}</Text>
        <Text style={[tcStyles.desc, { color: isDark ? 'rgba(255,255,255,0.35)' : '#6B7280' }]}>{cfg.desc}</Text>
        <View style={[tcStyles.paperBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
          <Ionicons name="document-outline" size={10} color={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'} />
          <Text style={[tcStyles.paperBadgeText, { color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF' }]}>
            {type === 'TC' ? TC_PAPER_MAP.A4.label : PAPER.BONAFIDE_A5_LANDSCAPE.label}
          </Text>
        </View>
        <View style={[tcStyles.arrowWrap, { backgroundColor: isDark ? `${cfg.iconColor}22` : cfg.iconBg }]}>
          <Ionicons name="arrow-forward" size={14} color={isDark ? (type === 'TC' ? '#818CF8' : '#34D399') : cfg.iconColor} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
const tcStyles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: 1, gap: 6, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 } }) },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '800', lineHeight: 19 },
  desc: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  paperBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  paperBadgeText: { fontSize: 10, fontWeight: '600' },
  arrowWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});

// ─── Edit Field (reusable) ────────────────────────────────────────────────────
function EditField({
  label, value, onChangeText, multiline = false, isDark,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  multiline?: boolean; isDark: boolean;
}) {
  return (
    <View style={efStyles.wrap}>
      <Text style={[efStyles.label, { color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280' }]}>{label}</Text>
      <AppTextInput
        style={[efStyles.input, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1',
          color: isDark ? '#F9FAFB' : '#111827',
          height: multiline ? 72 : 42,
          textAlignVertical: multiline ? 'top' : 'center',
        }]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={isDark ? 'rgba(255,255,255,0.18)' : '#94A3B8'}
        placeholder="Enter value..."
      />
    </View>
  );
}
const efStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13.5, fontWeight: '500' },
});

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  visible, isDark, studentData, tcFields,
  onSave, onClose,
}: {
  visible: boolean; isDark: boolean;
  studentData: StudentData; tcFields: TCEditableFields;
  onSave: (sd: StudentData, tc: TCEditableFields) => void;
  onClose: () => void;
}) {
  const [sd, setSd] = useState<StudentData>(studentData);
  const [tc, setTc] = useState<TCEditableFields>(tcFields);
  const bg = isDark ? '#0F1117' : '#F8FAFC';
  const cardBg = isDark ? '#1C1F2A' : '#FFFFFF';

  const setSD = useCallback((k: keyof StudentData, v: string) => {
    setSd(prev => ({ ...prev, [k]: v }));
  }, []);
  const setTC = useCallback((k: keyof TCEditableFields, v: string | string[]) => {
    setTc(prev => ({ ...prev, [k]: v }));
  }, []);
  const setSubject = (i: number, v: string) => {
    const arr = [...tc.subjects] as [string, string, string, string, string, string];
    arr[i] = v;
    setTc(prev => ({ ...prev, subjects: arr }));
  };

  // Sync when externally changed
  React.useEffect(() => { setSd(studentData); }, [studentData]);
  React.useEffect(() => { setTc(tcFields); }, [tcFields]);

  const handleDobBlur = () => {
    if (sd.dob && sd.dob !== 'N/A') {
      setSd(prev => ({ ...prev, dobWords: dobToWords(sd.dob) }));
    }
  };

  const sectionTitle = (t: string) => (
    <View style={emStyles.sectionRow}>
      <View style={[emStyles.sectionDot, { backgroundColor: '#4F46E5' }]} />
      <Text style={[emStyles.sectionTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>{t}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={emStyles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[emStyles.sheet, { backgroundColor: bg }]}>
            {/* Header */}
            <View style={[emStyles.header, { backgroundColor: cardBg, borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9' }]}>
              <TouchableOpacity onPress={onClose} style={emStyles.headerClose}>
                <Ionicons name="close" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
              <Text style={[emStyles.headerTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>Edit Certificate</Text>
              <TouchableOpacity
                onPress={() => onSave(sd, tc)}
                style={emStyles.saveBtn}
              >
                <LinearGradient colors={['#4F46E5', '#818CF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={emStyles.saveBtnGrad}>
                  <Text style={emStyles.saveBtnText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={emStyles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── Student Information ── */}
              {sectionTitle('Student Information')}
              <View style={[emStyles.card, { backgroundColor: cardBg }]}>
                <EditField label="Full Name" value={sd.name} onChangeText={v => setSD('name', v)} isDark={isDark} />
                <EditField label="Father's / Guardian Name" value={sd.fatherName} onChangeText={v => setSD('fatherName', v)} isDark={isDark} />
                <EditField label="Mother's Name" value={sd.motherName} onChangeText={v => setSD('motherName', v)} isDark={isDark} />
                <EditField label="Admission No." value={sd.admissionNo} onChangeText={v => setSD('admissionNo', v)} isDark={isDark} />
                <EditField label="PEN Number" value={sd.penNo} onChangeText={v => setSD('penNo', v)} isDark={isDark} />
                <EditField label="Class" value={sd.class} onChangeText={v => setSD('class', v)} isDark={isDark} />
                <EditField label="From Class (Bonafide)" value={sd.fromClass} onChangeText={v => setSD('fromClass', v)} isDark={isDark} />
                <EditField label="From Year (Bonafide)" value={sd.fromYear} onChangeText={v => setSD('fromYear', v)} isDark={isDark} />
                <EditField label="To Class (Bonafide)" value={sd.toClass} onChangeText={v => setSD('toClass', v)} isDark={isDark} />
                <EditField label="To Year (Bonafide)" value={sd.toYear} onChangeText={v => setSD('toYear', v)} isDark={isDark} />
                <EditField
                  label="Date of Birth (dd-MM-yyyy)"
                  value={sd.dob}
                  onChangeText={v => setSD('dob', v)}
                  isDark={isDark}
                />
                <TouchableOpacity onPress={handleDobBlur} style={emStyles.autoBtn}>
                  <Ionicons name="refresh-outline" size={13} color="#4F46E5" />
                  <Text style={emStyles.autoBtnText}>Auto-fill DOB in words</Text>
                </TouchableOpacity>
                <EditField label="DOB in Words" value={sd.dobWords} onChangeText={v => setSD('dobWords', v)} isDark={isDark} />
                <EditField label="Date of Admission" value={sd.admissionDate} onChangeText={v => setSD('admissionDate', v)} isDark={isDark} />
                <EditField label="Nationality" value={sd.nationality} onChangeText={v => setSD('nationality', v)} isDark={isDark} />
                <EditField label="Category (SC/ST/OBC/General)" value={sd.category} onChangeText={v => setSD('category', v)} isDark={isDark} />
                <EditField label="Academic Year" value={sd.academicYear} onChangeText={v => setSD('academicYear', v)} isDark={isDark} />
                <EditField label="Address" value={sd.address} onChangeText={v => setSD('address', v)} isDark={isDark} multiline />
              </View>

              {/* ── TC-Specific Fields ── */}
              {sectionTitle('Transfer Certificate Fields (Items 9–23)')}
              <View style={[emStyles.card, { backgroundColor: cardBg }]}>
                <EditField label="CBSE Affiliation No." value={tc.cbseAffiliationNo} onChangeText={v => setTC('cbseAffiliationNo', v)} isDark={isDark} />
                <EditField label="School Code" value={tc.schoolCode} onChangeText={v => setTC('schoolCode', v)} isDark={isDark} />
                <EditField label="9. Exam Last Taken with Result" value={tc.examResult} onChangeText={v => setTC('examResult', v)} isDark={isDark} />
                <EditField label="10. Failed Details (if any)" value={tc.failedDetails} onChangeText={v => setTC('failedDetails', v)} isDark={isDark} />

                <Text style={[efStyles.label, { color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', marginBottom: 6 }]}>11. SUBJECTS STUDIED</Text>
                <View style={emStyles.subjectsGrid}>
                  {(['i', 'ii', 'iii', 'iv', 'v', 'vi'] as const).map((label, i) => (
                    <View key={i} style={emStyles.subjectCell}>
                      <Text style={[emStyles.subjectLabel, { color: isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF' }]}>({label})</Text>
                      <AppTextInput
                        style={[emStyles.subjectInput, {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1',
                          color: isDark ? '#F9FAFB' : '#111827',
                        }]}
                        value={tc.subjects[i]}
                        onChangeText={v => setSubject(i, v)}
                        placeholder="Subject"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.18)' : '#94A3B8'}
                      />
                    </View>
                  ))}
                </View>

                <EditField label="12. Qualified for Promotion?" value={tc.qualifiedPromotion} onChangeText={v => setTC('qualifiedPromotion', v)} isDark={isDark} />
                <EditField label="    Promotion to Class (Figures + Words)" value={tc.promotionClass} onChangeText={v => setTC('promotionClass', v)} isDark={isDark} />
                <EditField label="13. School Dues Paid up to Month" value={tc.schoolDuesPaid} onChangeText={v => setTC('schoolDuesPaid', v)} isDark={isDark} />
                <EditField label="14. Fee Concession (if any)" value={tc.feeConcession} onChangeText={v => setTC('feeConcession', v)} isDark={isDark} />
                <EditField label="15. Total Working Days" value={tc.totalWorkingDays} onChangeText={v => setTC('totalWorkingDays', v)} isDark={isDark} />
                <EditField label="16. Working Days Present" value={tc.workingDaysPresent} onChangeText={v => setTC('workingDaysPresent', v)} isDark={isDark} />
                <EditField label="17. NCC Cadet / Scout Guide Details" value={tc.nccDetails} onChangeText={v => setTC('nccDetails', v)} isDark={isDark} multiline />
                <EditField label="18. Extra-Curricular Activities" value={tc.extraCurricular} onChangeText={v => setTC('extraCurricular', v)} isDark={isDark} multiline />
                <EditField label="19. General Conduct" value={tc.generalConduct} onChangeText={v => setTC('generalConduct', v)} isDark={isDark} />
                <EditField label="20. Date of Application" value={tc.applicationDate} onChangeText={v => setTC('applicationDate', v)} isDark={isDark} />
                <EditField label="22. Reason for Leaving School" value={tc.leavingReason} onChangeText={v => setTC('leavingReason', v)} isDark={isDark} multiline />
                <EditField label="23. Any Other Remarks" value={tc.otherRemarks} onChangeText={v => setTC('otherRemarks', v)} isDark={isDark} multiline />
              </View>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
/** Dialog: waive fee-clearance rule for TC — scoped to one student for this session. */
function TcFeeWaiverDialog({
  visible,
  isDark,
  studentName,
  outstanding,
  waiveEnabled,
  onWaiveChange,
  onCancel,
  onContinue,
}: {
  visible: boolean;
  isDark: boolean;
  studentName: string;
  outstanding: number | null;
  waiveEnabled: boolean;
  onWaiveChange: (value: boolean) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const cardBg = isDark ? '#1C1F2A' : '#FFFFFF';
  const textPrimary = isDark ? '#F9FAFB' : '#111827';
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : '#6B7280';
  const duesKnown = outstanding !== null && outstanding > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={feeDlgStyles.overlay}>
        <View style={[feeDlgStyles.card, { backgroundColor: cardBg }]}>
          <View style={feeDlgStyles.iconWrap}>
            <MaterialCommunityIcons name="cash-remove" size={28} color="#DC2626" />
          </View>
          <Text style={[feeDlgStyles.title, { color: textPrimary }]}>
            {duesKnown ? 'Fee Dues Pending' : 'Could Not Verify Fees'}
          </Text>
          <Text style={[feeDlgStyles.message, { color: textMuted }]}>
            {duesKnown
              ? `${studentName} has outstanding fee dues of ${formatInr(outstanding!)}. Clear dues in Accounts, or allow TC for this student only without fee clearance.`
              : `Unable to confirm whether ${studentName} has pending dues. Check the fee ledger, or allow TC for this student only without fee verification.`}
          </Text>

          <View style={[feeDlgStyles.toggleRow, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
          }]}>
            <View style={feeDlgStyles.toggleCopy}>
              <Text style={[feeDlgStyles.toggleTitle, { color: textPrimary }]}>
                Allow TC without fee clearance
              </Text>
              <Text style={[feeDlgStyles.toggleHint, { color: textMuted }]}>
                Applies only to {studentName} for this session. Other students still require fee clearance.
              </Text>
            </View>
            <Switch
              value={waiveEnabled}
              onValueChange={onWaiveChange}
              trackColor={{ false: isDark ? '#374151' : '#CBD5E1', true: '#FCA5A5' }}
              thumbColor={waiveEnabled ? '#DC2626' : '#FFFFFF'}
            />
          </View>

          <View style={feeDlgStyles.actions}>
            <TouchableOpacity style={feeDlgStyles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={[feeDlgStyles.cancelText, { color: textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[feeDlgStyles.continueBtn, !waiveEnabled && feeDlgStyles.continueDisabled]}
              onPress={onContinue}
              disabled={!waiveEnabled}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={waiveEnabled ? ['#DC2626', '#F87171'] : ['#9CA3AF', '#9CA3AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={feeDlgStyles.continueGrad}
              >
                <Text style={feeDlgStyles.continueText}>Generate TC</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const feeDlgStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 22,
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  title: { fontSize: 18, fontWeight: '800' },
  message: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  toggleCopy: { flex: 1, gap: 4 },
  toggleTitle: { fontSize: 14, fontWeight: '700' },
  toggleHint: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700' },
  continueBtn: { flex: 1.4, borderRadius: 12, overflow: 'hidden', height: 46 },
  continueDisabled: { opacity: 0.55 },
  continueGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  continueText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});

const emStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { height: height * 0.92, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  headerClose: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  saveBtn: { borderRadius: 10, overflow: 'hidden' },
  saveBtnGrad: { paddingHorizontal: 18, paddingVertical: 9 },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  body: { padding: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  card: { borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  autoBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -6, marginBottom: 10, alignSelf: 'flex-start' },
  autoBtnText: { fontSize: 12, color: '#4F46E5', fontWeight: '700' },
  subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  subjectCell: { flexDirection: 'row', alignItems: 'center', gap: 6, width: (width - 32 - 28 - 16) / 2 },
  subjectLabel: { fontSize: 11, fontWeight: '700', width: 22 },
  subjectInput: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, height: 36, fontSize: 13, fontWeight: '500' },
});

const webPrintRootProps = Platform.OS === 'web'
  ? ({ className: 'certificate-print-root' } as const)
  : ({} as const);

const webWatermarkProps = Platform.OS === 'web'
  ? ({ className: 'certificate-watermark' } as const)
  : ({} as const);

// ─── Bonafide document (HALF-A4 landscape letterhead) ────────────────────────
// Frame, meta, body, and footer stay identical for both themes.
// Only the school letterhead (logo + name/address + certificate title) changes.
function BonafideDocument({
  studentData,
  school,
  issueDate,
  headerTheme = 'legacy',
}: {
  studentData: StudentData;
  school: SchoolProfile;
  issueDate: string;
  headerTheme?: BonafideHeaderTheme;
}) {
  const pronouns = genderPronouns(studentData.genderId);
  const enrolmentVerb = studentData.isFormerStudent ? 'was' : 'is';
  const studyVerb = studentData.isFormerStudent ? 'studied' : 'is Studying';
  const logoSource = resolveSchoolLogoSource(school);
  const recognitionLine = formatRecognitionLine(school.recognition, school.medium) || SCHOOL_RECOGNITION_LINE;
  const isLegacy = headerTheme === 'legacy';

  return (
    <View style={bfStyles.outerFrame}>
      <View style={bfStyles.innerFrame}>
        <View style={bfStyles.watermarkWrap} pointerEvents="none" {...webWatermarkProps}>
          <Image source={logoSource} style={bfStyles.watermarkImg} />
        </View>

        {isLegacy ? (
          <>
            <View style={bfStyles.headerRow}>
              <Image source={logoSource} style={bfStyles.headerLogo} />
              <View style={bfStyles.headerCenter}>
                <Text style={bfStyles.schoolName}>{school.name.toUpperCase()}</Text>
                {recognitionLine ? (
                  <Text style={bfStyles.schoolRecognition}>{recognitionLine}</Text>
                ) : null}
                <Text style={bfStyles.schoolAddr}>{school.address}</Text>
              </View>
            </View>
            <View style={bfStyles.titleBox}>
              <Text style={bfStyles.titleText}>BONAFIDE & CONDUCT CERTIFICATE</Text>
            </View>
          </>
        ) : (
          <>
            <View style={bfModernStyles.headerBand}>
              <View style={bfModernStyles.headerRow}>
                <Image source={logoSource} style={bfModernStyles.headerLogo} />
                <View style={bfModernStyles.headerCenter}>
                  <Text style={bfModernStyles.schoolName}>{school.name.toUpperCase()}</Text>
                  {recognitionLine ? (
                    <Text style={bfModernStyles.schoolRecognition}>{recognitionLine}</Text>
                  ) : null}
                  <Text style={bfModernStyles.schoolAddr}>{school.address}</Text>
                  <View style={bfModernStyles.nameUnderline} />
                </View>
              </View>
            </View>
            <View style={bfModernStyles.titleWrap}>
              <View style={bfModernStyles.titleRule} />
              <View style={bfModernStyles.titleBox}>
                <Text style={bfModernStyles.titleText}>BONAFIDE & CONDUCT CERTIFICATE</Text>
              </View>
              <View style={bfModernStyles.titleRule} />
            </View>
          </>
        )}

        <View style={bfStyles.metaRow}>
          <Text style={bfStyles.metaText}>
            Admission No. <Text style={bfStyles.metaVal}>{line(studentData.admissionNo)}</Text>
          </Text>
          <Text style={bfStyles.metaText}>
            Date <Text style={bfStyles.metaVal}>{line(issueDate)}</Text>
          </Text>
        </View>

        <View style={bfStyles.body}>
          <Text style={bfStyles.bodyLine}>
            This is to certify that {studentData.genderLabel}{' '}
            <Text style={bfStyles.bold}>{line(studentData.name)}</Text>
          </Text>
          <Text style={bfStyles.bodyLine}>
            S/o. D/o. Shri/Smt. <Text style={bfStyles.bold}>{line(studentData.parentName)}</Text> {enrolmentVerb} a Bonafide student of this Institution.
          </Text>
          <Text style={bfStyles.bodyLine}>
            {pronouns.subject} {studyVerb} from Class{' '}
            <Text style={bfStyles.bold}>{line(studentData.fromClass)}</Text> Year{' '}
            <Text style={bfStyles.bold}>{line(studentData.fromYear)}</Text> to Class{' '}
            <Text style={bfStyles.bold}>{line(studentData.toClass)}</Text> Year{' '}
            <Text style={bfStyles.bold}>{line(studentData.toYear)}</Text> during {pronouns.possessive} study period. {pronouns.possessive.charAt(0).toUpperCase() + pronouns.possessive.slice(1)} Character is found Good.
          </Text>
          <Text style={[bfStyles.bodyLine, { marginTop: 14 }]}>
            {pronouns.possessive.charAt(0).toUpperCase() + pronouns.possessive.slice(1)} date of birth according to School Admission register is{' '}
            <Text style={bfStyles.bold}>{line(studentData.dob)}</Text>
          </Text>
          <Text style={bfStyles.dobWordsLine}>{line(studentData.dobWords)}</Text>
        </View>

        <View style={bfStyles.footer}>
          <Text style={bfStyles.footerText}>
            PEN No. <Text style={bfStyles.bold}>{line(studentData.penNo)}</Text>
          </Text>
          <Text style={bfStyles.footerSign}>{school.principal}</Text>
        </View>
      </View>
    </View>
  );
}

const bfStyles = StyleSheet.create({
  outerFrame: {
    margin: 40,
    borderWidth: 2,
    borderColor: BONAFIDE_BLUE,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  innerFrame: {
    borderWidth: 1.5,
    borderColor: BONAFIDE_BLUE,
    paddingHorizontal: 24,
    paddingVertical: 16,
    position: 'relative',
  },
  watermarkWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  watermarkImg: { width: 260, height: 260, opacity: 0.07, resizeMode: 'contain' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingTop: 28, marginBottom: 32, zIndex: 1 },
  headerLogo: { width: 160, height: 160, resizeMode: 'contain' },
  headerCenter: { flex: 1, alignItems: 'center' },
  schoolName: { fontSize: 32, fontWeight: '900', color: BONAFIDE_BLUE, letterSpacing: 0.8, textAlign: 'center' },
  schoolRecognition: { fontSize: 14, color: BONAFIDE_BLUE, textAlign: 'center', marginTop: 4, fontWeight: '700' },
  schoolAddr: { fontSize: 15, color: BONAFIDE_BLUE, textAlign: 'center', marginTop: 5, lineHeight: 22, fontWeight: '600' },
  titleBox: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: BONAFIDE_BLUE,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: -92,
    marginBottom: 52,
    zIndex: 1,
  },
  titleText: { fontSize: 19, fontWeight: '800', color: BONAFIDE_BLUE, letterSpacing: 0.8, textAlign: 'center' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 14, zIndex: 1 },
  metaText: { fontSize: 17, color: BONAFIDE_BLUE, fontWeight: '600' },
  metaVal: { fontSize: 19, fontWeight: '800', textDecorationLine: 'underline' },
  body: { zIndex: 1, gap: 14 },
  bodyLine: { fontSize: 19, lineHeight: 32, color: BONAFIDE_BLUE, fontWeight: '500' },
  dobWordsLine: { fontSize: 18, color: BONAFIDE_BLUE, fontWeight: '700', textDecorationLine: 'underline', marginTop: 4, marginBottom: 12 },
  bold: { fontSize: 21, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 36, paddingTop: 8, zIndex: 1 },
  footerText: { fontSize: 17, color: BONAFIDE_BLUE, fontWeight: '600', flex: 1 },
  footerSign: { fontSize: 18, fontWeight: '800', color: BONAFIDE_BLUE, textAlign: 'right', minWidth: 140 },
});

/** Modern header only — same double frame + body as legacy. */
const bfModernStyles = StyleSheet.create({
  headerBand: {
    zIndex: 1,
    marginHorizontal: -8,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: '#F4F7FB',
    borderBottomWidth: 2,
    borderBottomColor: BONAFIDE_BLUE,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  headerLogo: { width: 128, height: 128, resizeMode: 'contain' },
  headerCenter: { flex: 1, alignItems: 'center', paddingRight: 12 },
  schoolName: {
    fontSize: 30,
    fontWeight: '900',
    color: BONAFIDE_BLUE,
    letterSpacing: 1.4,
    textAlign: 'center',
    lineHeight: 36,
  },
  schoolRecognition: {
    fontSize: 13,
    color: BONAFIDE_BLUE,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '700',
    opacity: 0.85,
  },
  schoolAddr: {
    fontSize: 14,
    color: BONAFIDE_BLUE,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 20,
    fontWeight: '600',
    opacity: 0.9,
  },
  nameUnderline: {
    width: 72,
    height: 3,
    borderRadius: 2,
    backgroundColor: BONAFIDE_BLUE,
    marginTop: 10,
    opacity: 0.35,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
    marginBottom: 28,
    zIndex: 1,
  },
  titleRule: { flex: 1, height: 1.5, backgroundColor: BONAFIDE_BLUE, opacity: 0.35 },
  titleBox: {
    borderWidth: 1.5,
    borderColor: BONAFIDE_BLUE,
    backgroundColor: '#EEF3FB',
    borderRadius: 6,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '800',
    color: BONAFIDE_BLUE,
    letterSpacing: 1,
    textAlign: 'center',
  },
});

const cpStyles = StyleSheet.create({
  wrap: { marginTop: 20, gap: 16 },
  paperBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  paperBadgeLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  paperBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  paperBadgeText: { fontSize: 11, fontWeight: '700' },
  layoutToggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F3F4F6' },
  layoutPill: { paddingHorizontal: 10, paddingVertical: 5 },
  layoutPillActive: { backgroundColor: '#4F46E5' },
  layoutPillText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  layoutPillTextActive: { color: '#FFFFFF' },
  headerThemeToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerThemeLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  headerThemeLabelActive: { color: '#059669' },
  headerThemeTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerThemeTrackOn: { backgroundColor: '#059669', justifyContent: 'flex-end' },
  headerThemeThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  serialText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  paper: { backgroundColor: '#FFFFFF', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', position: 'relative', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20 }, android: { elevation: 8 } }) },
  // A4 @ ~96dpi (794 × 1123). Fixed height so rows can space-between to fill the sheet.
  tcPaper: { width: 794, height: 1123, backgroundColor: TC_PAPER_BG },
  tcHalfPaper: { width: 1060, minHeight: 520 },
  // A5 landscape ratio (1060 / 749 ≈ 1.414). Fixed height so the flex footer
  // can pin to the bottom and the sheet renders as a true half-A4 card.
  bonafidePaper: { width: 1060, minHeight: 749, backgroundColor: '#FFFFFF' },
  topBar: { height: 6 },
  bottomBar: { height: 4 },
  watermarkWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  watermarkImg: { width: 260, height: 260, opacity: 0.04, resizeMode: 'contain' },
  schoolHeader: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 20, paddingBottom: 4 },
  tcHalfHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, zIndex: 1 },
  tcHalfLogo: { width: 48, height: 48, resizeMode: 'contain' },
  tcHalfHeaderCenter: { flex: 1 },
  tcHalfSchoolName: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: 0.4 },
  tcHalfAffiliation: { fontSize: 9, color: '#64748B', fontStyle: 'italic', marginTop: 1 },
  tcHalfTitleBlock: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 16, zIndex: 1 },
  tcHalfCertTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1, textDecorationLine: 'underline', color: '#4F46E5', textAlign: 'center' },
  tcHalfRefNo: { fontSize: 9, color: '#94A3B8', marginTop: 2 },
  logo: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 8 },
  schoolName: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0.8, textAlign: 'center' },
  schoolAddr: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },
  affiliation: { fontSize: 10, color: '#94A3B8', fontStyle: 'italic', marginTop: 2, textAlign: 'center' },
  dividerLine: { height: 1.5, width: '80%', marginTop: 16, opacity: 0.3, borderRadius: 1 },
  titleBlock: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  certTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5, textDecorationLine: 'underline', textAlign: 'center' },
  refNo: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  tcContainer: { paddingHorizontal: 22, paddingBottom: 24 },
  tcHalfContainer: { paddingHorizontal: 14, paddingBottom: 8, zIndex: 1 },
  tcHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  tcHalfHeaderMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  tcHeaderText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  tcHalfHeaderText: { fontSize: 8, fontWeight: '700', color: '#475569' },
  tcList: { gap: 5 },
  tcItem: { fontSize: 11, lineHeight: 18, color: '#1E293B', fontWeight: '500' },
  tcHalfGrid: { flexDirection: 'row' },
  tcHalfCol: { width: '50%', paddingHorizontal: 4, gap: 2 },
  tcHalfItem: { fontSize: 8, lineHeight: 12, color: '#1E293B', fontWeight: '500' },
  body: { paddingHorizontal: 22, paddingBottom: 16 },
  bodyText: { fontSize: 13.5, lineHeight: 24, color: '#1E293B', textAlign: 'justify' },
  bonafideNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  bonafideNoteText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  bold: { fontWeight: '800', color: '#0F172A' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 'auto' },
  tcHalfFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4, zIndex: 1 },
  sigBlock: { alignItems: 'center', gap: 6 },
  sigDate: { fontSize: 11, fontWeight: '600', color: '#475569' },
  tcHalfSigText: { fontSize: 8, fontWeight: '600', color: '#475569' },
  sigStamp: { width: 70, height: 40, borderRadius: 4, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  sigStampCompact: { width: 52, height: 28 },
  sigStampText: { fontSize: 8, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  sigLine: { width: 90, height: 1, backgroundColor: '#334155' },
  sigLabel: { fontSize: 11, fontWeight: '600', color: '#475569' },
  actions: { flexDirection: 'row', gap: 12 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 15, borderRadius: 14, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  printBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 15, borderRadius: 14, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  printBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  downloadGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14 },
  downloadText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
});

function buildTcItemTexts(studentData: StudentData, tcFields: TCEditableFields, today: string) {
  return [
    `1. Name of Pupil : ${studentData.name}`,
    `2. Father's/Guardian Name : ${studentData.fatherName}`,
    `3. Mother's Name : ${studentData.motherName}`,
    `4. Nationality : ${studentData.nationality}`,
    `5. Whether Candidate belongs to SC/ST/OBC : ${studentData.category}`,
    `6. Date of First Admission in the School with Class : ${studentData.admissionDate}`,
    `7. Date of Birth (In Figures) : ${studentData.dob}\n   (In Words) : ${studentData.dobWords}`,
    `8. Class In Which Pupil Last Studied : ${studentData.class}`,
    `9. School/Board Examination Last Taken with Result : ${dot(tcFields.examResult)}`,
    `10. Whether Failed, If So Once/Twice in Same Class : ${dot(tcFields.failedDetails)}`,
    `11. Subject Studied : ${tcFields.subjects.map((s, i) => `(${['i', 'ii', 'iii', 'iv', 'v', 'vi'][i]}) ${dot(s)}`).join('  ')}`,
    `12. Whether Qualified for Promotion to Higher Class : ${dot(tcFields.qualifiedPromotion)}\n    (If so, to which class) : ${dot(tcFields.promotionClass)}`,
    `13. Month Upto which School Dues Paid : ${dot(tcFields.schoolDuesPaid)}`,
    `14. Any Fee Concession availed of : ${dot(tcFields.feeConcession)}`,
    `15. Total No. of Working Days : ${dot(tcFields.totalWorkingDays)}`,
    `16. Total No. of Working Days Present : ${dot(tcFields.workingDaysPresent)}`,
    `17. Whether NCC Cadet / Scout Guide : ${dot(tcFields.nccDetails)}`,
    `18. Extra-Curricular Activities : ${dot(tcFields.extraCurricular)}`,
    `19. General Conduct : ${dot(tcFields.generalConduct)}`,
    `20. Date of Application for Certificate : ${dot(tcFields.applicationDate)}`,
    `21. Date of Issue of Certificate : ${today}`,
    `22. Reasons for Leaving the School : ${dot(tcFields.leavingReason)}`,
    `23. Any Other Remarks : ${dot(tcFields.otherRemarks)}`,
  ];
}

function renderTcA4Items(studentData: StudentData, tcFields: TCEditableFields, today: string) {
  const row = (label: string, value: React.ReactNode, key: string) => (
    <View key={key} style={tcA4Styles.itemRow}>
      <Text style={tcA4Styles.itemText}>
        <Text style={tcA4Styles.itemLabel}>{label} : </Text>
        <Text style={tcA4Styles.itemValue}>{value}</Text>
      </Text>
    </View>
  );

  return (
    <View style={tcA4Styles.itemList}>
      {row('1. Name of Pupil', <Text style={tcA4Styles.itemStrong}>{studentData.name}</Text>, '1')}
      {row("2. Father's / Guardian Name", <Text style={tcA4Styles.itemStrong}>{studentData.fatherName}</Text>, '2')}
      {row("3. Mother's Name", <Text style={tcA4Styles.itemStrong}>{studentData.motherName}</Text>, '3')}
      {row('4. Nationality', <Text style={tcA4Styles.itemStrong}>{studentData.nationality}</Text>, '4')}
      {row('5. Whether Candidate belongs to SC / ST / OBC', <Text style={tcA4Styles.itemStrong}>{studentData.category}</Text>, '5')}
      {row('6. Date of First Admission in the School with Class', <Text style={tcA4Styles.itemStrong}>{studentData.admissionDate}</Text>, '6')}
      {row(
        '7. Date of Birth (In Figures)',
        <>
          <Text style={tcA4Styles.itemStrong}>{studentData.dob}</Text>
          <Text>{'   (In Words) : '}</Text>
          <Text style={tcA4Styles.itemStrong}>{studentData.dobWords}</Text>
        </>,
        '7',
      )}
      {row('8. Class In Which Pupil Last Studied', <Text style={tcA4Styles.itemStrong}>{studentData.class}</Text>, '8')}
      {row('9. School / Board Examination Last Taken with Result', dot(tcFields.examResult), '9')}
      {row('10. Whether Failed, If So Once / Twice in Same Class', dot(tcFields.failedDetails), '10')}
      {row(
        '11. Subjects Studied',
        tcFields.subjects.map((s, i) => `(${['i', 'ii', 'iii', 'iv', 'v', 'vi'][i]}) ${dot(s)}`).join('  '),
        '11',
      )}
      {row(
        '12. Whether Qualified for Promotion to Higher Class',
        `${dot(tcFields.qualifiedPromotion)}    (If so, to which class) : ${dot(tcFields.promotionClass)}`,
        '12',
      )}
      {row('13. Month Upto which School Dues Paid', dot(tcFields.schoolDuesPaid), '13')}
      {row('14. Any Fee Concession availed of', dot(tcFields.feeConcession), '14')}
      {row('15. Total No. of Working Days', dot(tcFields.totalWorkingDays), '15')}
      {row('16. Total No. of Working Days Present', dot(tcFields.workingDaysPresent), '16')}
      {row('17. Whether NCC Cadet / Scout Guide', dot(tcFields.nccDetails), '17')}
      {row('18. Extra-Curricular Activities', dot(tcFields.extraCurricular), '18')}
      {row('19. General Conduct', dot(tcFields.generalConduct), '19')}
      {row('20. Date of Application for Certificate', dot(tcFields.applicationDate), '20')}
      {row('21. Date of Issue of Certificate', <Text style={tcA4Styles.itemStrong}>{today}</Text>, '21')}
      {row('22. Reasons for Leaving the School', dot(tcFields.leavingReason), '22')}
      {row('23. Any Other Remarks', dot(tcFields.otherRemarks), '23')}
    </View>
  );
}

/** Premium full-page A4 Transfer Certificate letterhead. */
function TcA4Document({
  studentData,
  tcFields,
  school,
  serialNo,
  issueDate,
}: {
  studentData: StudentData;
  tcFields: TCEditableFields;
  school: SchoolProfile;
  serialNo: string;
  issueDate: string;
}) {
  const logoSource = resolveSchoolLogoSource(school);
  const affiliationLine = school.affiliation?.trim() || '';
  const recognitionLine = formatRecognitionLine(school.recognition, school.medium) || SCHOOL_RECOGNITION_LINE;

  return (
    <View style={tcA4Styles.outerFrame}>
      <View style={tcA4Styles.innerFrame}>
        <View style={tcA4Styles.watermarkWrap} pointerEvents="none" {...webWatermarkProps}>
          <Image source={logoSource} style={tcA4Styles.watermarkImg} />
        </View>

        <View style={tcA4Styles.headerRow}>
          <Image source={logoSource} style={tcA4Styles.logo} />
          <View style={tcA4Styles.headerCenter}>
            <Text style={tcA4Styles.schoolName}>{school.name.toUpperCase()}</Text>
            {recognitionLine ? (
              <Text style={tcA4Styles.recognition}>{recognitionLine}</Text>
            ) : null}
            {affiliationLine ? (
              <Text style={tcA4Styles.affiliation}>{affiliationLine}</Text>
            ) : null}
            <Text style={tcA4Styles.address}>{school.address}</Text>
            <View style={tcA4Styles.nameUnderline} />
          </View>
        </View>

        <View style={tcA4Styles.titleWrap}>
          <View style={tcA4Styles.titleRule} />
          <View style={tcA4Styles.titleBox}>
            <Text style={tcA4Styles.titleText}>TRANSFER CERTIFICATE</Text>
          </View>
          <View style={tcA4Styles.titleRule} />
        </View>

        <View style={tcA4Styles.metaBand}>
          <Text style={tcA4Styles.metaText}>
            Ref No. <Text style={tcA4Styles.metaVal}>{serialNo}</Text>
          </Text>
          <Text style={tcA4Styles.metaText}>
            Scholar No. <Text style={tcA4Styles.metaVal}>{studentData.admissionNo}</Text>
          </Text>
        </View>
        <View style={tcA4Styles.metaBandSecondary}>
          <Text style={tcA4Styles.metaSecondary}>
            CBSE Affiliation No. : {dot(tcFields.cbseAffiliationNo)}
          </Text>
          <Text style={tcA4Styles.metaSecondary}>
            School Code : {dot(tcFields.schoolCode)}
          </Text>
        </View>

        {renderTcA4Items(studentData, tcFields, issueDate)}

        <View style={tcA4Styles.footer}>
          <View style={tcA4Styles.sigBlock}>
            <Text style={tcA4Styles.sigDate}>Date: {issueDate}</Text>
            <View style={tcA4Styles.stampBox}>
              <Text style={tcA4Styles.stampText}>SCHOOL STAMP</Text>
            </View>
          </View>
          <View style={tcA4Styles.sigBlock}>
            <View style={tcA4Styles.sigLine} />
            <Text style={tcA4Styles.sigLabel}>Class Teacher</Text>
          </View>
          <View style={tcA4Styles.sigBlock}>
            <View style={tcA4Styles.sigLine} />
            <Text style={tcA4Styles.sigLabel}>Principal</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const tcA4Styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    margin: 12,
    borderWidth: 2.5,
    borderColor: TC_NAVY,
    padding: 4,
    backgroundColor: TC_PAPER_BG,
  },
  innerFrame: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: TC_NAVY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    position: 'relative',
    backgroundColor: TC_PAPER_BG,
  },
  watermarkWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  watermarkImg: { width: 320, height: 320, opacity: 0.045, resizeMode: 'contain' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, zIndex: 1 },
  logo: { width: 82, height: 82, resizeMode: 'contain' },
  headerCenter: { flex: 1, alignItems: 'center', paddingRight: 8 },
  schoolName: {
    fontSize: 22,
    fontWeight: '900',
    color: TC_NAVY,
    letterSpacing: 1.4,
    textAlign: 'center',
    lineHeight: 28,
  },
  recognition: {
    fontSize: 11.5,
    fontWeight: '700',
    color: TC_NAVY,
    opacity: 0.88,
    marginTop: 4,
    textAlign: 'center',
  },
  affiliation: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TC_GOLD,
    marginTop: 2,
    textAlign: 'center',
  },
  address: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TC_NAVY,
    opacity: 0.82,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  nameUnderline: {
    width: 72,
    height: 3,
    borderRadius: 2,
    backgroundColor: TC_GOLD,
    marginTop: 8,
    opacity: 0.75,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    marginBottom: 12,
    zIndex: 1,
  },
  titleRule: { flex: 1, height: 1.5, backgroundColor: TC_NAVY, opacity: 0.35 },
  titleBox: {
    borderWidth: 1.5,
    borderColor: TC_NAVY,
    backgroundColor: '#EEF2FF',
    borderRadius: 5,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '900',
    color: TC_NAVY,
    letterSpacing: 2,
  },
  metaBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
    marginBottom: 5,
  },
  metaBandSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
    marginBottom: 8,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(30,58,138,0.18)',
  },
  metaText: { fontSize: 12.5, fontWeight: '600', color: TC_NAVY },
  metaVal: { fontWeight: '800', color: TC_NAVY },
  metaSecondary: { fontSize: 12, fontWeight: '700', color: '#334155' },
  // Distribute all 23 rows evenly between meta and footer so the A4 sheet fills.
  itemList: {
    zIndex: 1,
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  itemRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(30,58,138,0.1)',
    paddingVertical: 1,
  },
  itemText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#0F172A',
  },
  itemLabel: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  itemValue: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
    color: '#0F172A',
  },
  itemStrong: { fontWeight: '800', color: '#0F172A', fontSize: 13 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(30,58,138,0.22)',
    zIndex: 1,
  },
  sigBlock: { alignItems: 'center', gap: 8, minWidth: 110 },
  sigDate: { fontSize: 12, fontWeight: '700', color: TC_NAVY },
  stampBox: {
    width: 88,
    height: 50,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: TC_NAVY,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  stampText: { fontSize: 9, fontWeight: '800', color: TC_NAVY, letterSpacing: 0.5 },
  sigLine: { width: 120, height: 1.5, backgroundColor: TC_NAVY, marginBottom: 4 },
  sigLabel: { fontSize: 12.5, fontWeight: '700', color: TC_NAVY },
});

function renderTcHalfItems(studentData: StudentData, tcFields: TCEditableFields, today: string) {
  const items = buildTcItemTexts(studentData, tcFields, today);
  const left = items.slice(0, 12);
  const right = items.slice(12);
  return (
    <View style={cpStyles.tcHalfGrid}>
      <View style={cpStyles.tcHalfCol}>
        {left.map((item, i) => (
          <Text key={`l-${i}`} style={cpStyles.tcHalfItem}>{item}</Text>
        ))}
      </View>
      <View style={cpStyles.tcHalfCol}>
        {right.map((item, i) => (
          <Text key={`r-${i}`} style={cpStyles.tcHalfItem}>{item}</Text>
        ))}
      </View>
    </View>
  );
}

function renderTcSignatures(today: string, compact = false) {
  return (
    <View style={compact ? cpStyles.tcHalfFooter : cpStyles.footer}>
      <View style={cpStyles.sigBlock}>
        <Text style={compact ? cpStyles.tcHalfSigText : cpStyles.sigDate}>Date: {today}</Text>
        <View style={[cpStyles.sigStamp, compact && cpStyles.sigStampCompact]}>
          <Text style={cpStyles.sigStampText}>SCHOOL STAMP</Text>
        </View>
      </View>
      <View style={cpStyles.sigBlock}>
        <View style={cpStyles.sigLine} />
        <Text style={compact ? cpStyles.tcHalfSigText : cpStyles.sigLabel}>Class Teacher</Text>
      </View>
      <View style={cpStyles.sigBlock}>
        <View style={cpStyles.sigLine} />
        <Text style={compact ? cpStyles.tcHalfSigText : cpStyles.sigLabel}>Principal</Text>
      </View>
    </View>
  );
}

// ─── Certificate Preview ──────────────────────────────────────────────────────
const CertificatePreview = React.forwardRef<View, {
  studentData: StudentData;
  tcFields: TCEditableFields;
  selectedType: CertificateType;
  serialNo: string;
  school: SchoolProfile;
  tcLayout: TcLayout;
  setTcLayout: (layout: TcLayout) => void;
  bonafideHeaderTheme: BonafideHeaderTheme;
  setBonafideHeaderTheme: (theme: BonafideHeaderTheme) => void;
  onEdit: () => void;
  onPrint: () => void;
  onDownload: () => void;
}>(function CertificatePreview({
  studentData, tcFields, selectedType, serialNo, school: schoolBase, tcLayout, setTcLayout,
  bonafideHeaderTheme, setBonafideHeaderTheme, onEdit, onPrint, onDownload,
}, certificateRef) {
  if (!selectedType) return null;
  const cfg = CERT_CONFIG[selectedType];
  const isTC = selectedType === 'TC';
  const isHalfTc = isTC && tcLayout === 'A4_HALF';
  // Geethanjali (17): letterhead name depends on current/last class (1–5 Talent, 6–10 High School).
  const school = withCertificateSchoolName(
    schoolBase,
    isTC ? studentData.class : studentData.toClass,
  );
  const activePaper = getActivePaper(selectedType, tcLayout);
  const downloadLabel = isTC
    ? (tcLayout === 'A4_HALF' ? 'A4 Half' : 'A4')
    : 'Half A4';
  const title = isTC ? 'TRANSFER CERTIFICATE' : 'BONAFIDE & CONDUCT CERTIFICATE';
  const today = formatDDMMYYYY(new Date());
  const logoSource = resolveSchoolLogoSource(school);
  const affiliationLine = school.affiliation?.trim() || '';
  const recognitionLine = formatRecognitionLine(school.recognition, school.medium) || SCHOOL_RECOGNITION_LINE;
  const modernOn = bonafideHeaderTheme === 'modern';

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={cpStyles.wrap}>

      <View style={cpStyles.paperBadgeRow}>
        <View style={cpStyles.paperBadgeLeft}>
          <View style={[cpStyles.paperBadge, { backgroundColor: `${cfg.gradFrom}18` }]}>
            <Ionicons name="document-text-outline" size={12} color={cfg.gradFrom} />
            <Text style={[cpStyles.paperBadgeText, { color: cfg.gradFrom }]}>{activePaper.label}</Text>
          </View>
          {isTC ? (
            <View style={cpStyles.layoutToggle}>
              <TouchableOpacity
                style={[cpStyles.layoutPill, tcLayout === 'A4' && cpStyles.layoutPillActive]}
                onPress={() => setTcLayout('A4')}
                activeOpacity={0.85}
              >
                <Text style={[cpStyles.layoutPillText, tcLayout === 'A4' && cpStyles.layoutPillTextActive]}>
                  A4 (210×297)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cpStyles.layoutPill, tcLayout === 'A4_HALF' && cpStyles.layoutPillActive]}
                onPress={() => setTcLayout('A4_HALF')}
                activeOpacity={0.85}
              >
                <Text style={[cpStyles.layoutPillText, tcLayout === 'A4_HALF' && cpStyles.layoutPillTextActive]}>
                  A4 Half (Landscape)
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={cpStyles.headerThemeToggle}>
              <Text style={cpStyles.headerThemeLabel}>Legacy</Text>
              <TouchableOpacity
                style={[cpStyles.headerThemeTrack, modernOn && cpStyles.headerThemeTrackOn]}
                onPress={() => setBonafideHeaderTheme(modernOn ? 'legacy' : 'modern')}
                activeOpacity={0.85}
                accessibilityRole="switch"
                accessibilityState={{ checked: modernOn }}
                accessibilityLabel="Modern header"
              >
                <View style={cpStyles.headerThemeThumb} />
              </TouchableOpacity>
              <Text style={[cpStyles.headerThemeLabel, modernOn && cpStyles.headerThemeLabelActive]}>Modern</Text>
            </View>
          )}
        </View>
        <Text style={cpStyles.serialText}>No. {serialNo}</Text>
      </View>

      <View
        ref={certificateRef}
        collapsable={false}
        nativeID="certificate-print-root"
        {...webPrintRootProps}
        style={[
          cpStyles.paper,
          isTC ? (isHalfTc ? cpStyles.tcHalfPaper : cpStyles.tcPaper) : cpStyles.bonafidePaper,
        ]}
      >
        {isTC ? (
          isHalfTc ? (
            <>
              <View style={cpStyles.watermarkWrap} pointerEvents="none" {...webWatermarkProps}>
                <Image source={logoSource} style={cpStyles.watermarkImg} />
              </View>
              <View style={cpStyles.tcHalfHeaderRow}>
                <Image source={logoSource} style={cpStyles.tcHalfLogo} />
                <View style={cpStyles.tcHalfHeaderCenter}>
                  <Text style={cpStyles.tcHalfSchoolName}>{school.name}</Text>
                  {affiliationLine ? (
                    <Text style={cpStyles.tcHalfAffiliation}>{affiliationLine}</Text>
                  ) : null}
                  {recognitionLine ? (
                    <Text style={cpStyles.tcHalfAffiliation}>{recognitionLine}</Text>
                  ) : null}
                </View>
              </View>
              <View style={cpStyles.tcHalfTitleBlock}>
                <Text style={cpStyles.tcHalfCertTitle}>{title}</Text>
                <Text style={cpStyles.tcHalfRefNo}>Ref No: {serialNo}</Text>
              </View>
              <View style={cpStyles.tcHalfContainer}>
                <View style={cpStyles.tcHalfHeaderMeta}>
                  <Text style={cpStyles.tcHalfHeaderText}>CBSE Affiliation No. : {dot(tcFields.cbseAffiliationNo)}</Text>
                  <Text style={cpStyles.tcHalfHeaderText}>School Code : {dot(tcFields.schoolCode)} · Scholar No. : {studentData.admissionNo}</Text>
                </View>
                {renderTcHalfItems(studentData, tcFields, today)}
              </View>
              {renderTcSignatures(today, true)}
            </>
          ) : (
            <TcA4Document
              studentData={studentData}
              tcFields={tcFields}
              school={school}
              serialNo={serialNo}
              issueDate={today}
            />
          )
        ) : (
          <BonafideDocument
            studentData={studentData}
            school={school}
            issueDate={today}
            headerTheme={bonafideHeaderTheme}
          />
        )}
      </View>

      <View style={cpStyles.actions}>
        <TouchableOpacity style={cpStyles.editBtn} onPress={onEdit} activeOpacity={0.8}>
          <Feather name="edit-2" size={16} color="#6B7280" />
          <Text style={cpStyles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cpStyles.printBtn} onPress={onPrint} activeOpacity={0.8}>
          <Feather name="printer" size={16} color="#374151" />
          <Text style={cpStyles.printBtnText}>Print</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 2, borderRadius: 14, overflow: 'hidden' }} onPress={onDownload} activeOpacity={0.88}>
          <LinearGradient colors={[cfg.gradFrom, cfg.gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cpStyles.downloadGrad}>
            <Feather name="download" size={16} color="#FFF" />
            <Text style={cpStyles.downloadText}>Download PDF ({downloadLabel})</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepDot({ n, active, done, isDark }: { n: number; active: boolean; done: boolean; isDark: boolean }) {
  const bg = done ? '#10B981' : active ? '#4F46E5' : (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB');
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={[sdStyles.dot, { backgroundColor: bg }]}>
        {done
          ? <Ionicons name="checkmark" size={12} color="#fff" />
          : <Text style={[sdStyles.num, { color: active || done ? '#fff' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF') }]}>{n}</Text>
        }
      </View>
    </View>
  );
}
const SD_LABELS = ['Search', 'Select', 'Preview'];
function StepIndicator({ step, isDark }: { step: number; isDark: boolean }) {
  return (
    <View style={sdStyles.wrap}>
      {[1, 2, 3].map((n, i) => (
        <React.Fragment key={n}>
          <View style={sdStyles.item}>
            <StepDot n={n} active={step === n} done={step > n} isDark={isDark} />
            <Text style={[sdStyles.label, { color: step >= n ? (isDark ? '#F9FAFB' : '#111827') : (isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'), fontWeight: step === n ? '800' : '500' }]}>{SD_LABELS[i]}</Text>
          </View>
          {i < 2 && <View style={[sdStyles.line, { backgroundColor: step > n ? '#10B981' : (isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB') }]} />}
        </React.Fragment>
      ))}
    </View>
  );
}
const sdStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 24, gap: 0 },
  item: { alignItems: 'center', gap: 4 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 13, fontWeight: '800' },
  label: { fontSize: 11, letterSpacing: 0.3 },
  line: { flex: 1, height: 1.5, marginHorizontal: 6, marginBottom: 16 },
});

// ─── HTML generator for PDF (expo-print) ─────────────────────────────────────
function buildCertificateHTML(
  studentData: StudentData,
  tcFields: TCEditableFields,
  type: CertificateType,
  serialNo: string,
  logoDataUri: string,
  schoolBase: SchoolProfile,
  tcLayout: TcLayout = 'A4',
  bonafideHeaderTheme: BonafideHeaderTheme = 'legacy',
): string {
  if (!type) return '';
  const cfg = CERT_CONFIG[type];
  const isTC = type === 'TC';
  const isHalfTc = isTC && tcLayout === 'A4_HALF';
  const isBfLegacy = !isTC && bonafideHeaderTheme === 'legacy';
  // Geethanjali (17): letterhead name depends on current/last class (1–5 Talent, 6–10 High School).
  const school = withCertificateSchoolName(
    schoolBase,
    isTC ? studentData.class : studentData.toClass,
  );
  const today = formatDDMMYYYY(new Date());
  const title = isTC ? 'TRANSFER CERTIFICATE' : 'BONAFIDE & CONDUCT CERTIFICATE';
  const logoImg = logoDataUri
    ? `<img src="${logoDataUri}" alt="School logo" class="header-logo-img" />`
    : '';
  const pronouns = genderPronouns(studentData.genderId);
  const affiliationLine = school.affiliation?.trim() || '';
  const recognitionLine = formatRecognitionLine(school.recognition, school.medium) || SCHOOL_RECOGNITION_LINE;
  const escAddr = (school.address || '').replace(/\n/g, '<br/>');
  const escSchoolName = (school.name || '').replace(/</g, '&lt;');

  const tcItemHtml = (items: string[]) => items.map(item => `<div class="tc-half-item">${item.replace(/\n/g, '<br/>')}</div>`).join('');
  const tcItems = buildTcItemTexts(studentData, tcFields, today);
  const tcLeftCol = tcItemHtml(tcItems.slice(0, 12));
  const tcRightCol = tcItemHtml(tcItems.slice(12));

  const tcA4Row = (label: string, value: string, strong = false) =>
    `<div class="tc-a4-row"><span class="tc-a4-label">${label} : </span><span class="tc-a4-value">${strong ? `<strong>${value}</strong>` : value}</span></div>`;

  const tcRowsA4 = `
    ${tcA4Row('1. Name of Pupil', studentData.name, true)}
    ${tcA4Row("2. Father's / Guardian Name", studentData.fatherName, true)}
    ${tcA4Row("3. Mother's Name", studentData.motherName, true)}
    ${tcA4Row('4. Nationality', studentData.nationality, true)}
    ${tcA4Row('5. Whether Candidate belongs to SC / ST / OBC', studentData.category, true)}
    ${tcA4Row('6. Date of First Admission in the School with Class', studentData.admissionDate, true)}
    ${tcA4Row('7. Date of Birth (In Figures)', `<strong>${studentData.dob}</strong> &nbsp;&nbsp;(In Words) : <strong>${studentData.dobWords}</strong>`)}
    ${tcA4Row('8. Class In Which Pupil Last Studied', studentData.class, true)}
    ${tcA4Row('9. School / Board Examination Last Taken with Result', tcFields.examResult || '……………')}
    ${tcA4Row('10. Whether Failed, If So Once / Twice in Same Class', tcFields.failedDetails || '……………')}
    ${tcA4Row('11. Subjects Studied', tcFields.subjects.map((s, i) => `(${['i', 'ii', 'iii', 'iv', 'v', 'vi'][i]}) ${s || '…'}`).join('  '))}
    ${tcA4Row('12. Whether Qualified for Promotion to Higher Class', `${tcFields.qualifiedPromotion || '……………'} &nbsp;&nbsp;(If so, to which class) : ${tcFields.promotionClass || '……………'}`)}
    ${tcA4Row('13. Month Upto which School Dues Paid', tcFields.schoolDuesPaid || '……………')}
    ${tcA4Row('14. Any Fee Concession availed of', tcFields.feeConcession || '……………')}
    ${tcA4Row('15. Total No. of Working Days', tcFields.totalWorkingDays || '……………')}
    ${tcA4Row('16. Total No. of Working Days Present', tcFields.workingDaysPresent || '……………')}
    ${tcA4Row('17. Whether NCC Cadet / Scout Guide', tcFields.nccDetails || '……………')}
    ${tcA4Row('18. Extra-Curricular Activities', tcFields.extraCurricular || '……………')}
    ${tcA4Row('19. General Conduct', tcFields.generalConduct || '……………')}
    ${tcA4Row('20. Date of Application for Certificate', tcFields.applicationDate || '……………')}
    ${tcA4Row('21. Date of Issue of Certificate', today, true)}
    ${tcA4Row('22. Reasons for Leaving the School', tcFields.leavingReason || '……………')}
    ${tcA4Row('23. Any Other Remarks', tcFields.otherRemarks || '……………')}`;

  const tcRowsHalf = `
    <div class="tc-half-header">
      ${logoImg}
      <div class="tc-half-header-center">
        <div class="tc-half-school-name">${school.name}</div>
        ${affiliationLine ? `<div class="tc-half-affiliation">${affiliationLine}</div>` : ''}
        ${recognitionLine ? `<div class="tc-half-affiliation">${recognitionLine}</div>` : ''}
      </div>
    </div>
    <div class="tc-half-title-block">
      <div class="tc-half-cert-title">${title}</div>
      <div class="tc-half-ref-no">Ref No: ${serialNo}</div>
    </div>
    <div class="tc-half-meta">
      <span>CBSE Affiliation No. : ${tcFields.cbseAffiliationNo || '—'}</span>
      <span>School Code : ${tcFields.schoolCode || '—'} · Scholar No. : ${studentData.admissionNo}</span>
    </div>
    <div class="tc-grid">
      <div class="tc-col">${tcLeftCol}</div>
      <div class="tc-col">${tcRightCol}</div>
    </div>`;

  const bonafideSharedBody = `
      <div class="bf-meta">
        <span>Admission No. <u>${line(studentData.admissionNo)}</u></span>
        <span>Date <u>${line(today)}</u></span>
      </div>
      <div class="bf-body">
        <p class="bf-line">This is to certify that ${studentData.genderLabel} <strong>${line(studentData.name)}</strong></p>
        <p class="bf-line">S/o. D/o. Shri/Smt. <strong>${line(studentData.parentName)}</strong> ${studentData.isFormerStudent ? 'was' : 'is'} a Bonafide student of this Institution.</p>
        <p class="bf-line">${pronouns.subject} ${studentData.isFormerStudent ? 'studied' : 'is Studying'} from Class <strong>${line(studentData.fromClass)}</strong> Year <strong>${line(studentData.fromYear)}</strong> to Class <strong>${line(studentData.toClass)}</strong> Year <strong>${line(studentData.toYear)}</strong> during ${pronouns.possessive} study period. ${pronouns.possessive.charAt(0).toUpperCase() + pronouns.possessive.slice(1)} Character is found Good.</p>
        <p class="bf-line bf-line-dob">${pronouns.possessive.charAt(0).toUpperCase() + pronouns.possessive.slice(1)} date of birth according to School Admission register is <strong>${line(studentData.dob)}</strong></p>
        <p class="bf-dob-words">${line(studentData.dobWords)}</p>
      </div>
      <div class="bf-footer">
        <span>PEN No. <strong>${line(studentData.penNo)}</strong></span>
        <span>${school.principal}</span>
      </div>`;

  const bonafideHeaderLegacy = `
      <div class="bf-header">
        ${logoImg}
        <div class="bf-header-center">
          <div class="bf-school-name">${school.name.toUpperCase()}</div>
          ${recognitionLine ? `<div class="bf-school-recognition">${recognitionLine}</div>` : ''}
          <div class="bf-school-addr">${escAddr}</div>
        </div>
      </div>
      <div class="bf-title-box">${title}</div>`;

  const bonafideHeaderModern = `
      <div class="bfm-header-band">
        <div class="bfm-header">
          ${logoImg}
          <div class="bfm-header-center">
            <div class="bfm-school-name">${school.name.toUpperCase()}</div>
            ${recognitionLine ? `<div class="bfm-school-recognition">${recognitionLine}</div>` : ''}
            <div class="bfm-school-addr">${escAddr}</div>
            <div class="bfm-name-underline"></div>
          </div>
        </div>
      </div>
      <div class="bfm-title-wrap">
        <div class="bfm-title-rule"></div>
        <div class="bfm-title-box">${title}</div>
        <div class="bfm-title-rule"></div>
      </div>`;

  const bonafideBody = `
    <div class="bf-outer"><div class="bf-inner">
      ${isBfLegacy ? bonafideHeaderLegacy : bonafideHeaderModern}
      ${bonafideSharedBody}
    </div></div>`;

  // Full TC prints on A4 portrait; half TC / Bonafide use half-A4 landscape.
  const pageSize = isTC
    ? (isHalfTc
      ? '@page { size: 210mm 148.5mm landscape; margin: 0; }'
      : '@page { size: A4 portrait; margin: 0; }')
    : '@page { size: 210mm 148.5mm landscape; margin: 0; }';

  const rootWidth = isTC ? (isHalfTc ? '210mm' : '210mm') : '210mm';
  const rootHeight = isTC ? (isHalfTc ? '148.5mm' : '297mm') : '148.5mm';

  const tcA4Block = `
      <div class="tc-a4-outer"><div class="tc-a4-inner">
        <div class="tc-a4-header">
          ${logoImg}
          <div class="tc-a4-header-center">
            <div class="tc-a4-school-name">${escSchoolName.toUpperCase()}</div>
            ${recognitionLine ? `<div class="tc-a4-recognition">${recognitionLine}</div>` : ''}
            ${affiliationLine ? `<div class="tc-a4-affiliation">${affiliationLine}</div>` : ''}
            <div class="tc-a4-addr">${escAddr}</div>
            <div class="tc-a4-underline"></div>
          </div>
        </div>
        <div class="tc-a4-title-wrap">
          <div class="tc-a4-title-rule"></div>
          <div class="tc-a4-title-box">${title}</div>
          <div class="tc-a4-title-rule"></div>
        </div>
        <div class="tc-a4-meta">
          <span>Ref No. <strong>${serialNo}</strong></span>
          <span>Scholar No. <strong>${studentData.admissionNo}</strong></span>
        </div>
        <div class="tc-a4-meta-secondary">
          <span>CBSE Affiliation No. : ${tcFields.cbseAffiliationNo || '……………'}</span>
          <span>School Code : ${tcFields.schoolCode || '……………'}</span>
        </div>
        <div class="tc-a4-list">${tcRowsA4}</div>
        <div class="tc-a4-footer">
          <div class="tc-a4-sig">
            <div>Date: ${today}</div>
            <div class="tc-a4-stamp">SCHOOL STAMP</div>
          </div>
          <div class="tc-a4-sig"><div class="tc-a4-sig-line"></div><div>Class Teacher</div></div>
          <div class="tc-a4-sig"><div class="tc-a4-sig-line"></div><div>Principal</div></div>
        </div>
      </div></div>`;

  const tcHalfBlock = `
      ${tcRowsHalf}
      <div class="footer footer-compact">
        <div><div>Date: ${today}</div><div class="stamp-box stamp-box-compact">SCHOOL STAMP</div></div>
        <div><div class="sig-line"></div><div>Class Teacher</div></div>
        <div><div class="sig-line"></div><div>Principal</div></div>
      </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    ${pageSize}
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body { width: 100%; height: 100%; }
    body { font-family: 'Times New Roman', Georgia, serif; margin: 0; padding: 0; position: relative; background: ${isTC && !isHalfTc ? TC_PAPER_BG : '#FFFFFF'}; }
    .certificate-print-root {
      position: relative;
      background: ${isTC && !isHalfTc ? TC_PAPER_BG : '#FFFFFF'};
      width: ${rootWidth};
      height: ${rootHeight};
      min-height: ${rootHeight};
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .certificate-watermark {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 0;
      pointer-events: none;
      opacity: 0.06;
    }
    .certificate-watermark img {
      width: 240px; height: 240px;
      object-fit: contain;
      opacity: 0.06;
    }
    .page-content { position: relative; z-index: 1; height: 100%; }
    .header-logo-img { width: 64px; height: 64px; object-fit: contain; margin-bottom: 0; }

    /* ── Premium full A4 Transfer Certificate ───────────────────────────── */
    .tc-a4-outer {
      margin: 7mm;
      border: 2.5px solid ${TC_NAVY};
      padding: 3.5px;
      height: calc(297mm - 14mm);
      background: ${TC_PAPER_BG};
    }
    .tc-a4-inner {
      border: 1.5px solid ${TC_NAVY};
      padding: 7mm 9mm 6mm;
      height: 100%;
      background: ${TC_PAPER_BG};
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .tc-a4-header { display: flex; align-items: center; gap: 14px; }
    .tc-a4-header .header-logo-img { width: 78px; height: 78px; }
    .tc-a4-header-center { flex: 1; text-align: center; }
    .tc-a4-school-name { font-size: 21px; font-weight: 900; color: ${TC_NAVY}; letter-spacing: 1.4px; line-height: 1.25; }
    .tc-a4-recognition { font-size: 11px; font-weight: 700; color: ${TC_NAVY}; opacity: 0.88; margin-top: 3px; }
    .tc-a4-affiliation { font-size: 11px; font-weight: 600; color: ${TC_GOLD}; margin-top: 2px; }
    .tc-a4-addr { font-size: 11px; font-weight: 600; color: ${TC_NAVY}; opacity: 0.82; margin-top: 3px; white-space: pre-line; line-height: 1.4; }
    .tc-a4-underline { width: 68px; height: 2.5px; border-radius: 2px; background: ${TC_GOLD}; opacity: 0.75; margin: 7px auto 0; }
    .tc-a4-title-wrap { display: flex; align-items: center; gap: 12px; margin: 11px 0 10px; }
    .tc-a4-title-rule { flex: 1; height: 1.5px; background: ${TC_NAVY}; opacity: 0.35; }
    .tc-a4-title-box {
      border: 1.5px solid ${TC_NAVY};
      background: #EEF2FF;
      border-radius: 5px;
      padding: 6px 18px;
      font-size: 15px; font-weight: 900; color: ${TC_NAVY}; letter-spacing: 2px; white-space: nowrap;
    }
    .tc-a4-meta { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: ${TC_NAVY}; margin-bottom: 4px; }
    .tc-a4-meta strong { font-weight: 800; }
    .tc-a4-meta-secondary {
      display: flex; justify-content: space-between;
      font-size: 11.5px; font-weight: 700; color: #334155;
      margin-bottom: 6px; padding-bottom: 8px;
      border-bottom: 1.5px solid rgba(30,58,138,0.18);
    }
    .tc-a4-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 2px 0;
    }
    .tc-a4-row {
      display: block;
      font-size: 12px;
      line-height: 1.45;
      color: #0F172A;
      border-bottom: 0.5px solid rgba(30,58,138,0.1);
      padding: 1px 0;
    }
    .tc-a4-label { font-weight: 700; color: #1E3A8A; }
    .tc-a4-value { font-weight: 500; }
    .tc-a4-value strong { font-weight: 800; font-size: 12.5px; }
    .tc-a4-footer {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-top: 10px; padding-top: 12px;
      border-top: 1.5px solid rgba(30,58,138,0.22);
      font-size: 12px; font-weight: 700; color: ${TC_NAVY};
    }
    .tc-a4-sig { text-align: center; min-width: 110px; }
    .tc-a4-sig-line { border-bottom: 1.5px solid ${TC_NAVY}; width: 120px; margin: 0 auto 5px; }
    .tc-a4-stamp {
      border: 1.5px dashed ${TC_NAVY}; width: 88px; height: 48px;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 800; letter-spacing: 0.5px; opacity: 0.55; margin: 6px auto 0;
    }

    .tc-half-header { display: flex; align-items: center; gap: 10px; padding: 8px 14px 2px; }
    .tc-half-header .header-logo-img { width: 48px; height: 48px; margin-bottom: 0; }
    .tc-half-header-center { flex: 1; }
    .tc-half-school-name { font-size: 16px; font-weight: 900; color: #0F172A; letter-spacing: 0.4px; }
    .tc-half-affiliation { font-size: 9px; color: #64748B; font-style: italic; margin-top: 1px; }
    .tc-half-title-block { text-align: center; padding: 4px 14px 6px; }
    .tc-half-cert-title { font-size: 14px; font-weight: 900; color: ${cfg.gradFrom}; letter-spacing: 1px; text-decoration: underline; }
    .tc-half-ref-no { font-size: 9px; color: #94A3B8; margin-top: 2px; }
    .tc-half-meta { display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: #475569; padding: 0 14px 4px; }
    .tc-grid { display: flex; padding: 0 10px; }
    .tc-col { width: 50%; padding: 0 4px; }
    .tc-half-item { font-size: 8px; line-height: 12px; color: #1E293B; margin-bottom: 2px; }
    .footer { display: flex; justify-content: space-between; padding: 16px 22px; border-top: 1px solid #F1F5F9; font-size: 11px; color: #475569; }
    .footer-compact { padding: 6px 14px; font-size: 8px; }
    .sig-line { border-bottom: 1px solid #334155; width: 90px; margin-bottom: 4px; }
    .stamp-box { border: 1.5px dashed #CBD5E1; width: 70px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94A3B8; font-weight: 700; letter-spacing: 0.5px; }
    .stamp-box-compact { width: 52px; height: 28px; font-size: 7px; }

    /* ── Bonafide: HALF-A4 landscape, content fills the full sheet ───────── */
    .bf-outer {
      margin: 8mm;
      border: 2px solid ${BONAFIDE_BLUE};
      padding: 6px;
      height: calc(148.5mm - 16mm);
      background: #FFFFFF;
    }
    .bf-inner {
      border: 1.5px solid ${BONAFIDE_BLUE};
      padding: 8mm 12mm;
      height: 100%;
      position: relative;
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
    }
    .bf-header { display: flex; align-items: flex-start; gap: 14px; padding-top: 15px; margin-bottom: 20px; }
    .bf-header-center { flex: 1; text-align: center; }
    .bf-header .header-logo-img { width: 140px; height: 140px; object-fit: contain; margin-bottom: 0; }
    .bf-school-name { font-size: 30px; font-weight: 900; color: ${BONAFIDE_BLUE}; letter-spacing: 0.8px; line-height: 1.15; }
    .bf-school-recognition { font-size: 13px; color: ${BONAFIDE_BLUE}; margin-top: 4px; font-weight: 700; }
    .bf-school-addr { font-size: 14px; color: ${BONAFIDE_BLUE}; margin-top: 5px; font-weight: 600; white-space: pre-line; line-height: 1.45; }
    .bf-title-box { text-align: center; border: 1.5px solid ${BONAFIDE_BLUE}; border-radius: 4px; padding: 6px 18px; margin: -70px auto 40px; width: fit-content; font-size: 19px; font-weight: 800; color: ${BONAFIDE_BLUE}; letter-spacing: 0.8px; }
    .bf-meta { display: flex; justify-content: space-between; font-size: 17px; color: ${BONAFIDE_BLUE}; font-weight: 600; margin: 8px 0 12px; }
    .bf-meta u { font-size: 19px; font-weight: 800; }
    .bf-body { }
    .bf-line { font-size: 19px; line-height: 32px; color: ${BONAFIDE_BLUE}; margin: 0 0 10px; font-weight: 500; }
    .bf-line strong { font-size: 21px; font-weight: 800; }
    .bf-line-dob { margin-top: 14px; }
    .bf-dob-words { font-size: 18px; color: ${BONAFIDE_BLUE}; font-weight: 700; text-decoration: underline; margin: 5px 0 12px; }
    .bf-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 8px; font-size: 17px; color: ${BONAFIDE_BLUE}; font-weight: 600; }
    .bf-footer strong { font-size: 19px; font-weight: 800; }

    /* ── Bonafide modern header only (same frame/body as legacy) ─────────── */
    .bfm-header-band {
      margin: -4px -6px 6px;
      padding: 10px 8px 12px;
      background: #F4F7FB;
      border-bottom: 2px solid ${BONAFIDE_BLUE};
    }
    .bfm-header { display: flex; align-items: center; gap: 14px; }
    .bfm-header .header-logo-img { width: 110px; height: 110px; object-fit: contain; margin: 0; }
    .bfm-header-center { flex: 1; text-align: center; }
    .bfm-school-name { font-size: 28px; font-weight: 900; color: ${BONAFIDE_BLUE}; letter-spacing: 1.4px; line-height: 1.2; }
    .bfm-school-recognition { font-size: 12px; color: ${BONAFIDE_BLUE}; margin-top: 3px; font-weight: 700; opacity: 0.85; }
    .bfm-school-addr { font-size: 13px; color: ${BONAFIDE_BLUE}; margin-top: 4px; font-weight: 600; white-space: pre-line; line-height: 1.4; opacity: 0.9; }
    .bfm-name-underline { width: 64px; height: 3px; border-radius: 2px; background: ${BONAFIDE_BLUE}; opacity: 0.35; margin: 8px auto 0; }
    .bfm-title-wrap { display: flex; align-items: center; gap: 12px; margin: 4px 0 22px; }
    .bfm-title-rule { flex: 1; height: 1.5px; background: ${BONAFIDE_BLUE}; opacity: 0.35; }
    .bfm-title-box {
      border: 1.5px solid ${BONAFIDE_BLUE};
      background: #EEF3FB;
      border-radius: 6px;
      padding: 7px 18px;
      font-size: 16px; font-weight: 800; color: ${BONAFIDE_BLUE}; letter-spacing: 1px; white-space: nowrap;
    }
  </style></head><body>
  <div class="certificate-print-root">
    ${logoDataUri ? `<div class="certificate-watermark"><img src="${logoDataUri}" alt="" /></div>` : ''}
    <div class="page-content">
      ${isTC ? (isHalfTc ? tcHalfBlock : tcA4Block) : bonafideBody}
    </div>
  </div>
</body></html>`;
}

function parentDisplayName(p: any): string {
  if (p?.display_name?.trim()) return p.display_name.trim();
  return `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
}

/**
 * The Bonafide's "S/o. D/o. Shri/Smt." line renders `parentName`. It prefers the
 * father, falling back to the mother, then a generic guardian. Kept as a shared
 * helper so an edit of the father/mother name re-derives it (see handleEditSave).
 */
function computeParentName(fatherName?: string, motherName?: string): string {
  const father = fatherName?.trim();
  if (father && father !== 'Guardian') return father;
  const mother = motherName?.trim();
  if (mother && mother !== 'N/A') return mother;
  return 'Guardian';
}

function studentRecordName(student: Student): string {
  return student.display_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
}

function studentRecordClass(student: Student): string {
  const enrollment = student.current_enrollment;
  const cls = enrollment?.class_name || enrollment?.class_code || '—';
  const sec = enrollment?.section_name;
  return sec ? `${cls} – ${sec}` : cls;
}

function dateSortKey(value?: string): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function academicYearSortKey(academicYear?: string): number {
  const match = String(academicYear || '').match(/(\d{4})/);
  return match ? Number(match[1]) * 1e10 : Number.MAX_SAFE_INTEGER;
}

function enrollmentSortKey(enrollment: {
  academic_year_start_date?: string;
  start_date?: string;
  created_at?: string;
  academic_year?: string;
  class_sort_order?: number;
}): number {
  const primaryDate =
    dateSortKey(enrollment.academic_year_start_date)
    ?? dateSortKey(enrollment.start_date)
    ?? dateSortKey(enrollment.created_at);

  const classOrder = Number.isFinite(Number(enrollment.class_sort_order))
    ? Number(enrollment.class_sort_order)
    : 0;

  if (primaryDate !== null) return primaryDate + classOrder;
  return academicYearSortKey(enrollment.academic_year) + classOrder;
}

function sortEnrollmentsChronologically<T extends {
  academic_year_start_date?: string;
  start_date?: string;
  created_at?: string;
  academic_year?: string;
  class_sort_order?: number;
}>(
  enrollments: T[],
): T[] {
  return [...enrollments].sort((a, b) => enrollmentSortKey(a) - enrollmentSortKey(b));
}

function classNameFromEnrollment(enrollment?: { class_name?: string; class_code?: string }): string {
  return enrollment?.class_name || enrollment?.class_code || '';
}

function normalizeCertificateValue(value: unknown, fallback = 'N/A'): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function normalizePenNumber(value: unknown): string {
  return normalizeCertificateValue(value, 'NA');
}

function admissionYearFallback(admissionDate?: string): string {
  if (!admissionDate) return '';
  const d = new Date(admissionDate);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  return `${year}-${year + 1}`;
}

function academicYearStartYear(academicYear?: string): number | null {
  const match = String(academicYear || '').match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
}

function classForAcademicYearGap(
  currentClass: string,
  fromYear: string,
  toYear: string,
): string {
  const fromStartYear = academicYearStartYear(fromYear);
  const toStartYear = academicYearStartYear(toYear);
  if (fromStartYear === null || toStartYear === null) return currentClass;

  const yearGap = toStartYear - fromStartYear;
  if (yearGap <= 0) return currentClass;

  return currentClass.replace(/\b(\d+)\b/, (match) => {
    const inferredClass = Number(match) - yearGap;
    return inferredClass >= 1 ? String(inferredClass) : match;
  });
}

function resolveBonafideStudyPeriod(
  enrollments: Array<{
    class_name?: string;
    class_code?: string;
    academic_year?: string;
    academic_year_start_date?: string;
    start_date?: string;
    created_at?: string;
    class_sort_order?: number;
  }>,
  currentEnrollment: { class_name?: string; class_code?: string; academic_year?: string } | undefined,
  admissionDate?: string,
) {
  const currentClass = classNameFromEnrollment(currentEnrollment);
  const sorted = sortEnrollmentsChronologically(enrollments);
  const firstEnroll = sorted[0];
  const lastEnroll = sorted[sorted.length - 1];
  const admissionYear = admissionYearFallback(admissionDate);
  const fromYear = admissionDate
    ? admissionYear
    : (firstEnroll?.academic_year || currentEnrollment?.academic_year || 'N/A');
  const toYear = currentEnrollment?.academic_year || lastEnroll?.academic_year || admissionYear || 'N/A';
  const presentClass = currentClass || classNameFromEnrollment(lastEnroll);
  const inferredFromClass = classForAcademicYearGap(presentClass, fromYear, toYear);

  return {
    fromClass: classToRoman(inferredFromClass || classNameFromEnrollment(firstEnroll) || 'N/A'),
    fromYear,
    toClass: classToRoman(presentClass || 'N/A'),
    toYear,
  };
}

function buildStudentDataFromRecord(
  student: any,
  parents: any[],
  enrollments: any[],
): StudentData {
  const sortedEnrollments = sortEnrollmentsChronologically(enrollments);
  const latestEnrollment = sortedEnrollments[sortedEnrollments.length - 1];
  const enrollment = student.current_enrollment || latestEnrollment;
  const cls = enrollment?.class_name || enrollment?.class_code || '';
  const sec = enrollment?.section_name || '';
  const fatherObj = parents?.find((p: any) => /father/i.test(p.relationship || p.relation || ''));
  const father = fatherObj ? parentDisplayName(fatherObj) : 'Guardian';
  const motherObj = parents?.find((p: any) => /mother/i.test(p.relationship || p.relation || ''));
  const mother = motherObj ? parentDisplayName(motherObj) : 'N/A';
  const rawDob = student.dob || student.person?.dob || '';
  const dobFormatted = rawDob ? formatDDMMYYYY(rawDob) : 'N/A';
  const studyPeriod = resolveBonafideStudyPeriod(enrollments, enrollment, student.admission_date);
  const isFormerStudent = student.status === 'graduated' || student.status === 'withdrawn';
  const exitAcademicYear = isFormerStudent && student.exit_academic_year
    ? String(student.exit_academic_year)
    : studyPeriod.toYear;

  return {
    id: student.id,
    name: student.display_name || `${student.first_name || ''} ${student.last_name || ''}`.trim(),
    fatherName: father,
    motherName: mother,
    parentName: computeParentName(father, mother),
    genderId: student.gender_id ?? student.person?.gender_id ?? 0,
    genderLabel: genderHonorific(student.gender_id ?? student.person?.gender_id),
    class: classToRoman(sec ? `${cls} – ${sec}` : cls),
    dob: dobFormatted,
    dobWords: rawDob ? dobToWords(rawDob) : 'N/A',
    admissionNo: student.admission_no,
    academicYear: exitAcademicYear || enrollment?.academic_year || 'N/A',
    fromClass: studyPeriod.fromClass,
    fromYear: studyPeriod.fromYear,
    toClass: studyPeriod.toClass,
    toYear: exitAcademicYear,
    penNo: normalizePenNumber(student.pen_number),
    address: 'Hyderabad',
    nationality: 'Indian',
    category: student.category?.name || 'General',
    admissionDate: student.admission_date ? formatDDMMYYYY(student.admission_date) : 'N/A',
    isFormerStudent,
  };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CertificateGenerator() {
  const { theme, isDark } = useTheme();
  const { shellActive } = useAccountsWebChrome();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchMatches, setSearchMatches] = useState<Student[] | null>(null);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [tcFields, setTcFields] = useState<TCEditableFields>(DEFAULT_TC_FIELDS);
  const [selectedType, setSelectedType] = useState<CertificateType>(null);
  const [generated, setGenerated] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [serialNo, setSerialNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => mapSchoolSettings({}));
  const [tcLayout, setTcLayout] = useState<TcLayout>('A4');
  /** Legacy is the default. Toggle ON switches to the modern header. */
  const [bonafideHeaderTheme, setBonafideHeaderTheme] = useState<BonafideHeaderTheme>('legacy');
  /** Student id for whom TC fee-clearance is waived this session only. */
  const [tcSkipFeeCheckStudentId, setTcSkipFeeCheckStudentId] = useState<string | null>(null);
  const [showTcFeeDialog, setShowTcFeeDialog] = useState(false);
  const [tcFeeDialogOutstanding, setTcFeeDialogOutstanding] = useState<number | null>(null);
  const [tcFeeDialogToggle, setTcFeeDialogToggle] = useState(false);
  const certificateRef = useRef<View>(null);

  const step = generated ? 3 : studentData ? 2 : 1;
  const tcFeeWaivedForCurrentStudent = !!(studentData && tcSkipFeeCheckStudentId === studentData.id);

  useEffect(() => {
    injectCertificatePrintStyles();
    SchoolSettingsService.getSettings()
      .then(settings => setSchoolProfile(mapSchoolSettings(settings)))
      .catch(() => { /* keep SCHOOL_CONFIG fallback */ });
  }, []);

  const loadStudentFromRecord = useCallback(async (studentRecord: Student) => {
    const silent = { silent: true } as const;
    const [fullStudent, parents, enrollments] = await Promise.all([
      StudentService.getById(studentRecord.id, silent).catch(() => studentRecord),
      StudentService.getParents(studentRecord.id, silent).catch(() => [] as any[]),
      StudentService.getEnrollments(studentRecord.id, silent).catch(() => [] as any[]),
    ]);
    setStudentData(buildStudentDataFromRecord(fullStudent, parents, enrollments));
    setSearchMatches(null);
    // Fee waiver is per-student for this session — clear when loading another student.
    setTcSkipFeeCheckStudentId(null);
    setShowTcFeeDialog(false);
    setTcFeeDialogToggle(false);
    setTcFeeDialogOutstanding(null);
  }, []);

  // ── Fetch student ──────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!studentId.trim()) {
      alertCompat('Missing Input', 'Enter a Student ID or Admission No.');
      return;
    }
    setLoading(true);
    setGenerated(false);
    setStudentData(null);
    setSearchMatches(null);
    setSelectedType(null);
    setTcFields(DEFAULT_TC_FIELDS);
    setTcSkipFeeCheckStudentId(null);
    setShowTcFeeDialog(false);
    setTcFeeDialogToggle(false);
    setTcFeeDialogOutstanding(null);
    try {
      const query = studentId.trim();
      const silent = { silent: true } as const;
      const results = await StudentService.search(query, 20, { lifecycle: 'all' });

      if (results.length === 0) {
        try {
          const student = await StudentService.getById(query, silent);
          await loadStudentFromRecord(student);
          return;
        } catch {
          alertCompat('Not Found', 'No student matched the given ID, admission number, or name.');
          return;
        }
      }

      if (results.length === 1) {
        await loadStudentFromRecord(results[0]);
        return;
      }

      setSearchMatches(results);
    } catch (err: any) {
      alertCompat('Error', err?.message || 'Could not fetch student data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSearchMatch = async (student: Student) => {
    setLoading(true);
    try {
      await loadStudentFromRecord(student);
    } catch (err: any) {
      alertCompat('Error', err?.message || 'Could not load the selected student.');
    } finally {
      setLoading(false);
    }
  };

  // ── Generate certificate + DB serial ──────────────────────────────────────
  const issueCertificate = useCallback(async (type: CertificateType) => {
    if (!type) return;
    setLoading(true);
    try {
      let serial = '';
      try {
        serial = await CertificateService.getNextSerialNo(type, new Date().getFullYear());
      } catch {
        const y = new Date().getFullYear();
        serial = `${type}/${y}/${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
      }
      setSerialNo(serial);
      setSelectedType(type);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateCertificate = async (type: CertificateType) => {
    if (!studentData || !type) return;

    if (type === 'TC') {
      const { allowed, classNum } = isTcAllowedForClass(studentData.class);
      if (!allowed) {
        alertCompat(
          'TC Not Allowed',
          `Transfer Certificate can only be issued for students up to Class ${GEETHANJALI_TC_MAX_CLASS}.\n\n${studentData.name} is in Class ${classNum ?? studentData.class}.`
        );
        return;
      }

      // Per-student session waiver skips the fee gate for this student only.
      if (tcSkipFeeCheckStudentId !== studentData.id) {
        setLoading(true);
        try {
          const outstanding = await FeeService.getStudentOutstandingBalance(studentData.id);
          if (outstanding > 0) {
            setTcFeeDialogOutstanding(outstanding);
            setTcFeeDialogToggle(false);
            setShowTcFeeDialog(true);
            return;
          }
        } catch {
          setTcFeeDialogOutstanding(null);
          setTcFeeDialogToggle(false);
          setShowTcFeeDialog(true);
          return;
        } finally {
          setLoading(false);
        }
      }
    }

    await issueCertificate(type);
  };

  const handleTcFeeDialogCancel = () => {
    setShowTcFeeDialog(false);
    setTcFeeDialogToggle(false);
    setTcFeeDialogOutstanding(null);
  };

  const handleTcFeeDialogContinue = async () => {
    if (!studentData || !tcFeeDialogToggle) return;
    setTcSkipFeeCheckStudentId(studentData.id);
    setShowTcFeeDialog(false);
    setTcFeeDialogToggle(false);
    setTcFeeDialogOutstanding(null);
    await issueCertificate('TC');
  };

  // ── Save edits ─────────────────────────────────────────────────────────────
  const handleEditSave = useCallback((sd: StudentData, tc: TCEditableFields) => {
    // Re-derive parentName so edits to the father/mother name flow through to the
    // Bonafide's "S/o. D/o." line, which renders parentName (not fatherName).
    setStudentData({ ...sd, parentName: computeParentName(sd.fatherName, sd.motherName) });
    setTcFields(tc);
    setShowEdit(false);
  }, []);

  // ── Print certificate ──────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!studentData || !selectedType) return;
    const paper = getActivePaper(selectedType, tcLayout);
    const pdfFormat = getPdfFormat(selectedType, tcLayout);
    try {
      if (Platform.OS === 'web') {
        const element = resolveCertificateElement(certificateRef);
        await printCertificateElement(element, pdfFormat);
        return;
      }

      const logoDataUri = await getLogoDataUri(schoolProfile.logoUrl);
      const html = buildCertificateHTML(
        studentData, tcFields, selectedType, serialNo, logoDataUri, schoolProfile, tcLayout, bonafideHeaderTheme,
      );
      const Print = await import('expo-print');
      await Print.printAsync({
        html,
        width: paper.widthPt,
        height: paper.heightPt,
      });
    } catch (err: any) {
      alertCompat('Print Error', err?.message || 'Could not print certificate.');
    }
  };

  // ── Download PDF (html2canvas + jsPDF on web; expo-print file on native) ───
  const handleDownload = async () => {
    if (!studentData || !selectedType) return;
    const paper = getActivePaper(selectedType, tcLayout);
    const pdfFormat = getPdfFormat(selectedType, tcLayout);
    const safeName = studentData.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'student';
    const fileName = `certificate_${safeName}_${serialNo.replace(/\//g, '-')}.pdf`;

    try {
      if (Platform.OS === 'web') {
        const element = resolveCertificateElement(certificateRef);
        await downloadCertificatePdf(element, pdfFormat, fileName);
      } else {
        const logoDataUri = await getLogoDataUri(schoolProfile.logoUrl);
        const html = buildCertificateHTML(
          studentData, tcFields, selectedType, serialNo, logoDataUri, schoolProfile, tcLayout, bonafideHeaderTheme,
        );
        const Print = await import('expo-print');
        const { uri } = await Print.printToFileAsync({
          html,
          width: paper.widthPt,
          height: paper.heightPt,
        });
        
        const FileSystem: any = await import('expo-file-system/legacy');
        const newUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.moveAsync({
          from: uri,
          to: newUri,
        });

        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newUri, {
            mimeType: 'application/pdf',
            dialogTitle: fileName,
            UTI: 'com.adobe.pdf',
          });
        } else {
          alertCompat('PDF Saved', `Certificate saved to:\n${newUri}`);
        }
      }

      // Save issued record to DB
      setSaving(true);
      try {
        await CertificateService.saveIssuedCertificate({
          studentId: studentData.id,
          type: selectedType,
          serialNo,
          issuedAt: new Date().toISOString(),
          data: { studentData, tcFields },
        });
      } catch { /* non-blocking */ }
      setSaving(false);
    } catch (err: any) {
      alertCompat('Export Failed', err?.message || 'Could not generate PDF.');
    }
  };

  const handleReset = () => {
    setGenerated(false);
    setStudentData(null);
    setSearchMatches(null);
    setSelectedType(null);
    setStudentId('');
    setTcFields(DEFAULT_TC_FIELDS);
    setSerialNo('');
    setTcLayout('A4');
    setTcSkipFeeCheckStudentId(null);
    setShowTcFeeDialog(false);
    setTcFeeDialogToggle(false);
    setTcFeeDialogOutstanding(null);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={isDark ? ['#0F1117', '#0F1117'] : ['#F0F4FF', '#F8FAFC']} style={StyleSheet.absoluteFill} />
      {!shellActive && <AdminHeader title="Certificate Generator" showBackButton />}
      <StepIndicator step={step} isDark={isDark} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: Search ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
          <View style={styles.cardLabelRow}>
            <View style={styles.stepPill}><Text style={styles.stepPillText}>01</Text></View>
            <Text style={styles.cardTitle}>Find Student</Text>
          </View>
          <Text style={styles.cardSub}>Enter student ID, admission number, or name</Text>
          <View style={[styles.searchRow, ds.searchBarWrapper, focused && styles.searchRowFocused]}>
            <Ionicons name="search-outline" size={18} color={focused ? '#4F46E5' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF')} />
            <AppTextInput
              style={[ds.inputInChrome, styles.searchInput]}
              placeholder="e.g. 101, ADM2024..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'}
              value={studentId}
              onChangeText={setStudentId}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {studentId.length > 0 && (
              <TouchableOpacity onPress={() => setStudentId('')}>
                <Ionicons name="close-circle" size={17} color={isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={[styles.searchBtn, loading && styles.searchBtnDisabled]} onPress={handleSearch} disabled={loading} activeOpacity={0.88}>
            {loading ? (
              <View style={styles.searchBtnGrad}><LogoLoader size={24} color="#FFF" /></View>
            ) : (
              <LinearGradient colors={['#4F46E5', '#818CF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.searchBtnGrad}>
                <Ionicons name="person-outline" size={16} color="#FFF" />
                <Text style={styles.searchBtnText}>Search Student</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </Animated.View>

        {searchMatches && searchMatches.length > 0 && !studentData && (
          <Animated.View entering={FadeInDown.delay(40).duration(350)} style={styles.matchSection}>
            <Text style={styles.matchHint}>
              {searchMatches.length} students matched — select the correct one
            </Text>
            {searchMatches.map((student, index) => (
              <Pressable
                key={student.id}
                onPress={() => handleSelectSearchMatch(student)}
                disabled={loading}
                style={({ pressed }) => [
                  styles.matchCard,
                  pressed && styles.matchCardPressed,
                  loading && styles.matchCardDisabled,
                ]}
              >
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>
                    {studentRecordName(student).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {studentRecordName(student)}
                  </Text>
                  <View style={styles.studentMetaRow}>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{studentRecordClass(student)}</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>#{student.admission_no}</Text>
                    </View>
                    {student.category?.name ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>{student.category.name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'}
                />
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* ── Step 2: Student found + Select type ── */}
        {studentData && !generated && (
          <Animated.View entering={FadeInDown.delay(50).duration(400).springify()}>
            <View style={styles.studentStrip}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>{studentData.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName} numberOfLines={1}>{studentData.name}</Text>
                <View style={styles.studentMetaRow}>
                  <View style={styles.metaChip}><Text style={styles.metaChipText}>{studentData.class}</Text></View>
                  <View style={styles.metaChip}><Text style={styles.metaChipText}>#{studentData.admissionNo}</Text></View>
                  <View style={styles.metaChip}><Text style={styles.metaChipText}>{studentData.category}</Text></View>
                </View>
              </View>
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={14} color="#10B981" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <View style={[styles.feeWaiverStrip, tcFeeWaivedForCurrentStudent && styles.feeWaiverStripOn]}>
              <View style={styles.feeWaiverCopy}>
                <Text style={styles.feeWaiverTitle}>Allow TC without fee clearance</Text>
                <Text style={styles.feeWaiverHint}>
                  {tcFeeWaivedForCurrentStudent
                    ? `Enabled for ${studentData.name} only. Turn off to require fee clearance again.`
                    : `Off by default. When dues block TC, use the dialog — or enable here for ${studentData.name} only.`}
                </Text>
              </View>
              <Switch
                value={tcFeeWaivedForCurrentStudent}
                onValueChange={(on) => setTcSkipFeeCheckStudentId(on ? studentData.id : null)}
                trackColor={{ false: isDark ? '#374151' : '#CBD5E1', true: '#FCA5A5' }}
                thumbColor={tcFeeWaivedForCurrentStudent ? '#DC2626' : '#FFFFFF'}
              />
            </View>

            <View style={styles.selectHeader}>
              <View style={styles.stepPill}><Text style={styles.stepPillText}>02</Text></View>
              <Text style={styles.cardTitle}>Choose Certificate</Text>
            </View>
            <View style={styles.typeGrid}>
              {(['TC', 'BONAFIDE'] as const).map(t => (
                <TypeCard key={t} type={t} isDark={isDark} onPress={() => generateCertificate(t)} />
              ))}
            </View>
            <TouchableOpacity style={styles.resetLink} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={14} color={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'} />
              <Text style={styles.resetLinkText}>Search a different student</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Step 3: Preview ── */}
        {generated && selectedType && studentData && (
          <>
            <View style={styles.selectHeader}>
              <View style={[styles.stepPill, { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#D1FAE5' }]}>
                <Text style={[styles.stepPillText, { color: '#10B981' }]}>03</Text>
              </View>
              <Text style={styles.cardTitle}>Certificate Preview</Text>
              {saving && <ActivityIndicator size="small" color="#4F46E5" style={{ marginLeft: 8 }} />}
            </View>
            <CertificatePreview
              ref={certificateRef}
              studentData={studentData}
              tcFields={tcFields}
              selectedType={selectedType}
              serialNo={serialNo}
              school={schoolProfile}
              tcLayout={tcLayout}
              setTcLayout={setTcLayout}
              bonafideHeaderTheme={bonafideHeaderTheme}
              setBonafideHeaderTheme={setBonafideHeaderTheme}
              onEdit={() => setShowEdit(true)}
              onPrint={handlePrint}
              onDownload={handleDownload}
            />
            <TouchableOpacity style={[styles.resetLink, { marginTop: 8 }]} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={14} color={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'} />
              <Text style={styles.resetLinkText}>Start over</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Edit Modal ── */}
      {studentData && (
        <EditModal
          visible={showEdit}
          isDark={isDark}
          studentData={studentData}
          tcFields={tcFields}
          onSave={handleEditSave}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* ── TC fee-waiver dialog (per student, this session) ── */}
      {studentData && (
        <TcFeeWaiverDialog
          visible={showTcFeeDialog}
          isDark={isDark}
          studentName={studentData.name}
          outstanding={tcFeeDialogOutstanding}
          waiveEnabled={tcFeeDialogToggle}
          onWaiveChange={setTcFeeDialogToggle}
          onCancel={handleTcFeeDialogCancel}
          onContinue={handleTcFeeDialogContinue}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingTop: 4 },
  card: { backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', gap: 10, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 14 }, android: { elevation: 4 } }) },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: isDark ? 'rgba(79,70,229,0.2)' : '#EEF2FF' },
  stepPillText: { fontSize: 10, fontWeight: '900', color: '#4F46E5', letterSpacing: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: isDark ? '#F9FAFB' : '#111827' },
  cardSub: { fontSize: 13, color: isDark ? 'rgba(255,255,255,0.35)' : '#6B7280', fontWeight: '500', marginTop: -4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB', borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', borderRadius: 13, paddingHorizontal: 13, height: 48 },
  searchRowFocused: { borderColor: '#4F46E5', backgroundColor: isDark ? 'rgba(79,70,229,0.07)' : '#F5F3FF' },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', color: isDark ? '#F9FAFB' : '#111827' },
  searchBtn: { borderRadius: 13, overflow: 'hidden', height: 48, ...Platform.select({ ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 }, android: { elevation: 5 } }) },
  searchBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  searchBtnGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  searchBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  matchSection: { marginBottom: 16, gap: 8 },
  matchHint: { fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.45)' : '#64748B', marginBottom: 4 },
  matchCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' },
  matchCardPressed: { opacity: 0.85, borderColor: '#4F46E5' },
  matchCardDisabled: { opacity: 0.6 },
  studentStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 16, borderWidth: 1, borderLeftWidth: 4, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', borderLeftColor: '#4F46E5', ...Platform.select({ ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10 }, android: { elevation: 3 } }) },
  studentAvatar: { width: 46, height: 46, borderRadius: 14, backgroundColor: isDark ? 'rgba(79,70,229,0.2)' : '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '800', color: isDark ? '#F9FAFB' : '#111827', marginBottom: 5 },
  studentMetaRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  metaChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6' },
  metaChipText: { fontSize: 11, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  feeWaiverStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E5E7EB',
  },
  feeWaiverStripOn: {
    borderColor: isDark ? 'rgba(248,113,113,0.45)' : '#FECACA',
    backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
  },
  feeWaiverCopy: { flex: 1, gap: 3 },
  feeWaiverTitle: { fontSize: 13, fontWeight: '800', color: isDark ? '#F9FAFB' : '#111827' },
  feeWaiverHint: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280' },
  selectHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  typeGrid: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  resetLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
  resetLinkText: { fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF' },
});

/*
 * ─── CertificateService contract (create at src/services/certificateService.ts) ──
 *
 * export const CertificateService = {
 *   // Returns next serial string like "TC/2025/042"
 *   async getNextSerialNo(type: 'TC' | 'BONAFIDE', year: number): Promise<string> {
 *     const { data } = await supabase.rpc('next_certificate_serial', { cert_type: type, cert_year: year });
 *     return data; // e.g. "TC/2025/042"
 *   },
 *   // Persist issued certificate record
 *   async saveIssuedCertificate(payload: {
 *     studentId: string; type: string; serialNo: string;
 *     issuedAt: string; data: object;
 *   }) {
 *     return supabase.from('issued_certificates').insert(payload);
 *   },
 * };
 *
 * Supabase SQL:
 *   CREATE TABLE issued_certificates (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     student_id uuid REFERENCES students(id),
 *     type text NOT NULL,               -- 'TC' | 'BONAFIDE'
 *     serial_no text NOT NULL UNIQUE,
 *     issued_at timestamptz NOT NULL,
 *     data jsonb,
 *     created_at timestamptz DEFAULT now()
 *   );
 *   CREATE SEQUENCE tc_seq;
 *   CREATE SEQUENCE bonafide_seq;
 *   CREATE OR REPLACE FUNCTION next_certificate_serial(cert_type text, cert_year int)
 *   RETURNS text LANGUAGE plpgsql AS $$
 *   DECLARE n int;
 *   BEGIN
 *     IF cert_type = 'TC' THEN n := nextval('tc_seq');
 *     ELSE n := nextval('bonafide_seq'); END IF;
 *     RETURN cert_type || '/' || cert_year || '/' || LPAD(n::text, 3, '0');
 *   END; $$;
 *
 * ─── WEB EXPORT NOTE (certificatePrint.ts) ───────────────────────────────────
 * On web, Print/Download go through printCertificateElement()/downloadCertificatePdf()
 * with pdfFormat 'BONAFIDE'. That file is NOT in this component. For the half-A4
 * fix to also apply on web, the 'BONAFIDE' branch there MUST set the jsPDF/print
 * page to A5 landscape (210 × 148.5 mm), and ideally use html2canvas scale: 3 for
 * crisp output. Native (expo-print) is already fully handled here.
 */
