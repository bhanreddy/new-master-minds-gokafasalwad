import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { alertCompat } from '../utils/crossPlatformAlert';
import {
  AdmissionFormData,
  printAdmissionForm,
  saveAdmissionFormPdf,
} from '../utils/admissionFormPdf';

interface Props {
  visible: boolean;
  data: AdmissionFormData | null;
  /** Called when the user dismisses (Close / backdrop). Typically navigates back. */
  onClose: () => void;
}

type Busy = 'print' | 'save' | null;

/**
 * Post-enrollment success sheet. Confirms the student was created and offers to
 * print the admission form, save it as a PDF, or close. Reused by the admin and
 * accounts add-student screens.
 */
export default function AdmissionSuccessModal({ visible, data, onClose }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [busy, setBusy] = useState<Busy>(null);

  const run = async (kind: Exclude<Busy, null>) => {
    if (!data || busy) return;
    setBusy(kind);
    try {
      if (kind === 'print') {
        await printAdmissionForm(data);
      } else {
        await saveAdmissionFormPdf(data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate the admission form.';
      alertCompat('Admission Form', msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: c.success + '1A' }]}>
            <Ionicons name="checkmark-circle" size={52} color={c.success} />
          </View>

          <Text style={[styles.title, { color: c.textStrong }]}>Student Enrolled</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={2}>
            {data?.fullName ? `${data.fullName} has been added successfully.` : 'New student has been added successfully.'}
          </Text>
          <Text style={[styles.hint, { color: c.textMuted }]}>
            Print the admission form with school details, or save it as a PDF.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: c.primary }, pressed && styles.pressed]}
            onPress={() => run('print')}
            disabled={!!busy}
          >
            {busy === 'print' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="print-outline" size={19} color="#fff" />
                <Text style={styles.primaryBtnText}>Print Admission Form</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { borderColor: c.primary, backgroundColor: c.primary + '0F' },
              pressed && styles.pressed,
            ]}
            onPress={() => run('save')}
            disabled={!!busy}
          >
            {busy === 'save' ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={19} color={c.primary} />
                <Text style={[styles.secondaryBtnText, { color: c.primary }]}>Save as PDF</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            onPress={onClose}
            disabled={!!busy}
          >
            <Text style={[styles.closeBtnText, { color: c.textSecondary }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 21, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  hint: { fontSize: 12.5, textAlign: 'center', marginTop: 10, marginBottom: 22, lineHeight: 18 },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
    paddingVertical: 15,
    minHeight: 52,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    borderWidth: 1.5,
    marginTop: 12,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '800' },
  closeBtn: { width: '100%', alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  closeBtnText: { fontSize: 14.5, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
