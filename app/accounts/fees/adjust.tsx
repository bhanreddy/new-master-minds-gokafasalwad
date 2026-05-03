
import React, { useState, useMemo, useRef, useEffect } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Pressable, Platform
} from 'react-native';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAccountsWebChrome } from '../../../src/contexts/AccountsWebChromeContext';
import { FeeService } from '../../../src/services/feeService';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import { Ionicons } from '@expo/vector-icons';
import LogoLoader from '../../../src/components/LogoLoader';

// ─── Preset Reasons ───────────────────────────────────────────────────────────
const PRESET_REASONS = [
  'Financial hardship – verified by administration',
  'Scholarship / merit discount applied',
  'Duplicate fee entry correction',
  'Sibling concession policy',
  'Management discretion',
];

// ─── Char Counter ─────────────────────────────────────────────────────────────
function CharCounter({ current, min }: { current: number; min: number }) {
  const met = current >= min;
  return (
    <Text style={{
      fontSize: 11, fontWeight: '700',
      color: met ? '#10B981' : '#EF4444',
      textAlign: 'right', marginTop: -14, marginBottom: 14,
    }}>
      {current}/{min} min {met ? '✓' : ''}
    </Text>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdjustFeeScreen() {
  const { theme, isDark } = useTheme();
  const { shellActive } = useAccountsWebChrome();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const params = useLocalSearchParams();

  const feeId = params.feeId as string;
  const studentName = params.name as string;
  const feeType = params.feeType as string;

  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [reasonFocused, setReasonFocused] = useState(false);

  // Entry animations
  const warnAnim = useRef(new Animated.Value(0)).current;
  const infoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(warnAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.spring(infoAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.spring(formAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const amountNum = parseFloat(amount) || 0;
  const isReady = amountNum > 0 && reason.trim().length >= 5;

  const handleAdjust = async () => {
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      alertCompat('Invalid Amount', 'Please enter a valid waiver amount.');
      return;
    }
    if (!reason || reason.trim().length < 5) {
      alertCompat('Reason Required', 'Provide a justification (min 5 characters).');
      return;
    }

    alertCompat(
      '⚠ Revenue Impact Warning',
      `You are about to waive ₹${amountNum.toLocaleString('en-IN')} from ${studentName}'s ${feeType}.\n\nThis action is logged under your User ID and cannot be easily reversed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Authorize Waiver',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await FeeService.adjustFee({
                student_fee_id: feeId,
                amount: amountNum,
                reason: reason.trim(),
              });
              alertCompat(
                '✓ Waiver Applied',
                'Adjustment has been recorded and logged.',
                [{ text: 'Done', onPress: () => router.back() }]
              );
            } catch (error: any) {
              alertCompat('Waiver Failed', error.message || 'Failed to record adjustment.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {!shellActive && <AdminHeader title="Issue Waiver" showBackButton />}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Audit Warning ── */}
        <Animated.View style={[
          styles.warnCard,
          {
            opacity: warnAnim,
            transform: [{ translateY: warnAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]
          }
        ]}>
          <View style={styles.warnIconWrap}>
            <Ionicons name="shield-checkmark" size={20} color="#F59E0B" />
          </View>
          <View style={styles.warnTextBlock}>
            <Text style={styles.warnTitle}>AUDIT NOTICE</Text>
            <Text style={styles.warnBody}>
              Every adjustment is logged with your User ID. Unauthorized waivers are subject to financial audit.
            </Text>
          </View>
        </Animated.View>

        {/* ── Student Info ── */}
        <Animated.View style={[
          styles.infoCard,
          {
            opacity: infoAnim,
            transform: [{ translateY: infoAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]
          }
        ]}>
          <View style={styles.infoAccent} />
          <View style={styles.infoBody}>
            <View style={styles.infoAvatar}>
              <Text style={styles.infoAvatarText}>
                {(studentName || 'S').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoName} numberOfLines={1}>{studentName || 'Unknown'}</Text>
              <View style={[styles.feeTypePill]}>
                <Ionicons name="receipt-outline" size={11} color="#6366F1" />
                <Text style={styles.feeTypePillText}>{feeType || '—'}</Text>
              </View>
            </View>
            <View style={styles.waiverBadge}>
              <Text style={styles.waiverBadgeText}>WAIVER</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Form ── */}
        <Animated.View style={[
          styles.form,
          {
            opacity: formAnim,
            transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]
          }
        ]}>
          <Text style={styles.sectionTitle}>Adjustment Details</Text>

          {/* Amount */}
          <Text style={styles.inputLabel}>WAIVER AMOUNT</Text>
          <View style={[
            styles.amountBox,
            amountFocused && styles.amountBoxFocused,
          ]}>
            <Text style={styles.rupee}>₹</Text>
            <AppTextInput
              style={[ds.inputInChrome, styles.amountInput]}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.15)' : '#94A3B8'}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
            />
            {amountNum > 0 && (
              <View style={styles.amountTag}>
                <Text style={styles.amountTagText}>
                  -{amountNum.toLocaleString('en-IN')}
                </Text>
              </View>
            )}
          </View>

          {/* Justification */}
          <Text style={[styles.inputLabel, { marginTop: 4 }]}>JUSTIFICATION</Text>
          <AppTextInput
            style={[
              styles.textArea,
              reasonFocused && styles.textAreaFocused,
            ]}
            multiline
            numberOfLines={4}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter official reason for this adjustment…"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.15)' : '#94A3B8'}
            onFocus={() => setReasonFocused(true)}
            onBlur={() => setReasonFocused(false)}
          />
          <CharCounter current={reason.trim().length} min={5} />

          {/* Preset quick-fill reasons */}
          <Text style={styles.presetsLabel}>Quick-fill reasons</Text>
          <View style={styles.presetsWrap}>
            {PRESET_REASONS.map((r) => (
              <Pressable
                key={r}
                style={[
                  styles.presetChip,
                  reason === r && styles.presetChipActive,
                ]}
                onPress={() => setReason(r)}
              >
                <Text style={[
                  styles.presetChipText,
                  reason === r && styles.presetChipTextActive,
                ]} numberOfLines={1}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ── Summary + CTA ── */}
        <Animated.View style={{
          opacity: formAnim,
          transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }}>
          {isReady && (
            <View style={styles.summaryCard}>
              <SummaryRow label="Student" value={studentName || '—'} isDark={isDark} />
              <SummaryRow label="Fee Component" value={feeType || '—'} isDark={isDark} />
              <SummaryRow label="Waiver Amount" value={`₹${amountNum.toLocaleString('en-IN')}`} isDark={isDark} highlight />
              <SummaryRow label="Reason" value={reason.length > 40 ? reason.slice(0, 40) + '…' : reason} isDark={isDark} />
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, (!isReady || loading) && styles.btnDisabled]}
            onPress={handleAdjust}
            disabled={!isReady || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <LogoLoader color="#fff" />
            ) : (
              <View style={styles.btnInner}>
                <Ionicons
                  name="cut-outline"
                  size={18}
                  color={!isReady ? (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF') : '#fff'}
                />
                <Text style={[styles.btnText, !isReady && styles.btnTextDisabled]}>
                  {isReady
                    ? `Authorize Waiver · ₹${amountNum.toLocaleString('en-IN')}`
                    : 'Enter Amount & Reason'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Summary Row ──────────────────────────────────────────────────────────────
function SummaryRow({
  label, value, isDark, highlight,
}: {
  label: string; value: string; isDark: boolean; highlight?: boolean;
}) {
  return (
    <View style={srStyles.row}>
      <Text style={[srStyles.label, { color: isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF' }]}>
        {label}
      </Text>
      <Text style={[
        srStyles.value,
        { color: highlight ? '#6366F1' : (isDark ? '#F9FAFB' : '#111827') },
        highlight && { fontSize: 16, fontWeight: '800' },
      ]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
const srStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  label: { fontSize: 12, fontWeight: '600' },
  value: { fontSize: 13, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 16,
    gap: 14,
  },

  // ── Warning ──
  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#FDE68A',
  },
  warnIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7',
    alignItems: 'center', justifyContent: 'center',
  },
  warnTextBlock: { flex: 1 },
  warnTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    color: '#D97706', marginBottom: 3,
  },
  warnBody: {
    fontSize: 12, fontWeight: '500', lineHeight: 17,
    color: isDark ? '#FCD34D' : '#92400E',
  },

  // ── Info Card ──
  infoCard: {
    backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: isDark ? 0.25 : 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  infoAccent: { height: 4, backgroundColor: '#6366F1' },
  infoBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  infoAvatar: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
  infoAvatarText: { fontSize: 20, fontWeight: '800', color: '#6366F1' },
  infoText: { flex: 1 },
  infoName: {
    fontSize: 16, fontWeight: '700',
    color: isDark ? '#F9FAFB' : '#111827',
    marginBottom: 5,
  },
  feeTypePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  feeTypePillText: { fontSize: 11, fontWeight: '700', color: '#6366F1' },
  waiverBadge: {
    backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(99,102,241,0.3)' : '#C7D2FE',
  },
  waiverBadgeText: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#6366F1',
  },

  // ── Form ──
  form: {
    backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', letterSpacing: 0.2,
    color: isDark ? '#F9FAFB' : '#111827',
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.9,
    color: isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF',
    marginBottom: 8, textTransform: 'uppercase',
  },

  // Amount box
  amountBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
    borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
    borderRadius: 14, paddingHorizontal: 14, marginBottom: 20,
  },
  amountBoxFocused: {
    borderColor: '#6366F1',
    backgroundColor: isDark ? 'rgba(99,102,241,0.07)' : '#F5F3FF',
  },
  rupee: {
    fontSize: 22, fontWeight: '700',
    color: isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF',
    marginRight: 6,
  },
  amountInput: {
    flex: 1, fontSize: 32, fontWeight: '800',
    color: isDark ? '#F9FAFB' : '#111827',
    paddingVertical: 14,
  },
  amountTag: {
    backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7,
  },
  amountTagText: { fontSize: 12, fontWeight: '800', color: '#6366F1' },

  // Textarea
  textArea: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1',
    borderRadius: 14, padding: 14,
    fontSize: 14, color: isDark ? '#F9FAFB' : '#111827',
    height: 100, textAlignVertical: 'top', marginBottom: 6,
    lineHeight: 20,
  },
  textAreaFocused: {
    borderColor: '#6366F1',
    backgroundColor: isDark ? 'rgba(99,102,241,0.07)' : '#F5F3FF',
  },

  // Presets
  presetsLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    color: isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF',
    marginBottom: 8, textTransform: 'uppercase',
  },
  presetsWrap: { gap: 6 },
  presetChip: {
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
  },
  presetChipActive: {
    backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
    borderColor: '#6366F1',
  },
  presetChipText: {
    fontSize: 13, fontWeight: '500',
    color: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280',
  },
  presetChipTextActive: { color: '#6366F1', fontWeight: '700' },

  // Summary
  summaryCard: {
    backgroundColor: isDark ? '#1C1F2A' : '#FFFFFF',
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(99,102,241,0.2)' : '#C7D2FE',
  },

  // CTA
  btn: {
    backgroundColor: '#6366F1',
    paddingVertical: 17, borderRadius: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  btnDisabled: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#E5E7EB',
    shadowOpacity: 0, elevation: 0,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  btnTextDisabled: { color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF' },
});