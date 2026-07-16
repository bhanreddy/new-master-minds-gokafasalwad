import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppTextInput from '../components/AppTextInput';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform} from 'react-native';
import KeyboardAwareScreen from '@/components/keyboard/KeyboardAwareScreen';
import { alertCompat } from '../utils/crossPlatformAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../components/AdminHeader';
import { UpiSettingsService } from '../services/upiSettingsService';
import { APIError } from '../services/apiClient';

const BG = '#0A0A0F';
const ACCENT = '#F59E0B';
const CARD_BORDER = 'rgba(245, 158, 11, 0.22)';
const MUTED = 'rgba(255,255,255,0.55)';

function validUpiShape(s: string): boolean {
  const t = s.trim();
  if (!t.includes('@')) return false;
  const at = t.lastIndexOf('@');
  return at > 0 && at < t.length - 1 && !/\s/.test(t);
}

/**
 * Admin-only: configure school UPI VPA + payee display name for fee QR.
 * We show the **full** UPI ID here so staff can verify the saved VPA; masking would hinder reconciliation.
 */
export default function UPISettingsScreen() {
  const mounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    console.debug('[UPISettingsScreen] load start');
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await UpiSettingsService.get();
      if (mounted.current) {
        setUpiId(data.upi_id ?? '');
        setDisplayName(data.display_name ?? '');
      }
      console.debug('[UPISettingsScreen] load end');
    } catch (e) {
      const msg = e instanceof APIError ? e.message : 'Could not load UPI settings.';
      if (mounted.current) {
        setError(msg);
      }
      console.error('Button action failed:', e);
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canSave = useMemo(() => {
    return validUpiShape(upiId) && displayName.trim().length > 0 && displayName.trim().length <= 80;
  }, [upiId, displayName]);

  const onSave = async () => {
    console.debug('[UPISettingsScreen] onSave start');
    if (!canSave) {
      const hint = 'Enter a valid UPI ID (must contain @) and a display name.';
      setSaveError(hint);
      alertCompat('Check fields', hint);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setError(null);
    try {
      await UpiSettingsService.put({
        upi_id: upiId.trim(),
        display_name: displayName.trim(),
      });
      if (mounted.current) {
        setSaveError(null);
        setSaveOk(true);
      }
      alertCompat('Saved', 'UPI details updated for this school.');
      await load();
      console.debug('[UPISettingsScreen] onSave end');
    } catch (e) {
      const msg = e instanceof APIError ? e.message : 'Save failed.';
      if (mounted.current) {
        setSaveError(msg);
        setError(msg);
      }
      console.error('Button action failed:', e);
      alertCompat('Error', msg);
    } finally {
      if (mounted.current) {
        setSaving(false);
      }
    }
  };

  return (
    <View style={styles.root}>
      <AdminHeader title="UPI fee settings" showBackButton />
      <KeyboardAwareScreen
        variant="scroll"
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bottomOffset={24}
      >
          <LinearGradient
            colors={['rgba(245, 158, 11, 0.14)', 'rgba(10, 10, 15, 0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIconWrap}>
              <Ionicons name="qr-code-outline" size={28} color={ACCENT} />
            </View>
            <Text style={styles.heroTitle}>School UPI ID</Text>
            <Text style={styles.heroSub}>
              Used for “Collect fee via UPI” QR. Stored per school on the server — never from this device alone.
            </Text>
          </LinearGradient>

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={ACCENT} size="large" />
              <Text style={styles.loadingText}>Loading settings…</Text>
            </View>
          ) : (
            <LinearGradient
              colors={['rgba(30, 27, 22, 0.95)', 'rgba(15, 14, 18, 0.98)']}
              style={styles.card}
            >
              {error ? (
                <Pressable
                  onPress={() => {
                    void load();
                  }}
                  style={[styles.errorBanner, Platform.OS === 'web' && { cursor: 'pointer' }]}
                >
                  <Ionicons name="warning-outline" size={18} color="#FCA5A5" />
                  <Text style={styles.errorText}>{error}</Text>
                  <Text style={styles.retry}>Tap to retry</Text>
                </Pressable>
              ) : null}

              <Text style={styles.label}>UPI ID (VPA)</Text>
              <AppTextInput
                value={upiId}
                onChangeText={(t) => {
                  setSaveError(null);
                  setSaveOk(false);
                  setUpiId(t);
                }}
                placeholder="e.g. yourschool@okaxis"
                placeholderTextColor={MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={styles.hint}>Must include @ (basic VPA check).</Text>

              <Text style={[styles.label, { marginTop: 20 }]}>Account holder display name</Text>
              <AppTextInput
                value={displayName}
                onChangeText={(t) => {
                  setSaveError(null);
                  setSaveOk(false);
                  setDisplayName(t);
                }}
                placeholder="Shown as payee name in UPI apps"
                placeholderTextColor={MUTED}
                style={styles.input}
                maxLength={80}
              />

              <Pressable
                onPress={onSave}
                disabled={!canSave || saving}
                style={({ pressed }) => [
                  styles.saveOuter,
                  (!canSave || saving) && styles.saveDisabled,
                  pressed && canSave && !saving && { opacity: 0.9 },
                  Platform.OS === 'web' && { cursor: !canSave || saving ? 'not-allowed' : 'pointer' } as any,
                ]}
              >
                <LinearGradient
                  colors={canSave && !saving ? ['#D97706', ACCENT] : ['#4B5563', '#374151']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveGrad}
                >
                  {saving ? (
                    <ActivityIndicator color="#0A0A0F" />
                  ) : (
                    <Text style={styles.saveText}>Save UPI settings</Text>
                  )}
                </LinearGradient>
              </Pressable>
              {saveError ? (
                <View style={styles.saveErrorBox}>
                  <Text style={styles.saveErrorText}>{saveError}</Text>
                </View>
              ) : null}
              {saveOk ? (
                <View style={styles.saveOkBox}>
                  <Text style={styles.saveOkText}>Saved. UPI details are stored for this school.</Text>
                </View>
              ) : null}
            </LinearGradient>
          )}

          <Text style={styles.footerNote}>
            Admins and principals can change these values. Accounts staff can use them to generate payment QRs.
          </Text>
      </KeyboardAwareScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40, paddingHorizontal: 16 },
  hero: {
    borderRadius: 20,
    padding: 24,
    marginTop: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#FAFAF9', letterSpacing: -0.3 },
  heroSub: { marginTop: 8, fontSize: 14, lineHeight: 21, color: MUTED },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  label: { fontSize: 12, fontWeight: '700', color: ACCENT, letterSpacing: 1.2, textTransform: 'uppercase' },
  input: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: '#F9FAFB',
  },
  hint: { marginTop: 8, fontSize: 12, color: MUTED },
  saveOuter: { marginTop: 28, borderRadius: 16, overflow: 'hidden' },
  saveDisabled: { opacity: 0.65 },
  saveGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#0A0A0F' },
  centerBlock: { paddingVertical: 48, alignItems: 'center' },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },
  errorBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    marginBottom: 16,
  },
  errorText: { flex: 1, color: '#FECACA', fontSize: 13 },
  retry: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  saveErrorBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  saveErrorText: { color: '#FECACA', fontSize: 14, lineHeight: 20 },
  saveOkBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  saveOkText: { color: '#A7F3D0', fontSize: 14, lineHeight: 20 },
  footerNote: { marginTop: 24, fontSize: 12, color: MUTED, lineHeight: 18, paddingHorizontal: 4 },
});
