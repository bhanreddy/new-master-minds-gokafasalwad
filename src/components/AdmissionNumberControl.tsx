import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AdmissionNumberSuggestion, StudentService } from '../services/studentService';
import {
  AdmissionNumberType,
  admissionNumberTypeLabel,
  detectAdmissionNumberType,
} from '../utils/admissionNumber';
import { useTheme } from '../hooks/useTheme';
import { FORM, InputField, clayCard } from './studentAdmissionChrome';
import LogoLoader from './LogoLoader';
import MagicSparkleCelebration, { MagicOrigin } from './MagicSparkleCelebration';

type GeneratedAdmissionType = 'dummy' | 'permanent';

type AdmissionNumberControlProps = {
  value: string;
  onChange: (value: string) => void;
  isEditMode: boolean;
  error?: string;
  accentColor: string;
};

const TYPE_OPTIONS: {
  id: GeneratedAdmissionType;
  label: string;
  example: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'dummy', label: 'Temporary / Dummy', example: 'Example: Dummy123', icon: 'time-outline' },
  { id: 'permanent', label: 'Permanent / Numeric', example: 'Example: 123', icon: 'shield-checkmark-outline' },
];

const TYPE_COLORS: Record<AdmissionNumberType, { fg: string; bg: string }> = {
  dummy: { fg: '#D97706', bg: '#FEF3C7' },
  permanent: { fg: '#059669', bg: '#D1FAE5' },
  custom: { fg: '#665990', bg: '#EDE9F6' },
  empty: { fg: '#64748B', bg: '#F1F5F9' },
};

