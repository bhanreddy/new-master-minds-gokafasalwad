import React, { useMemo, useState } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Keyboard,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ADMIN_THEME } from '../constants/adminTheme';
import { useTheme } from '../hooks/useTheme';
import { Theme } from '../theme/themes';
import ClayPasswordToggle from './ClayPasswordToggle';
import LogoLoader from './LogoLoader';

export const FORM = {
  brand: ADMIN_THEME.colors.primary,
  violet: '#7C6FFF',
  coral: ADMIN_THEME.colors.secondary,
  sage: '#5BAA9A',
  surface: (isDark: boolean) => (isDark ? '#1A1726' : '#FDFCFF'),
  field: (isDark: boolean) => (isDark ? '#221F30' : '#F3EFF8'),
  border: (isDark: boolean) => (isDark ? 'rgba(124, 111, 255, 0.18)' : 'rgba(102, 89, 144, 0.14)'),
  label: (isDark: boolean) => (isDark ? '#A89EC4' : '#6B6280'),
  text: (isDark: boolean) => (isDark ? '#EDE8F5' : '#2D2640'),
  muted: (isDark: boolean) => (isDark ? '#7A718F' : '#9B92AD'),
};

export function clayField(isDark: boolean) {
  if (Platform.OS === 'web') {
    const drop = isDark ? 'rgba(45, 30, 70, 0.55)' : 'rgba(102, 89, 144, 0.20)';
    const light = isDark ? 'rgba(124, 111, 255, 0.07)' : 'rgba(255, 255, 255, 0.92)';
    const innerHi = isDark ? 'rgba(124, 111, 255, 0.10)' : 'rgba(255, 255, 255, 0.80)';
    const innerLo = isDark ? 'rgba(20, 15, 35, 0.35)' : 'rgba(102, 89, 144, 0.12)';
    return {
      boxShadow:
        `5px 5px 14px ${drop}, -4px -4px 11px ${light}, ` +
        `inset 1.5px 1.5px 2px ${innerHi}, inset -1.5px -1.5px 2px ${innerLo}`,
    } as any;
  }
  return {
    shadowColor: isDark ? '#3D2858' : '#665990',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.38 : 0.18,
    shadowRadius: 11,
    elevation: 4,
  } as any;
}

export function clayCard(isDark: boolean) {
  if (Platform.OS === 'web') {
    const drop = isDark ? 'rgba(35, 22, 55, 0.58)' : 'rgba(102, 89, 144, 0.22)';
    const light = isDark ? 'rgba(124, 111, 255, 0.06)' : 'rgba(255, 255, 255, 0.96)';
    return { boxShadow: `8px 8px 22px ${drop}, -6px -6px 18px ${light}` } as any;
  }
  return {
    shadowColor: isDark ? '#3D2858' : '#665990',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.42 : 0.16,
    shadowRadius: 15,
    elevation: 6,
  } as any;
}

type AutofillMode = 'off' | 'password' | 'tel';

export function fieldAutofill(fieldKey: string, mode: AutofillMode = 'off') {
  const base: Record<string, unknown> = {
    autoComplete: mode === 'password' ? 'new-password' : 'off',
    textContentType: mode === 'password' ? 'newPassword' : 'none',
    autoCorrect: false,
  };
  if (Platform.OS !== 'web') return base;
  return {
    ...base,
    nativeID: fieldKey,
    id: fieldKey,
    name: fieldKey,
    'data-1p-ignore': 'true',
    'data-lpignore': 'true',
    'data-form-type': 'other',
  };
}

export const SECTION_COLORS = {
  personal: { accent: '#665990', light: '#EDE9F6', dark: '#2A2438' },
  academic: { accent: '#5BAA9A', light: '#E8F5F1', dark: '#1A2E28' },
  parents: { accent: '#F57964', light: '#FFF0ED', dark: '#3D2220' },
  additional: { accent: '#9B7EDE', light: '#F3EEFF', dark: '#2A1F40' },
  credentials: { accent: '#7C6FFF', light: '#EEEAFF', dark: '#252040' },
};

const AVATAR_GRADS: Record<number, [string, string]> = {
  1: ['#665990', '#7C6FFF'],
  2: ['#E8927C', '#F57964'],
  3: ['#5BAA9A', '#7C6FFF'],
};

export const STEPS = [
  { key: 'personal', label: 'Personal' },
  { key: 'academic', label: 'Academic' },
  { key: 'parents', label: 'Parents' },
  { key: 'details', label: 'Details' },
  { key: 'login', label: 'Login' },
] as const;

