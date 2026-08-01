import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** Boy / Girl only — maps to gender_id 1 / 2 (backend Male / Female). */
export const STUDENT_GENDER_OPTIONS = [
  { id: 1, name: 'Boy', icon: 'male-outline' as const },
  { id: 2, name: 'Girl', icon: 'female-outline' as const },
] as const;

export function studentGenderLabel(genderId?: number | null): string | undefined {
  if (genderId === 1) return 'Boy';
  if (genderId === 2) return 'Girl';
  return undefined;
}

export function formatAadhaarDisplay(value?: string | null): string | undefined {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return undefined;
  return digits.match(/.{1,4}/g)?.join(' ') || digits;
}

type AccentProps = {
  accentColor?: string;
  isDark?: boolean;
  labelColor?: string;
  fieldBg?: string;
  borderColor?: string;
  textColor?: string;
};

function useFieldColors(props: AccentProps) {
  const accent = props.accentColor || '#665990';
  const isDark = !!props.isDark;
  return {
    accent,
    label: props.labelColor || (isDark ? '#A89EC4' : '#6B6280'),
    field: props.fieldBg || (isDark ? '#221F30' : '#F3EFF8'),
    border: props.borderColor || (isDark ? 'rgba(124, 111, 255, 0.18)' : 'rgba(102, 89, 144, 0.14)'),
    text: props.textColor || (isDark ? '#EDE8F5' : '#2D2640'),
    muted: isDark ? '#7A718F' : '#9B92AD',
    panel: isDark ? 'rgba(34, 31, 48, 0.92)' : 'rgba(255, 255, 255, 0.86)',
    panelBorder: isDark ? 'rgba(168, 158, 196, 0.16)' : 'rgba(102, 89, 144, 0.10)',
    chip: isDark ? 'rgba(102, 89, 144, 0.32)' : 'rgba(102, 89, 144, 0.10)',
    focusFill: isDark ? 'rgba(102, 89, 144, 0.24)' : 'rgba(102, 89, 144, 0.07)',
    success: '#5BAA9A',
  };
}

type SegmentOption<T extends string | number | boolean> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

function SegmentSelector<T extends string | number | boolean>({
  label,
  value,
  options,
  onSelect,
  required,
  ...colorProps
}: AccentProps & {
  label: string;
  value: T | null | undefined;
  options: SegmentOption<T>[];
  onSelect: (value: T) => void;
  required?: boolean;
}) {
  const c = useFieldColors(colorProps);
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: c.label }]}>
        {label}{required ? ' *' : ''}
      </Text>
      <View style={styles.segmentRow}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              style={[
                styles.segmentBtn,
                {
                  backgroundColor: selected ? c.accent : c.field,
                  borderColor: selected ? c.accent : c.border,
                },
                selected && styles.segmentBtnSelected,
              ]}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.85}
            >
              {opt.icon ? (
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={selected ? '#fff' : c.muted}
                  style={{ marginRight: 6 }}
                />
              ) : null}
              <Text style={[styles.segmentText, { color: selected ? '#fff' : c.text }]}>
                {opt.label}
              </Text>
              {selected ? (
                <View style={styles.segmentCheck}>
                  <Ionicons name="checkmark" size={11} color="#fff" />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function GenderBoyGirlSelector({
  value,
  onSelect,
  required,
  ...colorProps
}: AccentProps & {
  value: number;
  onSelect: (id: number) => void;
  required?: boolean;
}) {
  return (
    <SegmentSelector
      label="Gender"
      value={value}
      options={STUDENT_GENDER_OPTIONS.map((g) => ({
        value: g.id,
        label: g.name,
        icon: g.icon,
      }))}
      onSelect={onSelect}
      required={required}
      {...colorProps}
    />
  );
}

export function PreviousSchoolYesNoSelector({
  value,
  onSelect,
  ...colorProps
}: AccentProps & {
  value: boolean | null | undefined;
  onSelect: (value: boolean) => void;
}) {
  return (
    <SegmentSelector
      label="Previous School"
      value={value === true || value === false ? value : undefined}
      options={[
        { value: true, label: 'Yes', icon: 'school-outline' },
        { value: false, label: 'No', icon: 'home-outline' },
      ]}
      onSelect={onSelect}
      {...colorProps}
    />
  );
}

function FieldPanel({
  icon,
  title,
  subtitle,
  complete,
  footer,
  children,
  ...colorProps
}: AccentProps & {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  complete?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = useFieldColors(colorProps);
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: c.panel,
          borderColor: complete ? `${c.success}55` : c.panelBorder,
        },
        complete && styles.panelComplete,
      ]}
    >
      <View style={styles.panelHeader}>
        <View style={[styles.iconBadge, { backgroundColor: complete ? `${c.success}18` : c.chip }]}>
          <Ionicons name={complete ? 'checkmark-circle' : icon} size={16} color={complete ? c.success : c.accent} />
        </View>
        <View style={styles.panelTitles}>
          <Text style={[styles.panelTitle, { color: c.text }]}>{title}</Text>
          <Text style={[styles.panelSubtitle, { color: c.muted }]}>{subtitle}</Text>
        </View>
        {complete ? (
          <Animated.View entering={FadeIn.duration(220)} style={[styles.completeBadge, { backgroundColor: `${c.success}18` }]}>
            <Ionicons name="checkmark-circle" size={18} color={c.success} />
          </Animated.View>
        ) : null}
      </View>
      {children}
      {footer}
    </View>
  );
}

