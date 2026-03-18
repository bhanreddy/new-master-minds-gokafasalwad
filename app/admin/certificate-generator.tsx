import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Dimensions, Image, Platform, Pressable,
  Modal, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, {
  FadeIn, FadeInDown, SlideInDown,
  useSharedValue, useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { StudentService } from '@/src/services/studentService';
import { CertificateService } from '@/src/services/certificateService';
import { SCHOOL_CONFIG } from '@/src/constants/schoolConfig';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

const { width, height } = Dimensions.get('window');

// ─── Paper size constants ─────────────────────────────────────────────────────
// Eagle  ≈ 13.4″ × 8.5″ landscape  (used for Transfer Certificate)
// A5     ≈ 5.83″ × 8.27″ portrait  (used for Bonafide Certificate)
export const PAPER = {
  EAGLE: { widthPt: 964.8, heightPt: 612, label: 'Eagle (13.4″ × 8.5″)' },
  A5: { widthPt: 420.9, heightPt: 595.3, label: 'A5 / Half-A4 (148 × 210 mm)' },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type CertificateType = 'TC' | 'BONAFIDE' | null;

interface StudentData {
  id: string;
  name: string;
  fatherName: string;
  motherName: string;
  class: string;
  dob: string;
  dobWords: string;
  admissionNo: string;
  academicYear: string;
  address: string;
  nationality: string;
  category: string;
  admissionDate: string;
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
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
}

function dobToWords(dobStr: string): string {
  // Accepts dd/MM/yyyy or yyyy-MM-dd
  try {
    let d: Date;
    if (dobStr.includes('-')) d = new Date(dobStr);
    else {
      const [dd, mm, yyyy] = dobStr.split('/');
      d = new Date(+yyyy, +mm - 1, +dd);
    }
    if (isNaN(d.getTime())) return 'N/A';
    const day = d.getDate();
    const month = MONTHS_LONG[d.getMonth()];
    const year = d.getFullYear();
    return `${numToWords(day)} ${month} ${numToWords(year)}`;
  } catch { return 'N/A'; }
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
    paper: PAPER.EAGLE,
    desc: 'For students leaving or transferring to another institution.',
  },
  BONAFIDE: {
    label: 'Bonafide Certificate', short: 'BON',
    icon: 'certificate-outline' as const,
    iconColor: '#059669', iconBg: '#ECFDF5',
    accentLight: '#059669', accentDark: '#34D399',
    gradFrom: '#059669', gradTo: '#10B981',
    paper: PAPER.A5,
    desc: 'Official proof of enrolment for general purposes.',
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
            {cfg.paper.label}
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
      <TextInput
        style={[efStyles.input, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
          color: isDark ? '#F9FAFB' : '#111827',
          height: multiline ? 72 : 42,
          textAlignVertical: multiline ? 'top' : 'center',
        }]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB'}
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
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
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
                <EditField label="Class" value={sd.class} onChangeText={v => setSD('class', v)} isDark={isDark} />
                <EditField
                  label="Date of Birth (dd/MM/yyyy)"
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
                      <TextInput
                        style={[emStyles.subjectInput, {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                          color: isDark ? '#F9FAFB' : '#111827',
                        }]}
                        value={tc.subjects[i]}
                        onChangeText={v => setSubject(i, v)}
                        placeholder="Subject"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB'}
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

// ─── Certificate Preview ──────────────────────────────────────────────────────
function CertificatePreview({
  studentData, tcFields, selectedType, serialNo, onEdit, onDownload,
}: {
  studentData: StudentData; tcFields: TCEditableFields;
  selectedType: CertificateType; serialNo: string;
  onEdit: () => void; onDownload: () => void;
}) {
  if (!selectedType) return null;
  const cfg = CERT_CONFIG[selectedType];
  const isTC = selectedType === 'TC';
  const title = isTC ? 'TRANSFER CERTIFICATE' : 'BONAFIDE CERTIFICATE';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={cpStyles.wrap}>

      {/* Paper size badge */}
      <View style={cpStyles.paperBadgeRow}>
        <View style={[cpStyles.paperBadge, { backgroundColor: `${cfg.gradFrom}18` }]}>
          <Ionicons name="document-text-outline" size={12} color={cfg.gradFrom} />
          <Text style={[cpStyles.paperBadgeText, { color: cfg.gradFrom }]}>{cfg.paper.label}</Text>
        </View>
        <Text style={cpStyles.serialText}>No. {serialNo}</Text>
      </View>

      {/* Paper Document */}
      <View style={cpStyles.paper}>
        {/* Top color bar */}
        <LinearGradient colors={[cfg.gradFrom, cfg.gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cpStyles.topBar} />

        {/* Watermark */}
        <View style={cpStyles.watermarkWrap} pointerEvents="none">
          <Image source={SCHOOL_CONFIG.logo} style={cpStyles.watermarkImg} />
        </View>

        {/* School Header */}
        <View style={cpStyles.schoolHeader}>
          <Image source={SCHOOL_CONFIG.logo} style={cpStyles.logo} />
          <Text style={cpStyles.schoolName}>{SCHOOL_CONFIG.name}</Text>
          <Text style={cpStyles.schoolAddr}>{SCHOOL_CONFIG.address || 'Madhapur, Hyderabad – 500081'}</Text>
          <Text style={cpStyles.affiliation}>
            Affiliated to CBSE, New Delhi · Affiliation No. {tcFields.cbseAffiliationNo || SCHOOL_CONFIG.cbseAffiliationNo || '———'}
          </Text>
          <View style={[cpStyles.dividerLine, { backgroundColor: cfg.gradFrom }]} />
        </View>

        {/* Title block */}
        <View style={cpStyles.titleBlock}>
          <Text style={[cpStyles.certTitle, { color: cfg.gradFrom }]}>{title}</Text>
          <Text style={cpStyles.refNo}>Ref No: {serialNo}</Text>
        </View>

        {/* Body: TC */}
        {isTC ? (
          <View style={cpStyles.tcContainer}>
            <View style={cpStyles.tcHeaderRow}>
              <Text style={cpStyles.tcHeaderText}>CBSE Affiliation No. : {dot(tcFields.cbseAffiliationNo)}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={cpStyles.tcHeaderText}>School Code : {dot(tcFields.schoolCode)}</Text>
                <Text style={cpStyles.tcHeaderText}>Scholar No. : {studentData.admissionNo}</Text>
              </View>
            </View>
            <View style={cpStyles.tcList}>
              <Text style={cpStyles.tcItem}>1. Name of Pupil : <Text style={cpStyles.bold}>{studentData.name}</Text></Text>
              <Text style={cpStyles.tcItem}>2. Father's/Guardian Name : <Text style={cpStyles.bold}>{studentData.fatherName}</Text></Text>
              <Text style={cpStyles.tcItem}>3. Mother's Name : <Text style={cpStyles.bold}>{studentData.motherName}</Text></Text>
              <Text style={cpStyles.tcItem}>4. Nationality : <Text style={cpStyles.bold}>{studentData.nationality}</Text></Text>
              <Text style={cpStyles.tcItem}>5. Whether Candidate belongs to SC/ST/OBC : <Text style={cpStyles.bold}>{studentData.category}</Text></Text>
              <Text style={cpStyles.tcItem}>6. Date of First Admission in the School with Class : <Text style={cpStyles.bold}>{studentData.admissionDate}</Text></Text>
              <Text style={cpStyles.tcItem}>7. Date of Birth (In Figures) : <Text style={cpStyles.bold}>{studentData.dob}</Text></Text>
              <Text style={[cpStyles.tcItem, { paddingLeft: 16 }]}>   (In Words) : <Text style={cpStyles.bold}>{studentData.dobWords}</Text></Text>
              <Text style={cpStyles.tcItem}>8. Class In Which Pupil Last Studied : <Text style={cpStyles.bold}>{studentData.class}</Text></Text>
              <Text style={cpStyles.tcItem}>9. School/Board Examination Last Taken with Result : {dot(tcFields.examResult)}</Text>
              <Text style={cpStyles.tcItem}>10. Whether Failed, If So Once/Twice in Same Class : {dot(tcFields.failedDetails)}</Text>
              <Text style={cpStyles.tcItem}>
                11. Subject Studied :{'  '}
                {tcFields.subjects.map((s, i) => `(${['i', 'ii', 'iii', 'iv', 'v', 'vi'][i]}) ${dot(s)}`).join('  ')}
              </Text>
              <Text style={cpStyles.tcItem}>12. Whether Qualified for Promotion to Higher Class : {dot(tcFields.qualifiedPromotion)}</Text>
              <Text style={[cpStyles.tcItem, { paddingLeft: 22 }]}>    (If so, to which class) : {dot(tcFields.promotionClass)}</Text>
              <Text style={cpStyles.tcItem}>13. Month Upto which School Dues Paid : {dot(tcFields.schoolDuesPaid)}</Text>
              <Text style={cpStyles.tcItem}>14. Any Fee Concession availed of : {dot(tcFields.feeConcession)}</Text>
              <Text style={cpStyles.tcItem}>15. Total No. of Working Days : {dot(tcFields.totalWorkingDays)}</Text>
              <Text style={cpStyles.tcItem}>16. Total No. of Working Days Present : {dot(tcFields.workingDaysPresent)}</Text>
              <Text style={cpStyles.tcItem}>17. Whether NCC Cadet / Scout Guide : {dot(tcFields.nccDetails)}</Text>
              <Text style={cpStyles.tcItem}>18. Extra-Curricular Activities : {dot(tcFields.extraCurricular)}</Text>
              <Text style={cpStyles.tcItem}>19. General Conduct : {dot(tcFields.generalConduct)}</Text>
              <Text style={cpStyles.tcItem}>20. Date of Application for Certificate : {dot(tcFields.applicationDate)}</Text>
              <Text style={cpStyles.tcItem}>21. Date of Issue of Certificate : <Text style={cpStyles.bold}>{today}</Text></Text>
              <Text style={cpStyles.tcItem}>22. Reasons for Leaving the School : {dot(tcFields.leavingReason)}</Text>
              <Text style={cpStyles.tcItem}>23. Any Other Remarks : {dot(tcFields.otherRemarks)}</Text>
            </View>
          </View>
        ) : (
          /* Body: Bonafide – A5 / half-A4 */
          <View style={cpStyles.body}>
            <Text style={cpStyles.bodyText}>
              This is to certify that{' '}
              <Text style={cpStyles.bold}>{studentData.name}</Text>,
              {' '}ward of{' '}
              <Text style={cpStyles.bold}>{studentData.fatherName}</Text>,
              {' '}bearing Admission No.{' '}
              <Text style={cpStyles.bold}>{studentData.admissionNo}</Text>,
              {' '}is a bonafide student of this institution currently enrolled in class{' '}
              <Text style={cpStyles.bold}>{studentData.class}</Text>
              {' '}during the academic year{' '}
              <Text style={cpStyles.bold}>{studentData.academicYear}</Text>.
            </Text>
            <Text style={[cpStyles.bodyText, { marginTop: 14 }]}>
              Date of Birth:{' '}
              <Text style={cpStyles.bold}>{studentData.dob}</Text>
              {studentData.dobWords !== 'N/A' ? ` (${studentData.dobWords})` : ''}.{'\n'}
              Nationality:{' '}
              <Text style={cpStyles.bold}>{studentData.nationality}</Text>.{' '}
              Category:{' '}
              <Text style={cpStyles.bold}>{studentData.category}</Text>.
            </Text>
            <Text style={[cpStyles.bodyText, { marginTop: 14 }]}>
              He/She bears a good moral character and is known for sincere academic conduct.
              This certificate is issued upon request and may be presented for any official or scholastic purpose.
            </Text>
            <View style={cpStyles.bonafideNote}>
              <Ionicons name="information-circle-outline" size={13} color="#059669" />
              <Text style={cpStyles.bonafideNoteText}>Issued on: {today}</Text>
            </View>
          </View>
        )}

        {/* Footer / Signatures */}
        <View style={cpStyles.footer}>
          <View style={cpStyles.sigBlock}>
            <Text style={cpStyles.sigDate}>Date: {today}</Text>
            <View style={cpStyles.sigStamp}>
              <Text style={cpStyles.sigStampText}>SCHOOL STAMP</Text>
            </View>
          </View>
          <View style={cpStyles.sigBlock}>
            <View style={cpStyles.sigLine} />
            <Text style={cpStyles.sigLabel}>Class Teacher</Text>
          </View>
          <View style={cpStyles.sigBlock}>
            <View style={cpStyles.sigLine} />
            <Text style={cpStyles.sigLabel}>Principal</Text>
          </View>
        </View>

        {/* Bottom bar */}
        <LinearGradient colors={[cfg.gradFrom, cfg.gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cpStyles.bottomBar} />
      </View>

      {/* Actions */}
      <View style={cpStyles.actions}>
        <TouchableOpacity style={cpStyles.editBtn} onPress={onEdit} activeOpacity={0.8}>
          <Feather name="edit-2" size={16} color="#6B7280" />
          <Text style={cpStyles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 2, borderRadius: 14, overflow: 'hidden' }} onPress={onDownload} activeOpacity={0.88}>
          <LinearGradient colors={[cfg.gradFrom, cfg.gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cpStyles.downloadGrad}>
            <Feather name="download" size={16} color="#FFF" />
            <Text style={cpStyles.downloadText}>Download PDF ({cfg.paper.label.split(' ')[0]})</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
const cpStyles = StyleSheet.create({
  wrap: { marginTop: 20, gap: 16 },
  paperBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paperBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  paperBadgeText: { fontSize: 11, fontWeight: '700' },
  serialText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  paper: { backgroundColor: '#FAFAFA', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20 }, android: { elevation: 8 } }) },
  topBar: { height: 6 },
  bottomBar: { height: 4 },
  watermarkWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  watermarkImg: { width: 260, height: 260, opacity: 0.04, resizeMode: 'contain' },
  schoolHeader: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 20, paddingBottom: 4 },
  logo: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 8 },
  schoolName: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0.8, textAlign: 'center' },
  schoolAddr: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },
  affiliation: { fontSize: 10, color: '#94A3B8', fontStyle: 'italic', marginTop: 2, textAlign: 'center' },
  dividerLine: { height: 1.5, width: '80%', marginTop: 16, opacity: 0.3, borderRadius: 1 },
  titleBlock: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  certTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5, textDecorationLine: 'underline', textAlign: 'center' },
  refNo: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  // TC body
  tcContainer: { paddingHorizontal: 22, paddingBottom: 24 },
  tcHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  tcHeaderText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  tcList: { gap: 5 },
  tcItem: { fontSize: 11, lineHeight: 18, color: '#1E293B', fontWeight: '500' },
  // Bonafide body
  body: { paddingHorizontal: 22, paddingBottom: 16 },
  bodyText: { fontSize: 13.5, lineHeight: 24, color: '#1E293B', textAlign: 'justify' },
  bonafideNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  bonafideNoteText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  bold: { fontWeight: '800', color: '#0F172A' },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  sigBlock: { alignItems: 'center', gap: 6 },
  sigDate: { fontSize: 11, fontWeight: '600', color: '#475569' },
  sigStamp: { width: 70, height: 40, borderRadius: 4, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  sigStampText: { fontSize: 8, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  sigLine: { width: 90, height: 1, backgroundColor: '#334155' },
  sigLabel: { fontSize: 11, fontWeight: '600', color: '#475569' },
  // Actions
  actions: { flexDirection: 'row', gap: 12 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 15, borderRadius: 14, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  downloadGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14 },
  downloadText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
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
): string {
  if (!type) return '';
  const cfg = CERT_CONFIG[type];
  const isTC = type === 'TC';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const title = isTC ? 'TRANSFER CERTIFICATE' : 'BONAFIDE CERTIFICATE';

  const tcRows = isTC ? `
    <div class="tc-header-row">
      <span>CBSE Affiliation No. : ${tcFields.cbseAffiliationNo || '—'}</span>
      <span>School Code : ${tcFields.schoolCode || '—'} &nbsp;&nbsp; Scholar No. : ${studentData.admissionNo}</span>
    </div>
    <ol class="tc-list">
      <li>Name of Pupil : <strong>${studentData.name}</strong></li>
      <li>Father's/Guardian Name : <strong>${studentData.fatherName}</strong></li>
      <li>Mother's Name : <strong>${studentData.motherName}</strong></li>
      <li>Nationality : <strong>${studentData.nationality}</strong></li>
      <li>Whether Candidate belongs to SC/ST/OBC : <strong>${studentData.category}</strong></li>
      <li>Date of First Admission : <strong>${studentData.admissionDate}</strong></li>
      <li>Date of Birth (Figures) : <strong>${studentData.dob}</strong><br>&nbsp;&nbsp;&nbsp;(In Words) : <strong>${studentData.dobWords}</strong></li>
      <li>Class Last Studied : <strong>${studentData.class}</strong></li>
      <li>Exam Last Taken with Result : ${tcFields.examResult || '……………'}</li>
      <li>Whether Failed, If So Once/Twice : ${tcFields.failedDetails || '……………'}</li>
      <li>Subjects : ${tcFields.subjects.map((s, i) => `(${['i', 'ii', 'iii', 'iv', 'v', 'vi'][i]}) ${s || '…'}`).join('  ')}</li>
      <li>Qualified for Promotion : ${tcFields.qualifiedPromotion || '……………'}<br>&nbsp;&nbsp;&nbsp;To Class : ${tcFields.promotionClass || '……………'}</li>
      <li>School Dues Paid upto Month : ${tcFields.schoolDuesPaid || '……………'}</li>
      <li>Fee Concession : ${tcFields.feeConcession || '……………'}</li>
      <li>Total Working Days : ${tcFields.totalWorkingDays || '……………'}</li>
      <li>Working Days Present : ${tcFields.workingDaysPresent || '……………'}</li>
      <li>NCC / Scout Guide : ${tcFields.nccDetails || '……………'}</li>
      <li>Extra-Curricular Activities : ${tcFields.extraCurricular || '……………'}</li>
      <li>General Conduct : ${tcFields.generalConduct || '……………'}</li>
      <li>Date of Application : ${tcFields.applicationDate || '……………'}</li>
      <li>Date of Issue : <strong>${today}</strong></li>
      <li>Reason for Leaving : ${tcFields.leavingReason || '……………'}</li>
      <li>Other Remarks : ${tcFields.otherRemarks || '……………'}</li>
    </ol>` : `
    <p class="body-text">This is to certify that <strong>${studentData.name}</strong>, ward of <strong>${studentData.fatherName}</strong>, bearing Admission No. <strong>${studentData.admissionNo}</strong>, is a bonafide student of this institution currently enrolled in class <strong>${studentData.class}</strong> during the academic year <strong>${studentData.academicYear}</strong>.</p>
    <p class="body-text">Date of Birth: <strong>${studentData.dob}</strong>${studentData.dobWords !== 'N/A' ? ` (${studentData.dobWords})` : ''}. Nationality: <strong>${studentData.nationality}</strong>. Category: <strong>${studentData.category}</strong>.</p>
    <p class="body-text">He/She bears a good moral character and is known for sincere academic conduct. This certificate is issued upon request and may be presented for any official or scholastic purpose.</p>`;

  // Paper: Eagle = 34cm × 21.5cm landscape; A5 = 14.85cm × 21cm portrait
  const pageSize = isTC
    ? '@page { size: 34cm 21.5cm landscape; margin: 1.2cm; }'
    : '@page { size: A5 portrait; margin: 1.2cm; }';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    ${pageSize}
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; }
    .top-bar { height: 8px; background: linear-gradient(to right, ${cfg.gradFrom}, ${cfg.gradTo}); }
    .school-header { text-align: center; padding: 16px 20px 4px; }
    .school-name { font-size: 20px; font-weight: 900; color: #0F172A; letter-spacing: 0.8px; }
    .school-addr { font-size: 12px; color: #64748B; margin-top: 2px; }
    .affiliation { font-size: 11px; color: #94A3B8; font-style: italic; }
    .divider { height: 1.5px; background: ${cfg.gradFrom}; width: 80%; margin: 12px auto; opacity: 0.4; }
    .title-block { text-align: center; padding: 12px; }
    .cert-title { font-size: 18px; font-weight: 900; color: ${cfg.gradFrom}; letter-spacing: 2px; text-decoration: underline; }
    .ref-no { font-size: 11px; color: #94A3B8; }
    .tc-header-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 12px; padding: 0 22px; }
    .tc-list { padding: 0 22px; margin: 0; font-size: 11px; line-height: 22px; color: #1E293B; }
    .tc-list li { margin-bottom: 3px; }
    .body-text { padding: 0 22px; font-size: 13.5px; line-height: 24px; color: #1E293B; text-align: justify; margin: 0 0 12px; }
    .footer { display: flex; justify-content: space-between; padding: 16px 22px; border-top: 1px solid #F1F5F9; font-size: 11px; color: #475569; }
    .sig-line { border-bottom: 1px solid #334155; width: 90px; margin-bottom: 4px; }
    .stamp-box { border: 1.5px dashed #CBD5E1; width: 70px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94A3B8; font-weight: 700; letter-spacing: 0.5px; }
    .bottom-bar { height: 5px; background: linear-gradient(to right, ${cfg.gradFrom}, ${cfg.gradTo}); margin-top: 4px; }
  </style></head><body>
  <div class="top-bar"></div>
  <div class="school-header">
    <div class="school-name">${SCHOOL_CONFIG.name}</div>
    <div class="school-addr">${SCHOOL_CONFIG.address || 'Madhapur, Hyderabad – 500081'}</div>
    <div class="affiliation">Affiliated to CBSE, New Delhi · Affiliation No. ${tcFields.cbseAffiliationNo || SCHOOL_CONFIG.cbseAffiliationNo || '———'}</div>
    <div class="divider"></div>
  </div>
  <div class="title-block">
    <div class="cert-title">${title}</div>
    <div class="ref-no">Ref No: ${serialNo}</div>
  </div>
  ${tcRows}
  <div class="footer">
    <div><div>Date: ${today}</div><div class="stamp-box">SCHOOL STAMP</div></div>
    <div><div class="sig-line"></div><div>Class Teacher</div></div>
    <div><div class="sig-line"></div><div>Principal</div></div>
  </div>
  <div class="bottom-bar"></div>
</body></html>`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CertificateGenerator() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [tcFields, setTcFields] = useState<TCEditableFields>(DEFAULT_TC_FIELDS);
  const [selectedType, setSelectedType] = useState<CertificateType>(null);
  const [generated, setGenerated] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [serialNo, setSerialNo] = useState('');
  const [saving, setSaving] = useState(false);

  const step = generated ? 3 : studentData ? 2 : 1;

  // ── Fetch student ──────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!studentId.trim()) {
      Alert.alert('Missing Input', 'Enter a Student ID or Admission No.');
      return;
    }
    setLoading(true);
    setGenerated(false);
    setStudentData(null);
    setSelectedType(null);
    setTcFields(DEFAULT_TC_FIELDS);
    try {
      let student: any = null;
      const results = await StudentService.search(studentId);
      if (results?.length > 0) {
        const exact = results.find((s: any) => s.admission_no === studentId);
        student = exact || results[0];
      }
      if (!student) {
        try { student = await StudentService.getById(studentId); } catch { /* noop */ }
      }
      if (!student) {
        Alert.alert('Not Found', 'No student matched the given ID or Admission No.');
        return;
      }

      const enrollment = student.current_enrollment;
      const cls = enrollment?.class_code || '';
      const sec = enrollment?.section_name || '';
      const fatherObj = student.parents?.find((p: any) => p.relation === 'Father');
      const father = fatherObj ? `${fatherObj.first_name} ${fatherObj.last_name}` : 'Guardian';
      const motherObj = student.parents?.find((p: any) => p.relation === 'Mother');
      const mother = motherObj ? `${motherObj.first_name} ${motherObj.last_name}` : 'N/A';
      const rawDob = student.dob || '';
      const dobFormatted = rawDob ? new Date(rawDob).toLocaleDateString('en-IN') : 'N/A';

      setStudentData({
        id: student.id,
        name: student.display_name || `${student.first_name} ${student.last_name}`,
        fatherName: father,
        motherName: mother,
        class: `${cls} – ${sec}`,
        dob: dobFormatted,
        dobWords: rawDob ? dobToWords(rawDob) : 'N/A',
        admissionNo: student.admission_no,
        academicYear: enrollment?.academic_year || '2025–2026',
        address: student.address || 'Hyderabad',
        nationality: student.nationality || 'Indian',
        category: student.category?.name || 'General',
        admissionDate: student.admission_date ? new Date(student.admission_date).toLocaleDateString('en-IN') : 'N/A',
      });
    } catch {
      Alert.alert('Error', 'Could not fetch student data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Generate certificate + DB serial ──────────────────────────────────────
  const generateCertificate = async (type: CertificateType) => {
    if (!studentData) return;
    setLoading(true);
    try {
      // Fetch serial number from DB (falls back to local if service unavailable)
      let serial = '';
      try {
        serial = await CertificateService.getNextSerialNo(type!, new Date().getFullYear());
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
  };

  // ── Save edits ─────────────────────────────────────────────────────────────
  const handleEditSave = useCallback((sd: StudentData, tc: TCEditableFields) => {
    setStudentData(sd);
    setTcFields(tc);
    setShowEdit(false);
  }, []);

  // ── Download PDF via expo-print ────────────────────────────────────────────
  const handleDownload = async () => {
    if (!studentData || !selectedType) return;
    const cfg = CERT_CONFIG[selectedType];
    try {
      // Dynamically import expo-print to keep bundle lean
      const Print = await import('expo-print');
      const html = buildCertificateHTML(studentData, tcFields, selectedType, serialNo);
      await Print.printAsync({
        html,
        // expo-print uses points; 1pt = 1/72"
        // Eagle: 34cm × 21.5cm landscape
        // A5:    148.5mm × 210mm portrait
        // (expo-print ignores these fields on some platforms, but the @page CSS above handles actual layout)
        width: cfg.paper.widthPt,
        height: cfg.paper.heightPt,
      });

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
      Alert.alert('Export Failed', err?.message || 'Could not generate PDF. Ensure expo-print is installed.');
    }
  };

  const handleReset = () => {
    setGenerated(false);
    setStudentData(null);
    setSelectedType(null);
    setStudentId('');
    setTcFields(DEFAULT_TC_FIELDS);
    setSerialNo('');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={isDark ? ['#0F1117', '#0F1117'] : ['#F0F4FF', '#F8FAFC']} style={StyleSheet.absoluteFill} />
      <AdminHeader title="Certificate Generator" showBackButton />
      <StepIndicator step={step} isDark={isDark} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: Search ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
          <View style={styles.cardLabelRow}>
            <View style={styles.stepPill}><Text style={styles.stepPillText}>01</Text></View>
            <Text style={styles.cardTitle}>Find Student</Text>
          </View>
          <Text style={styles.cardSub}>Enter student ID, admission number, or name</Text>
          <View style={[styles.searchRow, focused && styles.searchRowFocused]}>
            <Ionicons name="search-outline" size={18} color={focused ? '#4F46E5' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF')} />
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. 101, ADM2024..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
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
              studentData={studentData}
              tcFields={tcFields}
              selectedType={selectedType}
              serialNo={serialNo}
              onEdit={() => setShowEdit(true)}
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
 */