export type StepKey = (typeof STEPS)[number]['key'];

export function InputField({
  label, placeholder, value, onChangeText,
  keyboardType = 'default', icon, required = false,
  secureTextEntry = false, editable = true, accentColor = FORM.brand,
  fieldKey, autofillMode = 'off', error, hint, ...rest
}: any) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getAdmissionStyles(theme, isDark), [theme, isDark]);

  const focused = useSharedValue(0);
  const hasValue = value && String(value).length > 0;
  const [showPassword, setShowPassword] = useState(false);
  const [webReadOnly, setWebReadOnly] = useState(Platform.OS === 'web');
  const isPassword = !!secureTextEntry;
  const autofill = fieldKey ? fieldAutofill(fieldKey, autofillMode) : fieldAutofill('ims-stu-field', autofillMode);
  const hasError = !!error;

  const borderAnim = useAnimatedStyle(() => ({
    borderColor: hasError
      ? '#EF4444'
      : focused.value === 1
        ? accentColor
        : FORM.border(isDark),
    borderWidth: focused.value === 1 || hasError ? 1.5 : 1,
  }));

  const iconAnim = useAnimatedStyle(() => ({
    opacity: interpolate(focused.value, [0, 1], [0.45, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, (hasValue || focused) && { color: FORM.label(isDark) }]}>
        {label}{required && <Text style={{ color: FORM.coral }}> *</Text>}
      </Text>
      <Animated.View style={[
        styles.inputWrapper,
        clayField(isDark),
        borderAnim,
        !editable && styles.inputWrapperDisabled,
        hasError && styles.inputWrapperError,
      ]}>
        <Animated.View style={[{ marginRight: 10 }, iconAnim]}>
          <Ionicons
            name={icon}
            size={18}
            color={hasError ? '#EF4444' : focused.value === 1 ? accentColor : FORM.muted(isDark)}
          />
        </Animated.View>
        <AppTextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          placeholder={placeholder}
          placeholderTextColor={FORM.muted(isDark)}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType as any}
          secureTextEntry={isPassword && !showPassword}
          editable={editable}
          readOnly={editable ? webReadOnly : undefined}
          onFocus={() => {
            if (webReadOnly) setWebReadOnly(false);
            focused.value = withTiming(1, { duration: 180 });
          }}
          onBlur={() => { focused.value = withTiming(0, { duration: 200 }); }}
          {...autofill}
          {...rest}
        />
        {isPassword && editable && (
          <ClayPasswordToggle
            visible={showPassword}
            onToggle={() => setShowPassword(v => !v)}
            isDark={isDark}
            accentColor={accentColor}
          />
        )}
        {!editable && (
          <Ionicons name="lock-closed-outline" size={14} color={isDark ? '#374151' : '#CBD5E1'} />
        )}
      </Animated.View>
      {hasError ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function SelectField({
  label, value, options, onSelect, placeholder,
  icon, required = false, loading = false, accentColor = FORM.brand, error,
}: any) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getAdmissionStyles(theme, isDark), [theme, isDark]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = options.find((opt: any) => opt.id.toString() === value?.toString());
  const filtered = searchQuery.trim()
    ? options.filter((o: any) => o.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;
  const hasError = !!error;

  const chevronAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: modalVisible ? '180deg' : '0deg' }],
  }));

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>
        {label}{required && <Text style={{ color: FORM.coral }}> *</Text>}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.inputWrapper,
          clayField(isDark),
          {
            borderColor: hasError ? '#EF4444' : selectedOption ? accentColor : FORM.border(isDark),
            borderWidth: selectedOption || hasError ? 1.5 : 1,
          },
          hasError && styles.inputWrapperError,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => { Keyboard.dismiss(); if (!loading) setModalVisible(true); }}
        disabled={loading}
      >
        <View style={{ marginRight: 10 }}>
          <Ionicons
            name={icon}
            size={18}
            color={hasError ? '#EF4444' : selectedOption ? accentColor : FORM.muted(isDark)}
          />
        </View>
        <Text style={[styles.input, !selectedOption && { color: FORM.muted(isDark) }, { paddingTop: 0 }]}>
          {loading ? 'Loading…' : selectedOption ? selectedOption.name : placeholder}
        </Text>
        {selectedOption ? (
          <View style={[styles.selectedBadge, { backgroundColor: accentColor + '20' }]}>
            <Ionicons name="checkmark" size={12} color={accentColor} />
          </View>
        ) : (
          <Animated.View style={chevronAnim}>
            <Ionicons name="chevron-down" size={16} color={FORM.muted(isDark)} />
          </Animated.View>
        )}
      </Pressable>
      {hasError ? <Text style={styles.fieldError}>{error}</Text> : null}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => { }}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select {label}</Text>
                <Text style={styles.modalSubtitle}>{options.length} options available</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={18} color={FORM.muted(isDark)} />
              </Pressable>
            </View>

            {options.length > 5 && (
              <View style={[styles.modalSearchWrap, ds.searchBarWrapper]}>
                <Ionicons name="search-outline" size={16} color={FORM.muted(isDark)} style={{ marginRight: 8 }} />
                <AppTextInput
                  style={[ds.inputInChrome, styles.modalSearch]}
                  placeholder={`Search ${label}...`}
                  placeholderTextColor={FORM.muted(isDark)}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  {...fieldAutofill(`ims-stu-select-${label.replace(/\s/g, '-').toLowerCase()}`, 'off')}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={FORM.muted(isDark)} />
                  </Pressable>
                )}
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = value?.toString() === item.id.toString();
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.optionItem,
                      isSelected && [styles.selectedOption, { backgroundColor: accentColor + '12' }],
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => { onSelect(item.id); setModalVisible(false); setSearchQuery(''); }}
                  >
                    {isSelected && (
                      <View style={[styles.optionAccentBar, { backgroundColor: accentColor }]} />
                    )}
                    <Text style={[styles.optionText, isSelected && { color: accentColor, fontWeight: '700' }]}>
                      {item.name}
                    </Text>
                    {isSelected && (
                      <View style={[styles.optionCheck, { backgroundColor: accentColor }]}>
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Ionicons name="search-outline" size={28} color={FORM.muted(isDark)} />
                  <Text style={styles.modalEmptyText}>{`No results for "${searchQuery}"`}</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function SectionCard({
  title, icon, colorKey, delay, complete, meta, children,
}: {
  title: string;
  icon: string;
  colorKey: keyof typeof SECTION_COLORS;
  delay: number;
  complete?: boolean;
  meta?: string;
  children: React.ReactNode;
}) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getAdmissionStyles(theme, isDark), [theme, isDark]);
  const col = SECTION_COLORS[colorKey];

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500).springify()}
      style={[
        styles.sectionCard,
        clayCard(isDark),
        complete && { borderColor: `${col.accent}55` },
      ]}
    >
      <View style={[styles.sectionAccentBar, { backgroundColor: col.accent }]} />
      <View style={styles.sectionInner}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? col.dark : col.light }]}>
            <Ionicons name={icon as any} size={16} color={col.accent} />
          </View>
          <View style={styles.sectionTitles}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
          </View>
          {complete ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.sectionDonePill, { backgroundColor: `${col.accent}18` }]}>
              <Ionicons name="checkmark-circle" size={14} color={col.accent} />
              <Text style={[styles.sectionDoneText, { color: col.accent }]}>Done</Text>
            </Animated.View>
          ) : null}
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