export default function AdmissionNumberControl({
  value,
  onChange,
  isEditMode,
  error,
  accentColor,
}: AdmissionNumberControlProps) {
  const { isDark } = useTheme();
  const detectedType = detectAdmissionNumberType(value);
  const typeColors = TYPE_COLORS[detectedType];
  const [loadingType, setLoadingType] = useState<GeneratedAdmissionType | null>(null);
  const [suggestion, setSuggestion] = useState<AdmissionNumberSuggestion | null>(null);
  const [suggestionError, setSuggestionError] = useState('');
  const [conversionPreview, setConversionPreview] = useState<{ from: string; to: string } | null>(null);
  const [conversionPending, setConversionPending] = useState(false);
  const [celebration, setCelebration] = useState<{ id: number; origin: MagicOrigin } | null>(null);
  const reduceMotion = useReducedMotion();
  const motionEnabled = !reduceMotion;
  const successGlow = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const ring = useSharedValue(0);
  const iconPop = useSharedValue(0);
  const transfer = useSharedValue(0);
  const convertButtonRef = useRef<View>(null);
  const typeOptionRefs = useRef<Record<GeneratedAdmissionType, View | null>>({
    dummy: null,
    permanent: null,
  });
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const cardBorder = isDark ? 'rgba(124, 111, 255, 0.24)' : 'rgba(102, 89, 144, 0.16)';
  const cardBackground = isDark ? '#211D2E' : '#FAF8FD';

  const successStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(successGlow.value, [0, 1], [0.08, 0.32]),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.2, 0.55, 1], [0, 0.55, 0.35, 0]),
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-120, 280]) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.2, 1], [0.55, 0.35, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.7, 2.35]) }],
  }));

  const ringStyle2 = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0.4, 0.22, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.7, 3.1]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPop.value }],
  }));

  const transferSparkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(transfer.value, [0, 0.18, 0.78, 1], [0, 1, 0.85, 0]),
    transform: [
      { translateX: interpolate(transfer.value, [0, 1], [-13, 13]) },
      { scale: interpolate(transfer.value, [0, 0.5, 1], [0.55, 1.05, 0.7]) },
      { rotate: `${interpolate(transfer.value, [0, 1], [0, 140])}deg` },
    ],
  }));

  const transferArrowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(transfer.value, [0, 0.5, 1], [1, 1.08, 1]) }],
  }));

  const targetNumberStyle = useAnimatedStyle(() => ({
    opacity: interpolate(transfer.value, [0, 0.5, 1], [1, 0.72, 1]),
    transform: [{ scale: interpolate(transfer.value, [0, 0.5, 1], [1, 0.985, 1]) }],
  }));

  const playSuccessMagic = useCallback(() => {
    if (!motionEnabled) {
      successGlow.value = 0;
      shimmer.value = 1;
      ring.value = 1;
      iconPop.value = 1;
      return;
    }
    successGlow.value = 0;
    successGlow.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 420 }),
    );
    shimmer.value = 0;
    shimmer.value = withTiming(1, { duration: 640, easing: Easing.out(Easing.cubic) });
    ring.value = 0;
    ring.value = withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) });
    iconPop.value = 0.35;
    iconPop.value = withSequence(
      withSpring(1.12, { damping: 12, stiffness: 360 }),
      withSpring(1, { damping: 15, stiffness: 300 }),
    );
  }, [iconPop, motionEnabled, ring, shimmer, successGlow]);

  useEffect(() => {
    if (!conversionPending || !motionEnabled) {
      cancelAnimation(transfer);
      transfer.value = 0;
      return undefined;
    }

    transfer.value = 0;
    transfer.value = withRepeat(
      withTiming(1, { duration: 760, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
    return () => cancelAnimation(transfer);
  }, [conversionPending, motionEnabled, transfer]);

  const measureMagicOrigin = useCallback((node: View | null): Promise<MagicOrigin> => {
    const dims = Dimensions.get('window');
    const fallback = {
      x: (Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : dims.width) * 0.5,
      y: (Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerHeight : dims.height) * 0.4,
    };

    return new Promise((resolve) => {
      if (!node) {
        resolve(fallback);
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
          resolve(fallback);
          return;
        }
        resolve({ x: x + width / 2, y: y + height / 2 });
      });
    });
  }, []);

  const fetchSuggestion = useCallback(async (
    type: GeneratedAdmissionType,
    applyToInput: boolean,
    measuredOrigin?: Promise<MagicOrigin> | null,
  ) => {
    setLoadingType(type);
    setSuggestionError('');
    try {
      const next = await StudentService.getNextAdmissionNumber(type);
      setSuggestion(next);
      if (applyToInput) {
        setConversionPreview(null);
        onChangeRef.current(next.next_admission_no);
        if (motionEnabled) {
          setCelebration({
            id: Date.now(),
            origin: await (measuredOrigin ?? measureMagicOrigin(null)),
          });
        }
        Haptics.selectionAsync().catch(() => {});
      }
      return next;
    } catch (fetchError: any) {
      setSuggestionError(fetchError?.message || 'Could not generate the next admission number.');
      return null;
    } finally {
      setLoadingType(null);
    }
  }, [measureMagicOrigin, motionEnabled]);

  useEffect(() => {
    if (!isEditMode || detectedType !== 'dummy') return;
    fetchSuggestion('permanent', false);
  }, [detectedType, fetchSuggestion, isEditMode]);

  useEffect(() => {
    // Keep banner while value is still catching up from parent onChange,
    // or while it matches the staged permanent number.
    if (
      conversionPreview
      && value !== conversionPreview.to
      && value !== conversionPreview.from
    ) {
      setConversionPreview(null);
    }
  }, [conversionPreview, value]);

  useEffect(() => {
    if (!conversionPreview) return;
    playSuccessMagic();
  }, [conversionPreview, playSuccessMagic]);

  const stagePermanentConversion = async () => {
    if (conversionPending) return;
    setConversionPending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const measuredOrigin = motionEnabled ? measureMagicOrigin(convertButtonRef.current) : null;

    // Refresh at the moment of conversion. The preview loaded with the screen
    // can become stale if another student receives a permanent number first.
    try {
      const next = await fetchSuggestion('permanent', false);
      if (!next) return;

      const from = value;
      const to = next.next_admission_no;
      onChangeRef.current(to);
      setConversionPreview({ from, to });
      if (motionEnabled) {
        setCelebration({ id: Date.now(), origin: await measuredOrigin! });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      AccessibilityInfo.announceForAccessibility(
        `Admission number changed from ${from} to permanent number ${to}. Save the student to confirm.`,
      );
    } finally {
      setConversionPending(false);
    }
  };

  const activeGeneratedType = detectedType === 'dummy' || detectedType === 'permanent'
    ? detectedType
    : null;

  return (
    <View>
      <MagicSparkleCelebration
        trigger={celebration?.id ?? 0}
        origin={celebration?.origin ?? null}
      />

      {!isEditMode ? (
        <View style={styles.selectorGroup}>
          <View style={styles.selectorHeadingRow}>
            <View>
              <Text style={[styles.selectorLabel, { color: FORM.label(isDark) }]}>Admission Number Type *</Text>
              <Text style={[styles.selectorHint, { color: FORM.muted(isDark) }]}>Choose a type to fill the next available number</Text>
            </View>
            {loadingType ? <LogoLoader size={22} color={accentColor} /> : null}
          </View>
          <View style={styles.typeRow}>
            {TYPE_OPTIONS.map((option) => {
              const active = activeGeneratedType === option.id;
              const loading = loadingType === option.id;
              return (
                <Pressable
                  key={option.id}
                  ref={(node) => {
                    typeOptionRefs.current[option.id] = node;
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Generate ${option.label} admission number`}
                  disabled={!!loadingType}
                  onPress={() => fetchSuggestion(
                    option.id,
                    true,
                    motionEnabled ? measureMagicOrigin(typeOptionRefs.current[option.id]) : null,
                  )}
                  style={({ pressed }) => [
                    styles.typeOption,
                    clayCard(isDark),
                    {
                      backgroundColor: active
                        ? (option.id === 'dummy' ? (isDark ? '#3A2A16' : '#FFFBEB') : (isDark ? '#12352D' : '#ECFDF5'))
                        : cardBackground,
                      borderColor: active
                        ? (option.id === 'dummy' ? '#F59E0B' : '#10B981')
                        : cardBorder,
                    },
                    pressed && styles.pressed,
                    loadingType && !loading && styles.muted,
                  ]}
                >
                  <View style={styles.typeOptionTop}>
                    <View style={[
                      styles.typeIcon,
                      { backgroundColor: option.id === 'dummy' ? '#F59E0B20' : '#10B98120' },
                    ]}>
                      <Ionicons
                        name={option.icon}
                        size={18}
                        color={option.id === 'dummy' ? '#D97706' : '#059669'}
                      />
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={18} color={option.id === 'dummy' ? '#D97706' : '#059669'} /> : null}
                  </View>
                  <Text style={[styles.typeLabel, { color: FORM.text(isDark) }]}>{option.label}</Text>
                  <Text style={[styles.typeExample, { color: FORM.muted(isDark) }]}>{option.example}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.detectedRow}>
        <Text style={[styles.detectedCaption, { color: FORM.muted(isDark) }]}>Detected type</Text>
        <Animated.View
          key={detectedType}
          entering={motionEnabled ? FadeIn.duration(180) : undefined}
          style={[styles.typeBadge, { backgroundColor: isDark ? `${typeColors.fg}24` : typeColors.bg }]}
        >
          <View style={[styles.typeDot, { backgroundColor: typeColors.fg }]} />
          <Text style={[styles.typeBadgeText, { color: typeColors.fg }]}>
            {admissionNumberTypeLabel(detectedType)}
          </Text>
        </Animated.View>
      </View>

      <InputField
        label="Admission Number"
        placeholder="Select a type above or enter manually"
        value={value}
        onChangeText={onChange}
        keyboardType={detectedType === 'permanent' ? 'number-pad' : 'default'}
        icon="card-outline"
        required
        accentColor={accentColor}
        fieldKey="ims-stu-adm-code"
        error={error}
      />

      {suggestionError ? (
        <View style={[styles.errorNotice, { backgroundColor: isDark ? '#3A1D22' : '#FEF2F2' }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{suggestionError}</Text>
        </View>
      ) : null}

      {isEditMode && detectedType === 'dummy' && !conversionPreview ? (
        <Animated.View
          entering={motionEnabled ? FadeInDown.duration(320) : undefined}
          style={[
            styles.conversionCard,
            clayCard(isDark),
            {
              backgroundColor: isDark ? '#1A2A26' : '#F3F9F7',
              borderColor: isDark ? 'rgba(91,170,154,0.28)' : 'rgba(91,170,154,0.2)',
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.55, y: 0.9 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.conversionHeader}>
            <View style={[styles.headerIcon, { backgroundColor: isDark ? 'rgba(91,170,154,0.22)' : 'rgba(91,170,154,0.14)' }]}>
              <Ionicons name="shield-checkmark" size={18} color={FORM.sage} />
            </View>
            <View style={styles.conversionCopy}>
              <Text style={[styles.conversionTitle, { color: FORM.text(isDark) }]}>Assign a permanent number</Text>
              <Text style={[styles.conversionSubtitle, { color: FORM.muted(isDark) }]}>
                Uses the next number after the highest numeric admission.
              </Text>
            </View>
          </View>

          <View style={[styles.numberJourney, { backgroundColor: isDark ? '#121A18' : '#FFFFFF' }]}>
            <View style={styles.journeyTile}>
              <Text style={[styles.journeyLabel, { color: FORM.muted(isDark) }]}>Current</Text>
              <Text style={[styles.journeyValue, { color: '#D97706' }]} numberOfLines={1}>{value}</Text>
              <Text style={[styles.journeyMeta, { color: FORM.muted(isDark) }]}>Temporary</Text>
            </View>

            <View style={styles.journeyConnector}>
              <View style={[styles.connectorLine, { backgroundColor: isDark ? 'rgba(91,170,154,0.3)' : 'rgba(91,170,154,0.22)' }]} />
              <Animated.View style={[styles.arrowBubble, { backgroundColor: isDark ? 'rgba(91,170,154,0.2)' : 'rgba(91,170,154,0.12)' }, transferArrowStyle]}>
                <Ionicons name="arrow-forward" size={14} color={FORM.sage} />
              </Animated.View>
              <View style={[styles.connectorLine, { backgroundColor: isDark ? 'rgba(91,170,154,0.3)' : 'rgba(91,170,154,0.22)' }]} />
              {conversionPending ? (
                <Animated.View pointerEvents="none" style={[styles.transferSpark, transferSparkStyle]}>
                  <Ionicons name="sparkles" size={11} color={isDark ? '#A7F3D0' : '#0F766E'} />
                </Animated.View>
              ) : null}
            </View>

            <Animated.View style={[styles.journeyTile, styles.journeyTileTarget, targetNumberStyle]}>
              <Text style={[styles.journeyLabel, { color: FORM.muted(isDark) }]}>Next permanent</Text>
              {loadingType === 'permanent' ? (
                <View style={styles.journeyLoader}>
                  <LogoLoader size={22} color={FORM.sage} />
                </View>
              ) : (
                <>
                  <Text style={[styles.journeyValue, { color: isDark ? '#5EEAD4' : '#0F766E' }]}>
                    {suggestion?.next_admission_no || '—'}
                  </Text>
                  <Text style={[styles.journeyMeta, { color: FORM.muted(isDark) }]}>
                    {suggestion
                      ? (suggestion.current_max === '0'
                        ? 'No permanent numbers yet'
                        : `Highest: ${suggestion.current_max}`)
                      : 'Detecting…'}
                  </Text>
                </>
              )}
            </Animated.View>
          </View>

          <View ref={convertButtonRef} collapsable={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={suggestion ? `Convert to ${suggestion.next_admission_no}` : 'Finding next number'}
              accessibilityState={{ busy: conversionPending, disabled: loadingType === 'permanent' || !suggestion }}
              disabled={loadingType === 'permanent' || !suggestion}
              onPress={stagePermanentConversion}
              style={({ pressed }) => [
                styles.convertButtonWrap,
                (loadingType === 'permanent' || !suggestion) && styles.muted,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.convertButton}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                {conversionPending ? (
                  <LogoLoader size={19} color="#fff" />
                ) : (
                  <Ionicons name="swap-horizontal" size={18} color="#fff" />
                )}
                <Text style={styles.convertButtonText}>
                  {conversionPending
                    ? 'Preparing permanent number…'
                    : suggestion
                      ? `Convert to ${suggestion.next_admission_no}`
                      : 'Finding next number…'}
                </Text>
              </View>
            </Pressable>
          </View>
          <Text style={[styles.saveReminder, { color: FORM.muted(isDark) }]}>
            Applies when you save the student
          </Text>
        </Animated.View>
      ) : null}

      {isEditMode && conversionPreview ? (
        <Animated.View
          entering={motionEnabled ? FadeIn.duration(180) : undefined}
          style={[
            styles.successCard,
            successStyle,
            clayCard(isDark),
            {
              backgroundColor: isDark ? '#12352D' : '#ECFDF5',
              borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.28)',
              shadowColor: '#10B981',
            },
          ]}
        >
          <LinearGradient
            colors={isDark ? ['rgba(52,211,153,0.18)', 'rgba(16,185,129,0)'] : ['rgba(167,243,208,0.65)', 'rgba(236,253,245,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Animated.View pointerEvents="none" style={[styles.shimmerBand, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.75)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.successIconWrap}>
            <Animated.View style={[styles.magicRing, ringStyle]} />
            <Animated.View style={[styles.magicRing, styles.magicRingSoft, ringStyle2]} />
            <Animated.View style={[styles.successIcon, iconStyle]}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </Animated.View>
          </View>

          <View style={styles.successCopy}>
            <Animated.Text
              entering={motionEnabled ? FadeInRight.delay(80).duration(260) : undefined}
              style={[styles.successTitle, { color: isDark ? '#6EE7B7' : '#047857' }]}
            >
              Permanent number ready
            </Animated.Text>
            <View style={styles.successNumberJourney}>
              <Animated.View
                entering={motionEnabled ? FadeIn.delay(100).duration(240) : undefined}
                style={[styles.successNumberPill, { backgroundColor: isDark ? 'rgba(217,119,6,0.18)' : 'rgba(254,243,199,0.9)' }]}
              >
                <Text style={[styles.successOldNumber, { color: isDark ? '#FCD34D' : '#B45309' }]} numberOfLines={1}>
                  {conversionPreview.from}
                </Text>
              </Animated.View>
              <Animated.View entering={motionEnabled ? FadeInRight.delay(180).duration(220) : undefined} style={styles.successArrow}>
                <Ionicons name="arrow-forward" size={14} color={isDark ? '#6EE7B7' : '#059669'} />
              </Animated.View>
              <Animated.View
                entering={motionEnabled ? ZoomIn.delay(260).springify().damping(15).stiffness(260) : undefined}
                style={[styles.successNumberPill, styles.successNewNumberPill, { backgroundColor: isDark ? 'rgba(16,185,129,0.22)' : '#D1FAE5' }]}
              >
                <Ionicons name="shield-checkmark" size={13} color={isDark ? '#6EE7B7' : '#047857'} />
                <Text style={[styles.successNewNumber, { color: isDark ? '#A7F3D0' : '#047857' }]} numberOfLines={1}>
                  {conversionPreview.to}
                </Text>
              </Animated.View>
            </View>
            <Animated.Text
              entering={motionEnabled ? FadeIn.delay(340).duration(240) : undefined}
              style={[styles.successSubtitle, { color: isDark ? '#A7F3D0' : '#065F46' }]}
            >
              Save this student to confirm the change.
            </Animated.Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  selectorGroup: { marginBottom: 14 },
  selectorHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  selectorLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.25 },
  selectorHint: { fontSize: 10.5, fontWeight: '500', marginTop: 2 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeOption: { flex: 1, minHeight: 108, borderRadius: 16, borderWidth: 1, padding: 12 },
  typeOptionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  typeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 12.5, fontWeight: '800' },
  typeExample: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  muted: { opacity: 0.55 },
  detectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  detectedCaption: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.55 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  typeBadgeText: { fontSize: 10.5, fontWeight: '800' },
  errorNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10, marginTop: -4, marginBottom: 12 },
  errorText: { color: '#EF4444', fontSize: 11, fontWeight: '600', flex: 1 },
  conversionCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginTop: 2,
    marginBottom: 14,
    overflow: 'hidden',
    borderBottomWidth: 1.5,
  },
  conversionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  conversionCopy: { flex: 1 },
  conversionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.25 },
  conversionSubtitle: { fontSize: 12, lineHeight: 17, fontWeight: '500', marginTop: 3 },
  numberJourney: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(91,170,154,0.12)',
  },
  journeyTile: { flex: 1, minWidth: 0 },
  journeyTileTarget: { alignItems: 'flex-end' },
  journeyLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, marginBottom: 4 },
  journeyValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  journeyMeta: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  journeyLoader: { height: 28, justifyContent: 'center' },
  journeyConnector: { width: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  connectorLine: { width: 8, height: 1.5, borderRadius: 1 },
  arrowBubble: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  transferSpark: { position: 'absolute', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  convertButtonWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 8px 18px rgba(15,118,110,0.22)' } as any,
      ios: { shadowColor: '#0F766E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12 },
      default: { elevation: 4 },
    }),
  },
  convertButton: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: FORM.sage,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0,0,0,0.14)',
    overflow: 'hidden',
  },
  convertButtonText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  saveReminder: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 10, lineHeight: 15 },
  successCard: {
    minHeight: 88,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
    marginBottom: 14,
    overflow: 'hidden',
  },
  shimmerBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 70,
    left: 0,
  },
  successIconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  magicRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#34D399',
  },
  magicRingSoft: {
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(16,185,129,0.35)' } as any,
      ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
      default: { elevation: 4 },
    }),
  },
  successCopy: { flex: 1 },
  successTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  successSubtitle: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 3 },
  successNumberJourney: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, marginBottom: 3 },
  successNumberPill: { minWidth: 0, maxWidth: '36%', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  successNewNumberPill: { maxWidth: '44%', flexDirection: 'row', alignItems: 'center', gap: 5 },
  successOldNumber: { fontSize: 12, fontWeight: '800', textDecorationLine: 'line-through' },
  successNewNumber: { flexShrink: 1, fontSize: 13, fontWeight: '900', letterSpacing: 0.1 },
  successArrow: { alignItems: 'center', justifyContent: 'center' },
});
