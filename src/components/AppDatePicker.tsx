import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Platform,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYMD(s: string): Date {
  if (!s) return new Date();
  const parts = s.split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function toInputDate(v?: Date | string): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v || undefined;
  return toYMD(v);
}

function toDateObj(v?: Date | string): Date | undefined {
  if (!v) return undefined;
  return typeof v === 'string' ? parseYMD(v) : v;
}

export type AppDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  minimumDate?: Date | string;
  maximumDate?: Date | string;
  disabled?: boolean;
  iconColor?: string;
  textColor?: string;
  placeholderColor?: string;
  borderColor?: string;
  accentColor?: string;
  isDark?: boolean;
  containerStyle?: ViewStyle;
  wrapperStyle?: ViewStyle;
  labelStyle?: TextStyle;
  variant?: 'default' | 'compact';
  showSelectedBadge?: boolean;
};

export default function AppDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  required = false,
  minimumDate,
  maximumDate,
  disabled = false,
  iconColor,
  textColor,
  placeholderColor,
  borderColor,
  accentColor = '#3B82F6',
  isDark = false,
  containerStyle,
  wrapperStyle,
  labelStyle,
  variant = 'default',
  showSelectedBadge = false,
}: AppDatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [focused, setFocused] = useState(false);
  const pickerValue = useMemo(() => parseYMD(value), [value]);
  const minStr = toInputDate(minimumDate);
  const maxStr = toInputDate(maximumDate);
  const minDateObj = toDateObj(minimumDate);
  const maxDateObj = toDateObj(maximumDate);

  const hasVal = !!value;
  const resolvedTextColor = textColor ?? (isDark ? '#EEF2FF' : '#0F172A');
  const resolvedPlaceholderColor = placeholderColor ?? (isDark ? '#374151' : '#CBD5E1');
  const resolvedIconColor =
    iconColor ??
    (hasVal || focused ? accentColor : isDark ? '#64748B' : '#94A3B8');
  const resolvedBorderColor =
    borderColor ??
    (hasVal || focused
      ? accentColor
      : isDark
        ? 'rgba(255,255,255,0.10)'
        : 'rgba(0,0,0,0.10)');

  const onNativeChange = (_event: unknown, date?: Date) => {
    setShowPicker(false);
    if (date) onChange(toYMD(date));
  };

  const displayText = hasVal ? parseYMD(value).toLocaleDateString() : '';

  const webInputStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    width: '100%',
    flex: 1,
    minWidth: 0,
    fontSize: variant === 'compact' ? 13 : 15,
    fontWeight: variant === 'compact' ? 600 : 400,
    letterSpacing: variant === 'compact' ? -0.2 : 0,
    color: resolvedTextColor,
    fontFamily: 'inherit',
    padding: 0,
    margin: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxSizing: 'border-box',
    height: '100%',
    opacity: disabled ? 0.6 : 1,
    colorScheme: isDark ? 'dark' : 'light',
  };

  const wrapperStyles = [
    variant === 'compact' ? styles.compactWrapper : styles.defaultWrapper,
    {
      backgroundColor:
        variant === 'compact'
          ? isDark
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.03)'
          : isDark
            ? 'rgba(255,255,255,0.05)'
            : '#FFFFFF',
      borderColor: focused && variant === 'compact' ? (isDark ? 'rgba(99,102,241,0.60)' : 'rgba(79,70,229,0.50)') : resolvedBorderColor,
      borderWidth: hasVal && variant === 'default' ? 1.5 : 1,
    },
    wrapperStyle,
  ];

  return (
    <View style={[variant === 'compact' ? styles.compactContainer : styles.defaultContainer, containerStyle]}>
      {label ? (
        <Text
          style={[
            variant === 'compact' ? styles.compactLabel : styles.defaultLabel,
            { color: isDark ? '#64748B' : '#94A3B8' },
            labelStyle,
          ]}
        >
          {label}
          {required && <Text style={{ color: '#EF4444' }}> *</Text>}
        </Text>
      ) : null}

      <View style={wrapperStyles}>
        <Ionicons
          name="calendar-outline"
          size={variant === 'compact' ? 15 : 18}
          color={resolvedIconColor}
          style={variant === 'default' ? { marginRight: 10 } : undefined}
        />

        {Platform.OS === 'web' ? (
          React.createElement('input', {
            type: 'date',
            value: value || '',
            min: minStr,
            max: maxStr,
            disabled,
            'aria-label': label || placeholder,
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
            style: webInputStyle,
          })
        ) : (
          <>
            <TouchableOpacity
              style={styles.nativeTap}
              onPress={() => !disabled && setShowPicker(true)}
              activeOpacity={0.75}
              disabled={disabled}
            >
              <Text
                style={[
                  variant === 'compact' ? styles.compactInputText : styles.defaultInputText,
                  { color: hasVal ? resolvedTextColor : resolvedPlaceholderColor },
                ]}
              >
                {displayText || placeholder}
              </Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onNativeChange}
                minimumDate={minDateObj}
                maximumDate={maxDateObj}
              />
            )}
          </>
        )}

        {showSelectedBadge && hasVal && Platform.OS !== 'web' ? (
          <View style={[styles.selectedBadge, { backgroundColor: accentColor + '20' }]}>
            <Ionicons name="checkmark" size={12} color={accentColor} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  defaultContainer: {
    marginBottom: 16,
  },
  compactContainer: {
    flex: 1,
  },
  defaultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  defaultWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 48,
    ...Platform.select({
      web: { overflow: 'visible' as any },
      default: {},
    }),
  },
  compactWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  nativeTap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 20,
  },
  defaultInputText: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  compactInputText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  selectedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