export function ProgressRail({
  activeStep,
  completedSteps,
  percent,
  isDark,
}: {
  activeStep: number;
  completedSteps: boolean[];
  percent: number;
  isDark: boolean;
}) {
  return (
    <View style={[progressStyles.wrap, { backgroundColor: FORM.surface(isDark), borderColor: FORM.border(isDark) }, clayCard(isDark)]}>
      <View style={progressStyles.topRow}>
        <Text style={[progressStyles.caption, { color: FORM.muted(isDark) }]}>Enrollment progress</Text>
        <Text style={[progressStyles.percent, { color: FORM.brand }]}>{Math.round(percent)}%</Text>
      </View>
      <View style={[progressStyles.track, { backgroundColor: isDark ? '#2A2438' : '#EDE9F6' }]}>
        <View style={[progressStyles.fill, { width: `${Math.max(4, Math.min(100, percent))}%` }]} />
      </View>
      <View style={progressStyles.row}>
        {STEPS.map((step, i) => {
          const done = completedSteps[i];
          const active = i === activeStep;
          return (
            <View key={step.key} style={progressStyles.stepWrap}>
              <View style={[
                progressStyles.dot,
                done && progressStyles.dotDone,
                active && !done && progressStyles.dotActive,
                !done && !active && { backgroundColor: isDark ? '#221F30' : '#E8E2F0', borderColor: isDark ? '#221F30' : '#E8E2F0' },
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={9} color="#fff" />
                  : <View style={[progressStyles.dotInner, active && progressStyles.dotInnerActive]} />
                }
              </View>
              <Text style={[
                progressStyles.label,
                active && progressStyles.labelActive,
                done && progressStyles.labelDone,
                !done && !active && { color: FORM.muted(isDark) },
              ]}>{step.label}</Text>
              {i < STEPS.length - 1 && (
                <View style={[progressStyles.connector, (done || completedSteps[i + 1]) && progressStyles.connectorDone]} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function LiveAvatar({ firstName, lastName, genderId }: {
  firstName?: string;
  lastName?: string;
  genderId?: number;
}) {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const grad = AVATAR_GRADS[genderId || 1] || AVATAR_GRADS[1];

  return (
    <Animated.View entering={FadeIn.duration(400)} style={avatarStyles.wrap}>
      <LinearGradient colors={grad} style={avatarStyles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={avatarStyles.gloss} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <Text style={avatarStyles.initials}>{initials}</Text>
      </LinearGradient>
      <View style={[avatarStyles.statusDot, { backgroundColor: '#10B981' }]} />
    </Animated.View>
  );
}

export function SubSectionLabel({ label, accentColor }: { label: string; accentColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 4 }}>
      <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: accentColor }} />
      <Text style={{ fontSize: 12, fontWeight: '800', color: accentColor, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

export function StickySaveBar({
  loading,
  isEditMode,
  statusId,
  missingCount,
  onPress,
  isDark,
}: {
  loading: boolean;
  isEditMode: boolean;
  statusId?: number;
  missingCount: number;
  onPress: () => void;
  isDark: boolean;
}) {
  const label = isEditMode
    ? statusId === 2
      ? 'Mark as Passed Out'
      : statusId === 3
        ? 'Mark as Withdrawn'
        : 'Save Changes'
    : 'Enroll Student';

  return (
    <View style={[stickyStyles.bar, { backgroundColor: isDark ? 'rgba(26, 23, 38, 0.94)' : 'rgba(253, 252, 255, 0.94)', borderTopColor: FORM.border(isDark) }]}>
      {missingCount > 0 ? (
        <Text style={[stickyStyles.hint, { color: FORM.muted(isDark) }]}>
          {missingCount} required field{missingCount === 1 ? '' : 's'} remaining
        </Text>
      ) : (
        <Text style={[stickyStyles.hint, { color: FORM.sage }]}>Ready to {isEditMode ? 'save' : 'enroll'}</Text>
      )}
      <Pressable
        style={({ pressed }) => [stickyStyles.btnWrap, pressed && { opacity: 0.92 }, loading && { opacity: 0.75 }]}
        onPress={onPress}
        disabled={loading}
      >
        <LinearGradient
          colors={isEditMode ? ['#52467A', '#7C6FFF'] : ['#665990', '#F57964']}
          style={stickyStyles.btn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']}
            style={stickyStyles.gloss}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          {loading ? (
            <LogoLoader color="#fff" size={22} />
          ) : (
            <>
              <Ionicons name={isEditMode ? 'save-outline' : 'person-add-outline'} size={18} color="#fff" />
              <Text style={stickyStyles.btnText}>{label}</Text>
              <View style={stickyStyles.arrow}>
                <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.75)" />
              </View>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export function HeroMetaChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={heroChipStyles.chip}>
      <Ionicons name={icon} size={11} color="#fff" />
      <Text style={heroChipStyles.text}>{label}</Text>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 20,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  percent: { fontSize: 13, fontWeight: '900', letterSpacing: -0.2 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#665990' },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 0 },
  stepWrap: { alignItems: 'center', flex: 1, position: 'relative' },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  dotActive: { borderColor: '#665990', backgroundColor: '#665990' },
  dotDone: { backgroundColor: '#5BAA9A', borderColor: '#5BAA9A' },
  dotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  dotInnerActive: { backgroundColor: '#fff' },
  label: { fontSize: 9, fontWeight: '600', marginTop: 5, letterSpacing: 0.2, textAlign: 'center' },
  labelActive: { color: '#665990', fontWeight: '800' },
  labelDone: { color: '#5BAA9A' },
  connector: { position: 'absolute', top: 10, left: '55%', right: '-55%', height: 2, backgroundColor: '#E8E2F0', zIndex: 0 },
  connectorDone: { backgroundColor: '#5BAA9A' },
});

const avatarStyles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 8 },
  avatar: { width: 84, height: 84, borderRadius: 28, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 42, borderRadius: 28 },
  initials: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: '#fff' },
});

const stickyStyles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    gap: 8,
  },
  hint: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  btnWrap: {
    borderRadius: 18,
    shadowColor: '#665990',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 12,
  },
  btn: {
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 28, borderRadius: 18 },
  btnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  arrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const heroChipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  text: { fontSize: 11, fontWeight: '700', color: '#fff' },
});

export const getAdmissionStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#12101A' : '#F5F2FA', gap: 10 },
  loadingTitle: { fontSize: 17, fontWeight: '800', color: FORM.text(isDark), marginTop: 8 },
  loadingSubtitle: { fontSize: 13, color: FORM.muted(isDark), fontWeight: '500' },

  scrollContent: { padding: 18, paddingBottom: 24 },

  heroCard: {
    borderRadius: 28, padding: 26, alignItems: 'center',
    marginBottom: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28, shadowRadius: 28, elevation: 16,
  },
  heroBlob1: { position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroBlob2: { position: 'absolute', bottom: -30, left: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, borderRadius: 28 },
  heroName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: 12, textAlign: 'center' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 4, fontWeight: '500', textAlign: 'center' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  modePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  modePillText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1.2 },

  sectionCard: {
    flexDirection: 'row',
    backgroundColor: FORM.surface(isDark),
    borderRadius: 24,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FORM.border(isDark),
  },
  sectionAccentBar: { width: 4, borderRadius: 0 },
  sectionInner: { flex: 1, padding: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  sectionIconWrap: { width: 34, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  sectionTitles: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: FORM.text(isDark), letterSpacing: -0.2 },
  sectionMeta: { fontSize: 11, fontWeight: '600', color: FORM.muted(isDark), marginTop: 2 },
  sectionDonePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  sectionDoneText: { fontSize: 11, fontWeight: '800' },

  inputGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: FORM.label(isDark), marginBottom: 7, letterSpacing: 0.1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: FORM.field(isDark),
    borderRadius: 16, paddingHorizontal: 14, height: 50,
    borderWidth: 1, borderColor: FORM.border(isDark),
  },
  inputWrapperDisabled: { opacity: 0.6 },
  inputWrapperError: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
  },
  input: { flex: 1, fontSize: 15, color: FORM.text(isDark), fontWeight: '500' },
  inputDisabled: { color: FORM.muted(isDark) },
  fieldError: { marginTop: 6, fontSize: 11.5, fontWeight: '600', color: '#EF4444' },
  fieldHint: { marginTop: 6, fontSize: 11, fontWeight: '500', color: FORM.muted(isDark) },
  selectedBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  statusNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 13, borderRadius: 14,
    backgroundColor: isDark ? 'rgba(154, 52, 18, 0.18)' : '#FFF7ED',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(251, 146, 60, 0.35)' : '#FED7AA',
  },
  statusNoticeText: {
    flex: 1, color: isDark ? '#FDBA74' : '#9A3412',
    fontSize: 12, lineHeight: 18, fontWeight: '600',
  },

  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: FORM.surface(isDark),
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20,
    maxHeight: '82%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? '#3D3650' : '#E8E2F0', alignSelf: 'center', marginBottom: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: FORM.text(isDark), letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 12, color: FORM.muted(isDark), marginTop: 2, fontWeight: '500' },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: FORM.field(isDark),
    justifyContent: 'center', alignItems: 'center',
  },
  modalSearchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: FORM.field(isDark),
    borderRadius: 12, paddingHorizontal: 12, height: 42,
    marginBottom: 12,
    borderWidth: 1, borderColor: FORM.border(isDark),
  },
  modalSearch: { flex: 1, fontSize: 14, color: FORM.text(isDark), fontWeight: '500' },
  modalEmpty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  modalEmptyText: { fontSize: 14, color: FORM.muted(isDark), fontWeight: '500' },
  optionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: FORM.border(isDark),
    paddingLeft: 4,
  },
  selectedOption: { borderRadius: 10, paddingHorizontal: 4 },
  optionAccentBar: { width: 3, height: 18, borderRadius: 2 },
  optionText: { flex: 1, fontSize: 15, color: FORM.label(isDark), fontWeight: '500' },
  optionCheck: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