function DigitCluster({
  value,
  length,
  focused,
  placeholderChar,
  onPress,
  colors,
}: {
  value: string;
  length: number;
  focused: boolean;
  placeholderChar: string;
  onPress: () => void;
  colors: ReturnType<typeof useFieldColorsWithSlot>;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(focused ? 1.03 : 1, { damping: 16, stiffness: 220 });
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const chars = value.padEnd(length, ' ').slice(0, length).split('');
  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={[
          styles.cluster,
          {
            backgroundColor: focused ? colors.focusFill : colors.field,
            borderColor: focused ? colors.accent : colors.border,
          },
          focused && styles.clusterFocused,
        ]}
      >
        {chars.map((ch, i) => {
          const filled = ch !== ' ';
          return (
            <View
              key={i}
              style={[
                styles.digitCell,
                {
                  backgroundColor: colors.isDarkSlot,
                  borderColor: focused
                    ? `${colors.accent}88`
                    : filled
                      ? `${colors.accent}40`
                      : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.digitChar,
                  { color: filled ? colors.text : colors.muted },
                  !filled && styles.digitPlaceholder,
                ]}
              >
                {filled ? ch : placeholderChar}
              </Text>
            </View>
          );
        })}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Extend color helper with dark-slot fill for digit cells. */
function useFieldColorsWithSlot(props: AccentProps) {
  const c = useFieldColors(props);
  return {
    ...c,
    isDarkSlot: props.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)',
  };
}

/** Three consecutive 4-digit clusters → 12-digit Aadhaar string. */
export function AadhaarNumberField({
  value,
  onChange,
  ...colorProps
}: AccentProps & {
  value?: string | null;
  onChange: (digits: string) => void;
}) {
  const c = useFieldColorsWithSlot(colorProps);
  const digits = String(value || '').replace(/\D/g, '').slice(0, 12);
  const parts = [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)];
  const ref0 = useRef<TextInput>(null);
  const ref1 = useRef<TextInput>(null);
  const ref2 = useRef<TextInput>(null);
  const refs = [ref0, ref1, ref2];
  const [focused, setFocused] = useState<number | null>(null);
  const complete = digits.length === 12;
  const progress = useSharedValue(digits.length / 12);

  useEffect(() => {
    progress.value = withTiming(digits.length / 12, { duration: 220 });
  }, [digits.length, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(4, progress.value * 100)}%`,
  }));

  const setPart = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 4);
    const next = [...parts];
    next[index] = clean;
    onChange(next.join(''));
    if (clean.length === 4 && index < 2) {
      refs[index + 1].current?.focus();
    }
  };

  const onKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !parts[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  return (
    <FieldPanel
      icon="finger-print-outline"
      title="Aadhaar Number"
      subtitle="Enter the 12-digit Aadhaar in three groups of 4"
      complete={complete}
      {...colorProps}
      footer={
        <View style={styles.progressTrackWrap}>
          <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: complete ? c.success : c.accent },
                barStyle,
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: complete ? c.success : c.muted }]}>
            {complete ? 'Format ready' : `${digits.length}/12`}
          </Text>
        </View>
      }
    >
      <View style={styles.aadhaarRow}>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {index > 0 ? (
              <View style={[styles.dashPill, { backgroundColor: c.chip }]}>
                <View style={[styles.dashDot, { backgroundColor: c.accent }]} />
              </View>
            ) : null}
            <View style={styles.clusterWrap}>
              <DigitCluster
                value={part}
                length={4}
                focused={focused === index}
                placeholderChar="·"
                onPress={() => refs[index].current?.focus()}
                colors={c}
              />
              <TextInput
                ref={refs[index]}
                value={part}
                onChangeText={(t) => setPart(index, t)}
                onKeyPress={({ nativeEvent }) => onKeyPress(index, nativeEvent.key)}
                onFocus={() => setFocused(index)}
                onBlur={() => setFocused((f) => (f === index ? null : f))}
                keyboardType="number-pad"
                maxLength={4}
                caretHidden
                style={styles.hiddenInput}
                autoComplete="off"
                {...(Platform.OS === 'web' ? { nativeID: `ims-stu-aadhaar-${index}` } : {})}
              />
            </View>
          </React.Fragment>
        ))}
      </View>
    </FieldPanel>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ageFromYmd(ymd: string): string | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const birth = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(birth.getTime()) || birth > new Date()) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  if (years === 0) return months === 1 ? '1 month old' : `${months} months old`;
  if (months === 0) return years === 1 ? '1 year old' : `${years} years old`;
  return `${years}y ${months}m`;
}

/** Split YYYY-MM-DD into DD / MM / YYYY part inputs. */
export function DateOfBirthPartsField({
  value,
  onChange,
  ...colorProps
}: AccentProps & {
  value?: string | null;
  onChange: (ymd: string) => void;
}) {
  const c = useFieldColorsWithSlot(colorProps);
  const parsed = useMemo(() => {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return { dd: '', mm: '', yyyy: '' };
    return { dd: m[3], mm: m[2], yyyy: m[1] };
  }, [value]);

  const [dd, setDd] = useState(parsed.dd);
  const [mm, setMm] = useState(parsed.mm);
  const [yyyy, setYyyy] = useState(parsed.yyyy);
  const [focused, setFocused] = useState<'dd' | 'mm' | 'yyyy' | null>(null);

  useEffect(() => {
    setDd(parsed.dd);
    setMm(parsed.mm);
    setYyyy(parsed.yyyy);
  }, [parsed.dd, parsed.mm, parsed.yyyy]);

  const ddRef = useRef<TextInput>(null);
  const mmRef = useRef<TextInput>(null);
  const yyyyRef = useRef<TextInput>(null);

  const emit = (nextDd: string, nextMm: string, nextYyyy: string) => {
    if (nextDd.length === 2 && nextMm.length === 2 && nextYyyy.length === 4) {
      const day = Number(nextDd);
      const month = Number(nextMm);
      const year = Number(nextYyyy);
      if (
        year >= 1900 &&
        month >= 1 && month <= 12 &&
        day >= 1 && day <= 31
      ) {
        const candidate = new Date(year, month - 1, day);
        if (
          candidate.getFullYear() === year &&
          candidate.getMonth() === month - 1 &&
          candidate.getDate() === day &&
          candidate <= new Date()
        ) {
          onChange(`${year}-${pad2(month)}-${pad2(day)}`);
          return;
        }
      }
    }
    if (!nextDd && !nextMm && !nextYyyy) {
      onChange('');
    }
  };

  const complete = !!(
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    dd.length === 2 &&
    mm.length === 2 &&
    yyyy.length === 4
  );
  const ageLabel = complete && value ? ageFromYmd(value) : null;

  const units: Array<{
    key: 'dd' | 'mm' | 'yyyy';
    caption: string;
    hint: string;
    length: number;
    val: string;
    set: (v: string) => void;
    ref: React.RefObject<TextInput | null>;
    next?: () => void;
  }> = [
    {
      key: 'dd',
      caption: 'DATE',
      hint: 'DD',
      length: 2,
      val: dd,
      set: setDd,
      ref: ddRef,
      next: () => mmRef.current?.focus(),
    },
    {
      key: 'mm',
      caption: 'MONTH',
      hint: 'MM',
      length: 2,
      val: mm,
      set: setMm,
      ref: mmRef,
      next: () => yyyyRef.current?.focus(),
    },
    {
      key: 'yyyy',
      caption: 'YEAR',
      hint: 'YYYY',
      length: 4,
      val: yyyy,
      set: setYyyy,
      ref: yyyyRef,
    },
  ];

  return (
    <FieldPanel
      icon="calendar-outline"
      title="Date of Birth"
      subtitle="As per official documents — day, month, then year"
      complete={complete}
      {...colorProps}
      footer={
        ageLabel ? (
          <Animated.View entering={FadeIn.duration(220)} style={[styles.agePill, { backgroundColor: `${c.success}14` }]}>
            <Ionicons name="sparkles-outline" size={13} color={c.success} />
            <Text style={[styles.ageText, { color: c.success }]}>{ageLabel}</Text>
          </Animated.View>
        ) : (
          <Text style={[styles.ageHint, { color: c.muted }]}>Age appears once the date is complete</Text>
        )
      }
    >
      <View style={styles.dobRow}>
        {units.map((unit, index) => (
          <React.Fragment key={unit.key}>
            {index > 0 ? (
              <Text style={[styles.dobSep, { color: c.muted }]}>/</Text>
            ) : null}
            <View style={styles.dobUnit}>
              <Text style={[styles.unitCaption, { color: c.accent }]}>{unit.caption}</Text>
              <View style={styles.clusterWrap}>
                <DigitCluster
                  value={unit.val}
                  length={unit.length}
                  focused={focused === unit.key}
                  placeholderChar="·"
                  onPress={() => unit.ref.current?.focus()}
                  colors={c}
                />
                <TextInput
                  ref={unit.ref}
                  value={unit.val}
                  onChangeText={(t) => {
                    const clean = t.replace(/\D/g, '').slice(0, unit.length);
                    unit.set(clean);
                    const nextDd = unit.key === 'dd' ? clean : dd;
                    const nextMm = unit.key === 'mm' ? clean : mm;
                    const nextYyyy = unit.key === 'yyyy' ? clean : yyyy;
                    emit(nextDd, nextMm, nextYyyy);
                    if (clean.length === unit.length) unit.next?.();
                  }}
                  onFocus={() => setFocused(unit.key)}
                  onBlur={() => setFocused((f) => (f === unit.key ? null : f))}
                  keyboardType="number-pad"
                  maxLength={unit.length}
                  caretHidden
                  style={styles.hiddenInput}
                  autoComplete="off"
                />
              </View>
              <Text style={[styles.unitHint, { color: c.muted }]}>{unit.hint}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </FieldPanel>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.15,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  segmentBtnSelected: {
    shadowColor: '#665990',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '700',
  },
  segmentCheck: {
    marginLeft: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  panelComplete: {
    shadowColor: '#5BAA9A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitles: {
    flex: 1,
    minWidth: 0,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  panelSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  completeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aadhaarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  clusterWrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 3,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  clusterFocused: {
    shadowColor: '#665990',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  digitCell: {
    width: 26,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitChar: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  digitPlaceholder: {
    fontWeight: '700',
    fontSize: 18,
    opacity: 0.4,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.011,
    color: 'transparent',
    zIndex: 2,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any, caretColor: 'transparent' as any } : {}),
  },
  dashPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  progressTrackWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    minWidth: 72,
    textAlign: 'right',
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
  },
  dobUnit: {
    alignItems: 'center',
  },
  unitCaption: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 4,
    textAlign: 'center',
  },
  unitHint: {
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  dobSep: {
    fontSize: 18,
    fontWeight: '300',
    marginTop: 28,
    opacity: 0.7,
  },
  agePill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ageText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  ageHint: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
  },
});
