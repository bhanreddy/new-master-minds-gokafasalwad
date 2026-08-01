import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { type StudentHardDeletePreview, StudentService } from '../../services/studentService';
import { APIError } from '../../services/apiClient';

interface Props {
  visible: boolean;
  studentId: string | null;
  studentName: string;
  studentSubtitle?: string;
  onClose: () => void;
  /** Called after a successful permanent delete so the caller can refresh. */
  onDeleted: () => void;
}

const WIPED_ITEMS = [
  'Profile, login account & parent links',
  'All fee records, receipts & transactions',
  'Marks, exam results & attendance history',
  'Transport, hostel & certificate records',
  'Program progress & every other linked record',
];

/**
 * Three-step, hard-to-fire-by-accident confirmation for PERMANENTLY deleting a
 * student and all of their data:
 *   1. Strong caution + what gets wiped
 *   2. Type the student's exact name to unlock
 *   3. Final "last chance" confirm → calls the hard-delete API
 */
export default function HardDeleteStudentModal({
  visible,
  studentId,
  studentName,
  studentSubtitle,
  onClose,
  onDeleted,
}: Props) {
  const { theme, isDark } = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<StudentHardDeletePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteFeeRecords, setDeleteFeeRecords] = useState(false);

  // Reset to a clean state every time the modal (re)opens.
  useEffect(() => {
    let cancelled = false;

    if (visible) {
      setStep(1);
      setTyped('');
      setDeleting(false);
      setError(null);
      setPreview(null);
      setDeleteFeeRecords(false);

      if (!studentId) {
        setPreviewLoading(false);
      } else {
        setPreviewLoading(true);
        StudentService.getHardDeletePreview(studentId)
          .then((result) => {
            if (!cancelled) setPreview(result);
          })
          .catch((e) => {
            if (!cancelled) {
              setError(e instanceof APIError ? e.message : 'Could not check this student\'s fee records.');
            }
          })
          .finally(() => {
            if (!cancelled) setPreviewLoading(false);
          });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [visible, studentId]);

  const nameMatches = typed.trim().toLowerCase() === studentName.trim().toLowerCase();

  const handleConfirm = async () => {
    if (!studentId || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await StudentService.hardDelete(studentId, deleteFeeRecords);
      onDeleted();
    } catch (e) {
      if (e instanceof APIError && e.statusCode === 409) {
        setStep(1);
        setDeleteFeeRecords(false);
        setPreviewLoading(true);
        try {
          setPreview(await StudentService.getHardDeletePreview(studentId));
          setError('Fee records changed after the first check. Review them and enable the toggle to continue.');
        } catch {
          setPreview(null);
          setError('Fee records changed, but the latest details could not be loaded. Close this dialog and try again.');
        } finally {
          setPreviewLoading(false);
        }
      } else {
        setError(e instanceof APIError ? e.message : 'Failed to delete student. Please try again.');
      }
      setDeleting(false);
    }
  };

  const s = getStyles(isDark);
  const danger = '#DC2626';
  const requiresFeeConfirmation = preview?.has_fee_records === true;
  const canContinueFromFirstStep = !previewLoading
    && preview !== null
    && (!requiresFeeConfirmation || deleteFeeRecords);
  const formatINR = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={deleting ? undefined : onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.card, { backgroundColor: theme.colors.surface }]}>
          {/* Danger banner */}
          <View style={s.iconWrap}>
            <View style={[s.iconCircle, { backgroundColor: isDark ? 'rgba(220,38,38,0.16)' : '#FEE2E2' }]}>
              <Ionicons name="warning" size={30} color={danger} />
            </View>
          </View>

          <Text style={[s.stepBadge, { color: theme.colors.textMuted }]}>STEP {step} OF 3</Text>

          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 4 }}>
            {step === 1 && (
              <>
                <Text style={[s.title, { color: theme.colors.textStrong }]}>Permanently delete this student?</Text>
                <Text style={[s.subject, { color: theme.colors.textStrong }]}>{studentName}</Text>
                {!!studentSubtitle && <Text style={[s.subtitle, { color: theme.colors.textSecondary }]}>{studentSubtitle}</Text>}

                <View style={[s.warnBox, { backgroundColor: isDark ? 'rgba(220,38,38,0.10)' : '#FEF2F2', borderColor: isDark ? 'rgba(220,38,38,0.3)' : '#FECACA' }]}>
                  <Text style={[s.warnHeading, { color: danger }]}>This cannot be undone. It will erase:</Text>
                  {WIPED_ITEMS.map((item) => (
                    <View key={item} style={s.bulletRow}>
                      <Ionicons name="close-circle" size={15} color={danger} style={{ marginTop: 1 }} />
                      <Text style={[s.bulletText, { color: theme.colors.textSecondary }]}>{item}</Text>
                    </View>
                  ))}
                </View>

                {previewLoading && (
                  <View style={[s.feeCheckBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={[s.feeCheckLoading, { color: theme.colors.textSecondary }]}>Checking fee records…</Text>
                  </View>
                )}

                {!previewLoading && preview && !preview.has_fee_records && (
                  <View style={[s.feeCheckBox, { borderColor: isDark ? 'rgba(22,163,74,0.35)' : '#BBF7D0', backgroundColor: isDark ? 'rgba(22,163,74,0.10)' : '#F0FDF4' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.feeCheckHeading, { color: '#16A34A' }]}>No fee or payment records found</Text>
                      <Text style={[s.feeCheckCopy, { color: theme.colors.textSecondary }]}>No financial records need separate confirmation.</Text>
                    </View>
                  </View>
                )}

                {!previewLoading && preview?.has_fee_records && (
                  <View style={[s.feePanel, { borderColor: isDark ? 'rgba(234,88,12,0.45)' : '#FDBA74', backgroundColor: isDark ? 'rgba(234,88,12,0.10)' : '#FFF7ED' }]}>
                    <View style={s.feePanelHeader}>
                      <Ionicons name="cash-outline" size={21} color="#EA580C" />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.feeCheckHeading, { color: '#C2410C' }]}>Fee records found</Text>
                        <Text style={[s.feeCheckCopy, { color: theme.colors.textSecondary }]}>These financial records will also be permanently erased.</Text>
                      </View>
                    </View>

                    <View style={s.feeStatsGrid}>
                      <View style={s.feeStat}>
                        <Text style={[s.feeStatValue, { color: theme.colors.textStrong }]}>{preview.fee_record_count}</Text>
                        <Text style={[s.feeStatLabel, { color: theme.colors.textMuted }]}>{preview.active_fee_record_count} active fees</Text>
                      </View>
                      <View style={s.feeStat}>
                        <Text style={[s.feeStatValue, { color: theme.colors.textStrong }]}>{preview.payment_transaction_count}</Text>
                        <Text style={[s.feeStatLabel, { color: theme.colors.textMuted }]}>Transactions</Text>
                      </View>
                      <View style={s.feeStat}>
                        <Text style={[s.feeStatValue, { color: theme.colors.textStrong }]}>{preview.receipt_count}</Text>
                        <Text style={[s.feeStatLabel, { color: theme.colors.textMuted }]}>Receipts</Text>
                      </View>
                    </View>

                    <View style={[s.amountRow, { borderTopColor: isDark ? 'rgba(234,88,12,0.25)' : '#FED7AA' }]}>
                      <Text style={[s.amountText, { color: theme.colors.textSecondary }]}>Assigned fee total: {formatINR(preview.total_due - preview.total_discount)}</Text>
                      <Text style={[s.amountText, { color: theme.colors.textSecondary }]}>Assigned fee paid: {formatINR(preview.total_paid)}</Text>
                      <Text style={[s.amountBalance, { color: danger }]}>Assigned fee balance: {formatINR(preview.balance)}</Text>
                      {preview.related_financial_record_count > 0 && (
                        <Text style={[s.amountText, { color: theme.colors.textSecondary }]}>Other financial records: {preview.related_financial_record_count}</Text>
                      )}
                    </View>

                    <View style={[s.feeToggleRow, { borderTopColor: isDark ? 'rgba(234,88,12,0.25)' : '#FED7AA' }]}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={[s.feeToggleTitle, { color: theme.colors.textStrong }]}>Delete fee and payment records</Text>
                        <Text style={[s.feeToggleCopy, { color: theme.colors.textSecondary }]}>Off by default. Turn this on to allow permanent deletion.</Text>
                      </View>
                      <Switch
                        value={deleteFeeRecords}
                        onValueChange={setDeleteFeeRecords}
                        trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
                        thumbColor={deleteFeeRecords ? danger : '#F9FAFB'}
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <Text style={[s.title, { color: theme.colors.textStrong }]}>Confirm the student’s name</Text>
                <Text style={[s.helper, { color: theme.colors.textSecondary }]}>
                  To make sure this is intentional, type the full name exactly as shown:
                </Text>
                <Text style={[s.nameToType, { color: danger }]}>{studentName}</Text>
                <TextInput
                  value={typed}
                  onChangeText={setTyped}
                  placeholder="Type the name here"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    s.input,
                    {
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.background,
                      borderColor: typed.length === 0 ? theme.colors.border : nameMatches ? '#16A34A' : danger,
                    },
                  ]}
                />
                {typed.length > 0 && !nameMatches && (
                  <Text style={[s.mismatch, { color: danger }]}>The name doesn’t match yet.</Text>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <Text style={[s.title, { color: theme.colors.textStrong }]}>Last chance</Text>
                <Text style={[s.helper, { color: theme.colors.textSecondary }]}>
                  You’re about to permanently delete{' '}
                  <Text style={{ fontWeight: '800', color: theme.colors.textStrong }}>{studentName}</Text>{' '}
                  and every record belonging to them. This is irreversible.
                </Text>
              </>
            )}

            {!!error && <Text style={[s.error, { color: danger }]}>{error}</Text>}
          </ScrollView>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              onPress={onClose}
              disabled={deleting}
              style={[s.btn, s.btnGhost, { borderColor: theme.colors.border, opacity: deleting ? 0.5 : 1 }]}
            >
              <Text style={[s.btnGhostText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            {step === 1 && (
              <TouchableOpacity
                onPress={() => setStep(2)}
                disabled={!canContinueFromFirstStep}
                style={[s.btn, { backgroundColor: danger, opacity: canContinueFromFirstStep ? 1 : 0.4 }]}>
                <Text style={s.btnText}>I understand, continue</Text>
              </TouchableOpacity>
            )}
            {step === 2 && (
              <TouchableOpacity
                onPress={() => setStep(3)}
                disabled={!nameMatches}
                style={[s.btn, { backgroundColor: danger, opacity: nameMatches ? 1 : 0.4 }]}
              >
                <Text style={s.btnText}>Continue</Text>
              </TouchableOpacity>
            )}
            {step === 3 && (
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={deleting}
                style={[s.btn, { backgroundColor: danger, opacity: deleting ? 0.7 : 1 }]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.btnText}>Delete permanently</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 440,
      borderRadius: 20,
      padding: 22,
      ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 }),
    },
    iconWrap: { alignItems: 'center', marginBottom: 10 },
    iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
    stepBadge: { textAlign: 'center', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
    title: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
    subject: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 8 },
    subtitle: { fontSize: 13, textAlign: 'center', marginTop: 2 },
    helper: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
    warnBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 16 },
    warnHeading: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
    bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 5 },
    bulletText: { fontSize: 13, flex: 1, lineHeight: 18 },
    nameToType: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 12, marginBottom: 12 },
    input: { borderWidth: 1.5, borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 16 },
    mismatch: { fontSize: 12, marginTop: 6, textAlign: 'center' },
    feeCheckBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
    feeCheckLoading: { fontSize: 13, fontWeight: '600' },
    feeCheckHeading: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
    feeCheckCopy: { fontSize: 12, lineHeight: 17 },
    feePanel: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12 },
    feePanelHeader: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
    feeStatsGrid: { flexDirection: 'row', gap: 8, marginTop: 13 },
    feeStat: { flex: 1 },
    feeStatValue: { fontSize: 16, fontWeight: '800' },
    feeStatLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },
    amountRow: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 3 },
    amountText: { fontSize: 12, fontWeight: '600' },
    amountBalance: { fontSize: 12, fontWeight: '800' },
    feeToggleRow: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, flexDirection: 'row', alignItems: 'center' },
    feeToggleTitle: { fontSize: 13, fontWeight: '800' },
    feeToggleCopy: { fontSize: 11, lineHeight: 16, marginTop: 2 },
    error: { fontSize: 13, marginTop: 12, textAlign: 'center', fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    btn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    btnGhost: { borderWidth: 1, backgroundColor: 'transparent' },
    btnGhostText: { fontSize: 14, fontWeight: '700' },
    btnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  });
