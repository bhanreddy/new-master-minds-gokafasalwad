import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppTextInput from '../components/AppTextInput';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Share} from 'react-native';
import KeyboardAwareScreen from '@/components/keyboard/KeyboardAwareScreen';
import { alertCompat } from '../utils/crossPlatformAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AdminHeader from '../components/AdminHeader';
import { UpiSettingsService } from '../services/upiSettingsService';
import { APIError } from '../services/apiClient';
import { buildUpiPayUri, parseInrAmount } from '../utils/upiDeepLink';

const BG = '#0A0A0F';
const ACCENT = '#F59E0B';
const MUTED = 'rgba(255,255,255,0.55)';

/**
 * Accounts / admin: dynamic UPI QR from server-stored VPA + amount + optional note.
 */
export default function CollectFeeQRScreen() {
  const qrRef = useRef<any>(null);
  const mounted = useRef(true);

  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    console.debug('[CollectFeeQRScreen] load start');
    if (mounted.current) {
      setBootLoading(true);
      setBootError(null);
    }
    try {
      const data = await UpiSettingsService.get();
      if (mounted.current) {
        setUpiId((data.upi_id ?? '').trim());
        setPayeeName((data.display_name ?? '').trim());
      }
      console.debug('[CollectFeeQRScreen] load end');
    } catch (e) {
      if (mounted.current) {
        setBootError(e instanceof APIError ? e.message : 'Could not load UPI settings.');
      }
      console.error('Button action failed:', e);
    } finally {
      if (mounted.current) {
        setBootLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const amountOk = useMemo(() => parseInrAmount(amount), [amount]);
  const payUri = useMemo(() => {
    if (!upiId || !payeeName || !amountOk) return '';
    return buildUpiPayUri(upiId, payeeName, amountOk, note);
  }, [upiId, payeeName, amountOk, note]);

  const shareQr = async () => {
    console.debug('[CollectFeeQRScreen] shareQr start');
    if (!payUri) {
      alertCompat('Amount required', 'Enter a valid amount to share.');
      return;
    }
    if (mounted.current) {
      setSharing(true);
    }
    try {
      const svg = qrRef.current;
      if (svg && typeof svg.toDataURL === 'function' && Platform.OS !== 'web') {
        await new Promise<void>((resolve, reject) => {
          try {
            svg.toDataURL(async (data: string) => {
              try {
                const base64 = data.replace(/^data:image\/\w+;base64,/, '');
                const out = new File(Paths.cache, `schoolims-upi-qr-${Date.now()}.png`);
                out.write(base64, { encoding: 'base64' });
                const fileUri = out.uri;
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                  await Sharing.shareAsync(fileUri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Share fee QR',
                  });
                } else {
                  await Share.share({ message: payUri, title: 'Pay via UPI' });
                }
                resolve();
              } catch (inner) {
                reject(inner);
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      } else {
        await Share.share({ message: payUri, title: 'Pay via UPI' });
      }
      console.debug('[CollectFeeQRScreen] shareQr end');
    } catch (e) {
      console.error('Button action failed:', e);
      try {
        await Share.share({ message: payUri, title: 'Pay via UPI' });
      } catch {
        alertCompat('Share failed', 'Could not open the share sheet.');
      }
    } finally {
      if (mounted.current) {
        setSharing(false);
      }
    }
  };

  return (
    <View style={styles.root}>
      <AdminHeader title="Collect fee via UPI" showBackButton />
      <KeyboardAwareScreen
        variant="scroll"
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bottomOffset={24}
      >
          {bootLoading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={ACCENT} size="large" />
              <Text style={styles.muted}>Loading school UPI…</Text>
            </View>
          ) : bootError ? (
            <Pressable
              onPress={() => {
                void load();
              }}
              style={[styles.errorCard, Platform.OS === 'web' && { cursor: 'pointer' }]}
            >
              <Ionicons name="cloud-offline-outline" size={22} color="#FCA5A5" />
              <Text style={styles.errorText}>{bootError}</Text>
              <Text style={styles.retry}>Tap to retry</Text>
            </Pressable>
          ) : !upiId || !payeeName ? (
            <LinearGradient colors={['rgba(127, 29, 29, 0.35)', 'rgba(10, 10, 15, 0.95)']} style={styles.warnCard}>
              <Ionicons name="alert-circle-outline" size={24} color={ACCENT} />
              <Text style={styles.warnTitle}>UPI not configured</Text>
              <Text style={styles.muted}>
                Ask an admin to set the school UPI ID and display name under Admin → UPI fee settings.
              </Text>
            </LinearGradient>
          ) : null}

          {!bootLoading && !bootError && upiId && payeeName ? (
            <>
              <LinearGradient
                colors={['rgba(245, 158, 11, 0.12)', 'rgba(17, 16, 22, 0.96)']}
                style={styles.formCard}
              >
                <Text style={styles.label}>Amount (INR) — required</Text>
                <AppTextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="e.g. 2500 or 2500.50"
                  placeholderTextColor={MUTED}
                  keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  style={styles.input}
                />
                {amount.length > 0 && !amountOk ? (
                  <Text style={styles.fieldErr}>Enter a positive amount (up to 2 decimal places).</Text>
                ) : null}

                <Text style={[styles.label, { marginTop: 20 }]}>Transaction note (optional)</Text>
                <AppTextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder='e.g. April fee — Grade 5'
                  placeholderTextColor={MUTED}
                  style={[styles.input, styles.inputMulti]}
                  multiline
                  maxLength={80}
                />
              </LinearGradient>

              {payUri ? (
                <LinearGradient
                  colors={['#1A1814', '#121015']}
                  style={styles.qrCard}
                >
                  <View style={styles.qrFrame}>
                    <QRCode
                      value={payUri}
                      size={220}
                      color="#0A0A0F"
                      backgroundColor="#FFFFFF"
                      getRef={(c) => {
                        qrRef.current = c;
                      }}
                    />
                  </View>
                  <View style={styles.confirmBlock}>
                    <Row icon="at-outline" label="UPI ID" value={upiId} />
                    <Row icon="cash-outline" label="Amount" value={`₹${amountOk}`} />
                    {note.trim() ? <Row icon="document-text-outline" label="Note" value={note.trim()} /> : null}
                  </View>

                  <Pressable
                    onPress={() => {
                      void shareQr();
                    }}
                    disabled={sharing}
                    style={({ pressed }) => [
                      styles.shareBtn,
                      pressed && !sharing && { opacity: 0.92 },
                      Platform.OS === 'web' && { cursor: sharing ? 'not-allowed' : 'pointer' } as any,
                    ]}
                  >
                    <LinearGradient
                      colors={['#B45309', ACCENT]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.shareGrad}
                    >
                      {sharing ? (
                        <ActivityIndicator color="#0A0A0F" />
                      ) : (
                        <>
                          <Ionicons name="share-outline" size={20} color="#0A0A0F" />
                          <Text style={styles.shareText}>Share QR</Text>
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                </LinearGradient>
              ) : (
                <View style={styles.placeholderQr}>
                  <Ionicons name="qr-code-outline" size={40} color={MUTED} />
                  <Text style={styles.muted}>Enter an amount to generate the QR.</Text>
                </View>
              )}
            </>
          ) : null}
      </KeyboardAwareScreen>
    </View>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Ionicons name={icon} size={16} color={ACCENT} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.lab}>{label}</Text>
        <Text style={rowStyles.val}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  lab: { fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase' },
  val: { marginTop: 4, fontSize: 15, color: '#F9FAFB', fontWeight: '600' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40, paddingHorizontal: 16, paddingTop: 16 },
  centerBlock: { paddingVertical: 56, alignItems: 'center' },
  muted: { marginTop: 12, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
  errorCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    alignItems: 'center',
  },
  errorText: { marginTop: 10, color: '#FECACA', textAlign: 'center', fontSize: 14 },
  retry: { marginTop: 8, color: ACCENT, fontWeight: '700', fontSize: 13 },
  warnCard: {
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    gap: 10,
  },
  warnTitle: { fontSize: 18, fontWeight: '700', color: '#FFFBEB' },
  formCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.18)',
  },
  label: { fontSize: 12, fontWeight: '700', color: ACCENT, letterSpacing: 1.1, textTransform: 'uppercase' },
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
  inputMulti: { minHeight: 72, paddingTop: 14, textAlignVertical: 'top' },
  fieldErr: { marginTop: 8, fontSize: 12, color: '#FCA5A5' },
  qrCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  qrFrame: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  confirmBlock: { alignSelf: 'stretch', marginTop: 24 },
  shareBtn: { marginTop: 22, alignSelf: 'stretch', borderRadius: 16, overflow: 'hidden' },
  shareGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  shareText: { fontSize: 16, fontWeight: '800', color: '#0A0A0F' },
  placeholderQr: {
    marginTop: 8,
    paddingVertical: 48,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
});
