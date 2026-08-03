import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Pressable, Platform, ActivityIndicator, RefreshControl, ScrollView, Image, Linking, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AdminHeader from '../../../src/components/AdminHeader';
import { useAccountsWebChrome } from '../../../src/contexts/AccountsWebChromeContext';
import Animated, {
  FadeInDown, FadeIn, useAnimatedStyle,
  useSharedValue, withSpring, interpolate
} from 'react-native-reanimated';
import { useAuth } from '../../../src/hooks/useAuth';
import { useApiQuery } from '../../../src/hooks/useApiQuery';
import { FeeService, FeeSummaryStatus } from '../../../src/services/feeService';
import { ClassService, ClassInfo } from '../../../src/services/classService';
import { useTheme } from '../../../src/hooks/useTheme';
import LogoLoader from '../../../src/components/LogoLoader';

// ─── Constants ────────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Paid', 'Partial', 'Pending'] as const;
type FilterType = typeof FILTERS[number];
const VIEW_MODES = ['Students', 'Class Structures'] as const;
type ViewMode = typeof VIEW_MODES[number];
const PAGE_LIMIT = 50;
const CACHE_TTL_MS = 60 * 1000;

const EMPTY_COUNTS: Record<FilterType, number> = {
  All: 0,
  Paid: 0,
  Partial: 0,
  Pending: 0,
};

type FeeListStudent = {
  id: string;
  name: string;
  admissionNo: string;
  class: string;
  fatherName?: string;
  fatherMobile?: string;
  studentGender?: string;
  parentLine?: string;
  photoUrl?: string;
  status: FeeSummaryStatus;
  total: number | string;
  paid: number | string;
  due: number | string;
  rawId: string;
};

type SummaryStats = {
  collectedTotal: number;
  pendingDues: number;
  pendingStudents: number;
};

type FeeSummaryMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  counts: Record<FilterType, number>;
};

type ClassFeeStructure = {
  id: string;
  class_name: string;
  section_name?: string;
  fee_type: string;
  academic_year: string;
  amount: number;
  due_date?: string;
  frequency?: string;
};

const STATUS_CONFIG = {
  Paid: { light: { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' }, dark: { bg: 'rgba(16,185,129,0.15)', text: '#34D399', dot: '#10B981' } },
  Partial: { light: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' }, dark: { bg: 'rgba(245,158,11,0.15)', text: '#FCD34D', dot: '#F59E0B' } },
  Pending: { light: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' }, dark: { bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5', dot: '#EF4444' } },
} as const;

const FILTER_ACCENT: Record<FilterType, string> = {
  All: '#3B82F6',
  Paid: '#10B981',
  Partial: '#F59E0B',
  Pending: '#EF4444',
};

const FEE_UX = {
  pageBgLight: '#E8ECF4',
  pageBgDark: '#0B0D14',
  clayLight: '#F4F7FD',
  clayDark: '#2A3142',
  accent: '#3B82F6',
};

const formatPhoneDisplay = (raw?: string): string | null => {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(1, 6)} ${digits.slice(6)}`;
  }
  return raw.trim();
};

const phoneDialUri = (raw?: string): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `tel:${digits}`;
};

// ─── Mini Progress Bar ────────────────────────────────────────────────────────
function MiniProgress({ paid, total, isDark }: { paid: number; total: number; isDark: boolean }) {
  const ratio = total > 0 ? Math.min(paid / total, 1) : 0;
  const pct = Math.round(ratio * 100);
  const color = ratio >= 1 ? '#10B981' : ratio >= 0.5 ? '#F59E0B' : '#EF4444';
  const track = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : '#64748B';

  return (
    <View style={cardStyles.progressBlock}>
      <View style={cardStyles.progressMeta}>
        <Text style={[cardStyles.progressLabel, { color: labelColor }]}>Collection</Text>
        <Text style={[cardStyles.progressPct, { color }]}>{pct}% paid</Text>
      </View>
      <View style={[cardStyles.progressTrack, { backgroundColor: track }]}>
        <View style={[cardStyles.progressFill, { width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────
const StudentCard = React.memo(function StudentCard({
  item, index, isDark, onPress,
}: {
  item: FeeListStudent; index: number; isDark: boolean; onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const pressed = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.985]) }],
  }));

  const s = (STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.Pending)[isDark ? 'dark' : 'light'];
  const textPri = isDark ? '#F9FAFB' : '#0F172A';
  const textSec = isDark ? 'rgba(255,255,255,0.5)' : '#64748B';
  const chipBg = isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.78)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(76,90,120,0.08)';
  const phoneDisplay = formatPhoneDisplay(item.fatherMobile);
  const dialUri = phoneDialUri(item.fatherMobile);

  const due = parseFloat(String(item.due)) || 0;
  const paid = parseFloat(String(item.paid)) || 0;
  const total = parseFloat(String(item.total)) || 0;

  const handleCall = useCallback(() => {
    if (!dialUri) return;
    Linking.openURL(dialUri).catch(() => {});
  }, [dialUri]);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320).springify()}
      style={animStyle}
    >
      <Pressable
        style={[
          cardStyles.card,
          {
            backgroundColor: isDark ? FEE_UX.clayDark : FEE_UX.clayLight,
            borderTopWidth: 1.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.98)',
            borderBottomWidth: 2.5,
            borderBottomColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(76,90,120,0.14)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(76,90,120,0.05)',
            shadowColor: isDark ? '#000' : '#6B7A99',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.28 : 0.14,
            shadowRadius: 16,
            elevation: 3,
          },
        ]}
        onPress={onPress}
        onPressIn={() => { pressed.value = withSpring(1, { damping: 18, stiffness: 220 }); }}
        onPressOut={() => { pressed.value = withSpring(0, { damping: 18, stiffness: 220 }); }}
      >
        <View style={[StyleSheet.absoluteFill, { borderRadius: 22, overflow: 'hidden' }]} pointerEvents="none">
          <LinearGradient
            colors={isDark
              ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.55, y: 0.95 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[cardStyles.statusWash, { backgroundColor: `${s.dot}${isDark ? '14' : '0D'}` }]} />
        </View>

        <View style={[cardStyles.accent, { backgroundColor: s.dot }]} />

        <View style={[cardStyles.inner, wide && cardStyles.innerWide]}>
          <View style={[cardStyles.identityCol, wide && cardStyles.identityColWide]}>
            <View style={cardStyles.headerRow}>
              <View
                style={[
                  cardStyles.avatarRing,
                  {
                    borderColor: s.dot,
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : `${s.dot}18`,
                  },
                ]}
              >
                <View
                  style={[
                    cardStyles.avatarWrap,
                    {
                      backgroundColor: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.95)',
                      overflow: 'hidden',
                    },
                  ]}
                >
                  {item.photoUrl ? (
                    <Image
                      source={{ uri: item.photoUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={[cardStyles.avatarText, { color: s.dot }]}>
                      {(item.name || 'S').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>

              <View style={cardStyles.nameBlock}>
                <View style={cardStyles.nameTopRow}>
                  <Text style={[cardStyles.name, { color: textPri }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!wide ? (
                    <View style={[cardStyles.statusBadge, { backgroundColor: s.bg }]}>
                      <View style={[cardStyles.statusDot, { backgroundColor: s.dot }]} />
                      <Text style={[cardStyles.statusText, { color: s.text }]}>{item.status}</Text>
                    </View>
                  ) : null}
                </View>

                {item.parentLine ? (
                  <Text style={[cardStyles.parentLine, { color: textSec }]} numberOfLines={1}>
                    {item.parentLine}
                  </Text>
                ) : item.fatherName ? (
                  <Text style={[cardStyles.parentLine, { color: textSec }]} numberOfLines={1}>
                    Parent: {item.fatherName}
                  </Text>
                ) : null}

                <View style={cardStyles.metaRow}>
                  {item.admissionNo ? (
                    <View style={[cardStyles.metaTag, { backgroundColor: chipBg, borderColor: chipBorder }]}>
                      <Ionicons name="id-card-outline" size={11} color={textSec} />
                      <Text style={[cardStyles.metaTagText, { color: textSec }]}>#{item.admissionNo}</Text>
                    </View>
                  ) : null}
                  {item.class ? (
                    <View style={[cardStyles.metaTag, { backgroundColor: chipBg, borderColor: chipBorder }]}>
                      <Ionicons name="school-outline" size={11} color={textSec} />
                      <Text style={[cardStyles.metaTagText, { color: textSec }]}>Class {item.class}</Text>
                    </View>
                  ) : null}
                </View>

                {phoneDisplay ? (
                  <Pressable
                    onPress={handleCall}
                    hitSlop={8}
                    style={[
                      cardStyles.phoneChip,
                      {
                        backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.10)',
                        borderColor: isDark ? 'rgba(96,165,250,0.28)' : 'rgba(59,130,246,0.22)',
                      },
                    ]}
                  >
                    <View style={[cardStyles.phoneIconWrap, { backgroundColor: isDark ? 'rgba(59,130,246,0.28)' : '#DBEAFE' }]}>
                      <Ionicons name="call" size={11} color="#2563EB" />
                    </View>
                    <Text style={[cardStyles.phoneText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]} numberOfLines={1}>
                      {phoneDisplay}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={[cardStyles.phoneChip, cardStyles.phoneChipMuted, { backgroundColor: chipBg, borderColor: chipBorder }]}>
                    <Ionicons name="call-outline" size={12} color={textSec} />
                    <Text style={[cardStyles.phoneMutedText, { color: textSec }]}>No phone on file</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={[cardStyles.financeCol, wide && cardStyles.financeColWide]}>
            {wide ? (
              <View style={cardStyles.financeTop}>
                <View style={[cardStyles.statusBadge, { backgroundColor: s.bg }]}>
                  <View style={[cardStyles.statusDot, { backgroundColor: s.dot }]} />
                  <Text style={[cardStyles.statusText, { color: s.text }]}>{item.status}</Text>
                </View>
                <View style={[cardStyles.openHint, { backgroundColor: isDark ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.08)' }]}>
                  <Text style={cardStyles.openHintText}>Open ledger</Text>
                  <Ionicons name="arrow-forward" size={12} color="#2563EB" />
                </View>
              </View>
            ) : null}

            <View style={[cardStyles.figRow, { backgroundColor: isDark ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.62)' }]}>
              <FigCell
                icon="wallet-outline"
                label="Total"
                value={`₹${total.toLocaleString('en-IN')}`}
                color={textPri}
                sec={textSec}
                iconTint={isDark ? '#94A3B8' : '#64748B'}
              />
              <View style={[cardStyles.figSep, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]} />
              <FigCell
                icon="checkmark-circle-outline"
                label="Collected"
                value={`₹${paid.toLocaleString('en-IN')}`}
                color="#059669"
                sec={textSec}
                iconTint="#10B981"
              />
              <View style={[cardStyles.figSep, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]} />
              <FigCell
                icon="alert-circle-outline"
                label="Due"
                value={`₹${due.toLocaleString('en-IN')}`}
                color={due > 0 ? '#DC2626' : '#059669'}
                sec={textSec}
                iconTint={due > 0 ? '#EF4444' : '#10B981'}
                emphasize={due > 0}
              />
            </View>

            <MiniProgress paid={paid} total={total} isDark={isDark} />
          </View>
        </View>

        <View style={cardStyles.chevronWrap}>
          <View style={[cardStyles.chevronBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)' }]}>
            <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8'} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

function FigCell({
  label, value, color, sec, icon, iconTint, emphasize,
}: {
  label: string; value: string; color: string; sec: string;
  icon: keyof typeof Ionicons.glyphMap; iconTint: string; emphasize?: boolean;
}) {
  return (
    <View style={[cardStyles.figCell, emphasize && cardStyles.figCellEmphasize]}>
      <View style={cardStyles.figLabelRow}>
        <Ionicons name={icon} size={12} color={iconTint} />
        <Text style={[cardStyles.figLabel, { color: sec }]}>{label}</Text>
      </View>
      <Text style={[cardStyles.figValue, { color }, emphasize && cardStyles.figValueEmphasize]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 22,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  statusWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 140,
    height: 140,
    borderBottomLeftRadius: 140,
  },
  accent: { width: 5, alignSelf: 'stretch', zIndex: 2 },
  inner: { flex: 1, paddingVertical: 15, paddingHorizontal: 13, zIndex: 2, gap: 12 },
  innerWide: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  identityCol: { flex: 1 },
  identityColWide: { flex: 1.15, minWidth: 0 },
  financeCol: { gap: 8 },
  financeColWide: { flex: 1, minWidth: 300 },
  financeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  openHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  openHintText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarRing: {
    width: 54, height: 54, borderRadius: 17,
    borderWidth: 2.5, padding: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarWrap: {
    width: '100%', height: '100%', borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  nameBlock: { flex: 1, minWidth: 0, gap: 4 },
  nameTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.25 },
  parentLine: { fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  metaTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1,
  },
  metaTagText: { fontSize: 11, fontWeight: '700' },
  phoneChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 4, paddingLeft: 4, paddingRight: 12, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1, maxWidth: '100%',
  },
  phoneChipMuted: { paddingLeft: 8 },
  phoneIconWrap: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  phoneText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  phoneMutedText: { fontSize: 11, fontWeight: '600' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  figRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, paddingVertical: 11, paddingHorizontal: 6,
  },
  figCell: { flex: 1, alignItems: 'center', paddingHorizontal: 4, gap: 3 },
  figCellEmphasize: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderRadius: 10,
    paddingVertical: 4,
  },
  figLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  figLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  figValue: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  figValueEmphasize: { fontSize: 15 },
  figSep: { width: 1, height: 34 },
  progressBlock: { gap: 5 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  progressPct: { fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  chevronWrap: { justifyContent: 'center', paddingRight: 10, zIndex: 2 },
  chevronBtn: {
    width: 30, height: 30, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Summary Header ───────────────────────────────────────────────────────────
function SummaryHeader({ stats, isDark }: { stats: SummaryStats; isDark: boolean }) {
  const textSec = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.45)';

  const cells = [
    {
      label: 'Collected',
      value: `₹${stats.collectedTotal.toLocaleString('en-IN')}`,
      color: '#059669',
      icon: 'trending-up' as const,
      tint: isDark ? 'rgba(16,185,129,0.16)' : '#D1FAE5',
    },
    {
      label: 'Outstanding',
      value: `₹${stats.pendingDues.toLocaleString('en-IN')}`,
      color: '#DC2626',
      icon: 'alert-circle' as const,
      tint: isDark ? 'rgba(239,68,68,0.16)' : '#FEE2E2',
    },
    {
      label: 'Pending students',
      value: String(stats.pendingStudents),
      color: '#2563EB',
      icon: 'people' as const,
      tint: isDark ? 'rgba(59,130,246,0.16)' : '#DBEAFE',
    },
  ];

  return (
    <Animated.View entering={FadeIn.duration(420)} style={sumStyles.wrap}>
      {cells.map((cell) => (
        <View
          key={cell.label}
          style={[
            sumStyles.tile,
            {
              backgroundColor: isDark ? FEE_UX.clayDark : FEE_UX.clayLight,
              borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.95)',
              borderBottomColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(76,90,120,0.12)',
              shadowColor: isDark ? '#000' : '#6B7A99',
            },
          ]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]} pointerEvents="none">
            <LinearGradient
              colors={isDark
                ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']
                : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.6, y: 0.9 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={[sumStyles.iconWrap, { backgroundColor: cell.tint }]}>
            <Ionicons name={cell.icon} size={16} color={cell.color} />
          </View>
          <Text style={[sumStyles.label, { color: textSec }]}>{cell.label}</Text>
          <Text style={[sumStyles.value, { color: cell.color }]} numberOfLines={1}>{cell.value}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

const sumStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1.5,
    borderBottomWidth: 2.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
    alignItems: 'flex-start',
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    zIndex: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    zIndex: 2,
  },
  value: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
    zIndex: 2,
  },
});

// ─── Filter Pill ──────────────────────────────────────────────────────────────
function FilterPill({
  label, active, count, isDark, onPress,
}: {
  label: FilterType; active: boolean; count: number; isDark: boolean; onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const accent = FILTER_ACCENT[label];

  return (
    <Animated.View style={aStyle}>
      <Pressable
        style={[
          pillStyles.pill,
          active
            ? {
                backgroundColor: accent,
                borderTopWidth: 1.5,
                borderTopColor: 'rgba(255,255,255,0.45)',
                borderBottomWidth: 3,
                borderBottomColor: 'rgba(0,0,0,0.18)',
                shadowColor: accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.28,
                shadowRadius: 8,
                elevation: 4,
              }
            : {
                backgroundColor: isDark ? '#1C1F2A' : FEE_UX.clayLight,
                borderTopWidth: 1.5,
                borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
                borderBottomWidth: 3,
                borderBottomColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(76,90,120,0.1)',
                shadowColor: isDark ? '#000' : '#6B7A99',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.15 : 0.08,
                shadowRadius: 4,
                elevation: 1,
              },
        ]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 16, stiffness: 240 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 240 }); }}
      >
        <View style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden' }]}>
          <LinearGradient
            colors={active
              ? ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']
              : (isDark ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)'])}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.9 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
        {!active ? <View style={[pillStyles.dot, { backgroundColor: accent, zIndex: 2 }]} /> : null}
        <Text style={[pillStyles.label, { color: active ? '#fff' : (isDark ? 'rgba(255,255,255,0.55)' : '#475569'), zIndex: 2 }]}>
          {label}
        </Text>
        {count > 0 && label !== 'All' ? (
          <View style={[pillStyles.badge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)'), zIndex: 2 }]}>
            <Text style={[pillStyles.badgeText, { color: active ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : '#475569') }]}>
              {count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
const pillStyles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, position: 'relative', minHeight: 38 },
  label: { fontSize: 13, fontWeight: '700' },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

const formatDueDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const classBadgeLabel = (className?: string) => {
  const match = (className || '').match(/\d+/);
  return match?.[0] || (className || '?').charAt(0).toUpperCase();
};

const buildParentLine = (gender?: string, fatherName?: string): string | undefined => {
  const name = fatherName?.trim();
  if (!name) return undefined;
  const g = (gender || '').toLowerCase();
  if (g === 'male') return `S/o ${name}`;
  if (g === 'female') return `D/o ${name}`;
  return undefined;
};

const hasActiveStudentFilters = (filters: {
  submittedSearch: string;
  selectedClassId: string | null;
  submittedAdmissionNo: string;
  submittedFatherName: string;
  submittedMobile: string;
  submittedVillage: string;
  activeFilter: FilterType;
}) =>
  filters.activeFilter !== 'All'
  || filters.submittedSearch.length > 0
  || !!filters.selectedClassId
  || filters.submittedAdmissionNo.length > 0
  || filters.submittedFatherName.length > 0
  || filters.submittedMobile.length > 0
  || filters.submittedVillage.length > 0;

/** Narrow enough to query the API — avoids loading the full student roster on open. */
const hasStudentQueryCriteria = (filters: {
  submittedSearch: string;
  selectedClassId: string | null;
  submittedAdmissionNo: string;
  submittedFatherName: string;
  submittedMobile: string;
  submittedVillage: string;
}) =>
  filters.submittedSearch.length > 0
  || !!filters.selectedClassId
  || filters.submittedAdmissionNo.length > 0
  || filters.submittedFatherName.length > 0
  || filters.submittedMobile.length > 0
  || filters.submittedVillage.length > 0;

// ─── Class Structure Card ─────────────────────────────────────────────────────
const ClassStructureCard = React.memo(function ClassStructureCard({
  item, index, isDark,
}: {
  item: ClassFeeStructure; index: number; isDark: boolean;
}) {
  const textPri = isDark ? '#F9FAFB' : '#111827';
  const textSec = isDark ? 'rgba(255,255,255,0.45)' : '#64748B';
  const amount = Number(item.amount) || 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(350).springify()}>
      <View
        style={[
          structureStyles.card,
          {
            backgroundColor: isDark ? '#2A3142' : '#EEF1F8',
            borderTopWidth: 1.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
            borderBottomWidth: 3,
            borderBottomColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(76,90,120,0.18)',
            shadowColor: isDark ? '#000' : '#6B7A99',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.30 : 0.18,
            shadowRadius: 14,
            elevation: 4,
          }
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]}>
          <LinearGradient
            colors={isDark ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        <View style={[structureStyles.classBadge, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }]}>
          <Text style={structureStyles.classBadgeText}>{classBadgeLabel(item.class_name)}</Text>
        </View>

        <View style={structureStyles.infoBlock}>
          <Text style={[structureStyles.title, { color: textPri }]} numberOfLines={1}>
            {item.fee_type} - {item.academic_year}
          </Text>
          <Text style={[structureStyles.subtitle, { color: textSec }]} numberOfLines={1}>
            {item.class_name}
            {item.section_name ? ` · ${item.section_name}` : ''}
            {' · Due '}{formatDueDate(item.due_date)}
          </Text>
        </View>

        <View style={structureStyles.amountBlock}>
          <Text style={structureStyles.amount}>₹{amount.toLocaleString('en-IN')}</Text>
          <Text style={[structureStyles.frequency, { color: textSec }]}>
            {(item.frequency || 'MONTHLY').toUpperCase()}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

const structureStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
    position: 'relative',
  },
  classBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  classBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3B82F6',
  },
  infoBlock: { flex: 1, zIndex: 2 },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 12, fontWeight: '600' },
  amountBlock: { alignItems: 'flex-end', zIndex: 2 },
  amount: { fontSize: 18, fontWeight: '800', color: '#2563EB' },
  frequency: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, marginTop: 2 },
});

// ─── View Mode Pill ───────────────────────────────────────────────────────────
const VIEW_MODE_META: Record<ViewMode, { icon: keyof typeof Ionicons.glyphMap; short: string }> = {
  Students: { icon: 'people-outline', short: 'Students' },
  'Class Structures': { icon: 'layers-outline', short: 'Structures' },
};

function ViewModePill({
  label, active, isDark, onPress,
}: {
  label: ViewMode; active: boolean; isDark: boolean; onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    flex: 1,
  }));
  const meta = VIEW_MODE_META[label];

  return (
    <Animated.View style={aStyle}>
      <Pressable
        style={[
          viewModeStyles.pill,
          active && {
            backgroundColor: isDark ? '#2A3142' : '#FFFFFF',
            borderTopWidth: 1.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
            borderBottomWidth: 3,
            borderBottomColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(76,90,120,0.15)',
            shadowColor: isDark ? '#000' : '#6B7A99',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.25 : 0.12,
            shadowRadius: 8,
            elevation: 3,
          },
        ]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 16, stiffness: 240 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 240 }); }}
      >
        {active && (
          <View style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden' }]}>
            <LinearGradient
              colors={isDark ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.6, y: 0.9 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </View>
        )}
        <Ionicons
          name={meta.icon}
          size={15}
          color={active ? (isDark ? '#FFF' : '#1E293B') : (isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8')}
          style={{ zIndex: 2 }}
        />
        <Text style={[viewModeStyles.label, { color: active ? (isDark ? '#FFF' : '#1E293B') : (isDark ? 'rgba(255,255,255,0.4)' : '#64748B'), zIndex: 2 }]}>
          {meta.short}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const viewModeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
    height: 42,
    position: 'relative',
  },
  label: { fontSize: 13, fontWeight: '800' },
});

function StudentFiltersPanel({
  expanded,
  onToggle,
  isDark,
  classes,
  selectedClassId,
  onSelectClass,
  admissionNo,
  onAdmissionNoChange,
  fatherName,
  onFatherNameChange,
  mobile,
  onMobileChange,
  village,
  onVillageChange,
  onClear,
  onSubmit,
  hasActiveFilters,
}: {
  expanded: boolean;
  onToggle: () => void;
  isDark: boolean;
  classes: ClassInfo[];
  selectedClassId: string | null;
  onSelectClass: (id: string | null) => void;
  admissionNo: string;
  onAdmissionNoChange: (value: string) => void;
  fatherName: string;
  onFatherNameChange: (value: string) => void;
  mobile: string;
  onMobileChange: (value: string) => void;
  village: string;
  onVillageChange: (value: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  hasActiveFilters: boolean;
}) {
  const chipText = isDark ? 'rgba(255,255,255,0.55)' : '#6B7280';

  return (
    <View style={filterPanelStyles.wrap}>
      <Pressable 
        style={[
          filterPanelStyles.toggleRow, 
          { 
            backgroundColor: isDark ? '#1C1F2A' : '#EEF1F8',
            borderTopWidth: 1.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
            borderBottomWidth: 3,
            borderBottomColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(76,90,120,0.15)',
            shadowColor: isDark ? '#000' : '#6B7A99',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.20 : 0.12,
            shadowRadius: 8,
            elevation: 3,
          }
        ]} 
        onPress={onToggle}
      >
        <View style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden' }]}>
          <LinearGradient
            colors={isDark ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        <View style={[filterPanelStyles.toggleLeft, { zIndex: 2 }]}>
          <Ionicons name="options-outline" size={16} color={hasActiveFilters ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.4)' : '#64748B')} />
          <Text style={[filterPanelStyles.toggleText, { color: hasActiveFilters ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.7)' : '#334155') }]}>
            Filters{hasActiveFilters ? ' · active' : ''}
          </Text>
        </View>
        <View style={[filterPanelStyles.toggleRight, { zIndex: 2 }]}>
          {hasActiveFilters ? (
            <Pressable onPress={(e) => { e.stopPropagation?.(); onClear(); }} hitSlop={8}>
              <Text style={filterPanelStyles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={isDark ? 'rgba(255,255,255,0.4)' : '#64748B'} />
        </View>
      </Pressable>

      {expanded ? (
        <Animated.View 
          entering={FadeIn.duration(250)} 
          style={[
            filterPanelStyles.panel, 
            { 
              backgroundColor: isDark ? '#141824' : '#E2E8F0',
              borderRadius: 16,
              marginTop: 10,
              padding: 16,
              borderTopWidth: 1.5,
              borderTopColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)',
            }
          ]}
        >
          <Text style={[filterPanelStyles.label, { color: chipText }]}>CLASS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filterPanelStyles.chipRow}>
            <Pressable
              style={[
                filterPanelStyles.chip,
                {
                  borderRadius: 18,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: !selectedClassId ? '#3B82F6' : (isDark ? '#1C1F2A' : '#EEF1F8'),
                  borderTopWidth: 1.5,
                  borderTopColor: !selectedClassId ? 'rgba(255,255,255,0.45)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)'),
                  borderBottomWidth: 3,
                  borderBottomColor: !selectedClassId ? 'rgba(29,78,216,0.25)' : (isDark ? 'rgba(0,0,0,0.5)' : 'rgba(76,90,120,0.1)'),
                }
              ]}
              onPress={() => onSelectClass(null)}
            >
              <View style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]}>
                <LinearGradient
                  colors={!selectedClassId 
                    ? ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'] 
                    : (isDark ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)'])}
                  start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </View>
              <Text style={[filterPanelStyles.chipText, { color: !selectedClassId ? '#fff' : (isDark ? 'rgba(255,255,255,0.6)' : '#475569'), zIndex: 2 }]}>All</Text>
            </Pressable>
            {classes.map((cls) => {
              const active = selectedClassId === cls.id;
              return (
                <Pressable
                  key={cls.id}
                  style={[
                    filterPanelStyles.chip,
                    {
                      borderRadius: 18,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: active ? '#3B82F6' : (isDark ? '#1C1F2A' : '#EEF1F8'),
                      borderTopWidth: 1.5,
                      borderTopColor: active ? 'rgba(255,255,255,0.45)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)'),
                      borderBottomWidth: 3,
                      borderBottomColor: active ? 'rgba(29,78,216,0.25)' : (isDark ? 'rgba(0,0,0,0.5)' : 'rgba(76,90,120,0.1)'),
                    }
                  ]}
                  onPress={() => onSelectClass(active ? null : cls.id)}
                >
                  <View style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]}>
                    <LinearGradient
                      colors={active 
                        ? ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'] 
                        : (isDark ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)'])}
                      start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  </View>
                  <Text style={[filterPanelStyles.chipText, { color: active ? '#fff' : (isDark ? 'rgba(255,255,255,0.6)' : '#475569'), zIndex: 2 }]}>{cls.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={filterPanelStyles.inputRow}>
            <View style={filterPanelStyles.inputCell}>
              <Text style={[filterPanelStyles.label, { color: chipText }]}>ADMISSION NO</Text>
              <View style={[
                filterPanelStyles.inputFrame,
                {
                  backgroundColor: isDark ? '#2A3142' : '#EEF1F8',
                  borderTopWidth: 1.5,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.85)',
                  borderBottomWidth: 2.5,
                  borderBottomColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(76,90,120,0.15)',
                  shadowColor: isDark ? '#000' : '#6B7A99',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.22 : 0.08,
                  shadowRadius: 5,
                  elevation: 1,
                }
              ]}>
                <View style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: 'hidden' }]}>
                  <LinearGradient
                    colors={isDark ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                </View>
                <AppTextInput
                  style={[
                    filterPanelStyles.input, 
                    { 
                      backgroundColor: isDark ? '#0A0B12' : '#D5E0ED', 
                      color: isDark ? '#F9FAFB' : '#111827', 
                      borderWidth: 0,
                      borderTopWidth: 1.5,
                      borderTopColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                      borderRadius: 10,
                      height: 38,
                      zIndex: 2,
                    }
                  ]}
                  placeholder="Exact or prefix"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'}
                  value={admissionNo}
                  onChangeText={onAdmissionNoChange}
                  returnKeyType="search"
                  onSubmitEditing={onSubmit}
                />
              </View>
            </View>
            <View style={filterPanelStyles.inputCell}>
              <Text style={[filterPanelStyles.label, { color: chipText }]}>FATHER / GUARDIAN</Text>
              <View style={[
                filterPanelStyles.inputFrame,
                {
                  backgroundColor: isDark ? '#2A3142' : '#EEF1F8',
                  borderTopWidth: 1.5,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.85)',
                  borderBottomWidth: 2.5,
                  borderBottomColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(76,90,120,0.15)',
                  shadowColor: isDark ? '#000' : '#6B7A99',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.22 : 0.08,
                  shadowRadius: 5,
                  elevation: 1,
                }
              ]}>
                <View style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: 'hidden' }]}>
                  <LinearGradient
                    colors={isDark ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                </View>
                <AppTextInput
                  style={[
                    filterPanelStyles.input, 
                    { 
                      backgroundColor: isDark ? '#0A0B12' : '#D5E0ED', 
                      color: isDark ? '#F9FAFB' : '#111827', 
                      borderWidth: 0,
                      borderTopWidth: 1.5,
                      borderTopColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                      borderRadius: 10,
                      height: 38,
                      zIndex: 2,
                    }
                  ]}
                  placeholder="Parent name"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'}
                  value={fatherName}
                  onChangeText={onFatherNameChange}
                  returnKeyType="search"
                  onSubmitEditing={onSubmit}
                />
              </View>
            </View>
          </View>

          <View style={filterPanelStyles.inputRow}>
            <View style={filterPanelStyles.inputCell}>
              <Text style={[filterPanelStyles.label, { color: chipText }]}>MOBILE</Text>
              <View style={[
                filterPanelStyles.inputFrame,
                {
                  backgroundColor: isDark ? '#2A3142' : '#EEF1F8',
                  borderTopWidth: 1.5,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.85)',
                  borderBottomWidth: 2.5,
                  borderBottomColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(76,90,120,0.15)',
                  shadowColor: isDark ? '#000' : '#6B7A99',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.22 : 0.08,
                  shadowRadius: 5,
                  elevation: 1,
                }
              ]}>
                <View style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: 'hidden' }]}>
                  <LinearGradient
                    colors={isDark ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                </View>
                <AppTextInput
                  style={[
                    filterPanelStyles.input,
                    {
                      backgroundColor: isDark ? '#0A0B12' : '#D5E0ED',
                      color: isDark ? '#F9FAFB' : '#111827',
                      borderWidth: 0,
                      borderTopWidth: 1.5,
                      borderTopColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                      borderRadius: 10,
                      height: 38,
                      zIndex: 2,
                    }
                  ]}
                  placeholder="Parent phone number"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'}
                  value={mobile}
                  onChangeText={onMobileChange}
                  keyboardType="phone-pad"
                  returnKeyType="search"
                  onSubmitEditing={onSubmit}
                />
              </View>
            </View>
            <View style={filterPanelStyles.inputCell}>
              <Text style={[filterPanelStyles.label, { color: chipText }]}>VILLAGE</Text>
              <View style={[
                filterPanelStyles.inputFrame,
                {
                  backgroundColor: isDark ? '#2A3142' : '#EEF1F8',
                  borderTopWidth: 1.5,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.85)',
                  borderBottomWidth: 2.5,
                  borderBottomColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(76,90,120,0.15)',
                  shadowColor: isDark ? '#000' : '#6B7A99',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.22 : 0.08,
                  shadowRadius: 5,
                  elevation: 1,
                }
              ]}>
                <View style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: 'hidden' }]}>
                  <LinearGradient
                    colors={isDark ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                </View>
                <AppTextInput
                  style={[
                    filterPanelStyles.input,
                    {
                      backgroundColor: isDark ? '#0A0B12' : '#D5E0ED',
                      color: isDark ? '#F9FAFB' : '#111827',
                      borderWidth: 0,
                      borderTopWidth: 1.5,
                      borderTopColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                      borderRadius: 10,
                      height: 38,
                      zIndex: 2,
                    }
                  ]}
                  placeholder="Transport stop / village"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'}
                  value={village}
                  onChangeText={onVillageChange}
                  returnKeyType="search"
                  onSubmitEditing={onSubmit}
                />
              </View>
            </View>
          </View>

          <Pressable 
            style={[
              filterPanelStyles.searchButton,
              {
                backgroundColor: '#3B82F6',
                borderTopWidth: 1.5,
                borderTopColor: 'rgba(255,255,255,0.45)',
                borderBottomWidth: 3.5,
                borderBottomColor: 'rgba(29,78,216,0.25)',
                shadowColor: '#3B82F6',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                elevation: 4,
                borderRadius: 12,
                height: 44,
                marginTop: 6,
              }
            ]} 
            onPress={onSubmit}
          >
            <View style={[StyleSheet.absoluteFill, { borderRadius: 12, overflow: 'hidden' }]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </View>
            <Ionicons name="search" size={15} color="#fff" style={{ zIndex: 2 }} />
            <Text style={[filterPanelStyles.searchButtonText, { zIndex: 2 }]}>Search students</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const filterPanelStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginBottom: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleText: { fontSize: 13, fontWeight: '800' },
  clearText: { fontSize: 12, fontWeight: '800', color: '#3B82F6' },
  panel: {
    marginTop: 8,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 0,
    position: 'relative',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputCell: { flex: 1, gap: 6 },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    position: 'relative',
  },
  searchButtonText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  inputFrame: {
    borderRadius: 14,
    padding: 4,
    position: 'relative',
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    fontSize: 14,
    fontWeight: '500',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AccountsFees() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { shellActive } = useAccountsWebChrome();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [admissionNoInput, setAdmissionNoInput] = useState('');
  const [submittedAdmissionNo, setSubmittedAdmissionNo] = useState('');
  const [fatherNameInput, setFatherNameInput] = useState('');
  const [submittedFatherName, setSubmittedFatherName] = useState('');
  const [mobileInput, setMobileInput] = useState('');
  const [submittedMobile, setSubmittedMobile] = useState('');
  const [villageInput, setVillageInput] = useState('');
  const [submittedVillage, setSubmittedVillage] = useState('');
  const [activeView, setActiveView] = useState<ViewMode>('Students');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [structuresLoading, setStructuresLoading] = useState(true);
  const [students, setStudents] = useState<FeeListStudent[]>([]);
  const [structures, setStructures] = useState<ClassFeeStructure[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [searchFocused, setSearchFocused] = useState(false);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [meta, setMeta] = useState<FeeSummaryMeta>({
    total: 0,
    page: 1,
    limit: PAGE_LIMIT,
    total_pages: 1,
    counts: EMPTY_COUNTS,
  });
  const requestIdRef = useRef(0);

  const { data: statsPayload, refetch: refetchStats } = useApiQuery<any>(
    '/fees/dashboard-stats',
    'accounts-fees-stats',
    CACHE_TTL_MS,
    user?.id,
    { query: { for_accounts: '1' } }
  );

  const { data: structuresPayload, loading: structuresQueryLoading, refetch: refetchStructures } = useApiQuery<any[]>(
    '/fees/structure',
    'accounts-fees-structures',
    CACHE_TTL_MS,
    user?.id
  );

  const mapFeeSummary = useCallback((d: any): FeeListStudent => {
    const fatherName = d.father_name || '';
    const fatherMobile = d.father_mobile || '';
    const studentGender = d.student_gender || '';
    return {
      id: d.student_id,
      name: d.student_name,
      admissionNo: d.admission_no || '',
      class: d.class_name || '',
      fatherName,
      fatherMobile,
      studentGender,
      parentLine: buildParentLine(studentGender, fatherName),
      photoUrl: d.photo_url || '',
      status: d.status,
      total: d.total_amount,
      paid: d.paid_amount,
      due: d.due_amount,
      rawId: `${d.student_id}_${d.class_name || ''}`,
    };
  }, []);

  const mapStructure = useCallback((item: any): ClassFeeStructure => ({
    id: String(item.id),
    class_name: item.class_name || '—',
    section_name: item.section_name || undefined,
    fee_type: item.fee_type || 'Fee',
    academic_year: item.academic_year || '—',
    amount: Number(item.amount) || 0,
    due_date: item.due_date,
    frequency: item.frequency,
  }), []);

  useEffect(() => {
    if (!statsPayload) return;
    const stats = statsPayload.stats || statsPayload;
    setSummaryStats({
      collectedTotal: Number(stats.collected_total || 0),
      pendingDues: Number(stats.pending_dues || 0),
      pendingStudents: Number(stats.defaulter_count || 0),
    });
  }, [statsPayload]);

  useEffect(() => {
    if (!structuresPayload) return;
    const payload = structuresPayload as any;
    const rows = Array.isArray(payload)
      ? payload
      : payload?.structures ?? payload?.data ?? [];
    setStructures((Array.isArray(rows) ? rows : []).map(mapStructure));
    setStructuresLoading(false);
  }, [mapStructure, structuresPayload]);

  useEffect(() => {
    if (structuresQueryLoading && !structuresPayload) setStructuresLoading(true);
  }, [structuresQueryLoading, structuresPayload]);

  const loadData = useCallback(async ({
    nextPage = 1,
    append = false,
    isRefreshing = false,
  }: {
    nextPage?: number;
    append?: boolean;
    isRefreshing?: boolean;
  } = {}) => {
    if (!user) return;

    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true);
    else if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await FeeService.getStudentFeeSummaries({
        page: nextPage,
        limit: PAGE_LIMIT,
        search: submittedSearch || undefined,
        class_id: selectedClassId || undefined,
        admission_no: submittedAdmissionNo || undefined,
        father_name: submittedFatherName || undefined,
        mobile: submittedMobile || undefined,
        village: submittedVillage || undefined,
        status: activeFilter === 'All' ? undefined : activeFilter,
      });

      if (requestId !== requestIdRef.current) return;

      const mapped = response.data.map(mapFeeSummary);
      setStudents((prev) => {
        if (!append) return mapped;
        const seen = new Set(prev.map((student) => student.rawId));
        return [...prev, ...mapped.filter((student) => !seen.has(student.rawId))];
      });
      setMeta({
        total: response.meta?.total ?? mapped.length,
        page: response.meta?.page ?? nextPage,
        limit: response.meta?.limit ?? PAGE_LIMIT,
        total_pages: response.meta?.total_pages ?? 1,
        counts: { ...EMPTY_COUNTS, ...(response.meta?.counts || {}) },
      });
    } catch {
      if (requestId === requestIdRef.current && !append) {
        setStudents([]);
        setMeta({
          total: 0,
          page: 1,
          limit: PAGE_LIMIT,
          total_pages: 1,
          counts: EMPTY_COUNTS,
        });
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [
    activeFilter,
    submittedAdmissionNo,
    submittedFatherName,
    submittedMobile,
    submittedSearch,
    submittedVillage,
    mapFeeSummary,
    selectedClassId,
    user,
  ]);

  useEffect(() => {
    ClassService.getClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  // Free-text filters commit only on Enter / the Search button — typing alone
  // never fires a request. React batches the setters, so one submit triggers
  // at most one fetch via the load effect below.
  const commitStudentSearch = useCallback(() => {
    const query = searchQuery.trim();
    setSubmittedSearch(query.length >= 2 ? query : '');
    setSubmittedAdmissionNo(admissionNoInput.trim());
    const father = fatherNameInput.trim();
    setSubmittedFatherName(father.length >= 2 ? father : '');
    const digits = mobileInput.trim().replace(/\D/g, '');
    setSubmittedMobile(digits.length >= 3 ? digits : '');
    const village = villageInput.trim();
    setSubmittedVillage(village.length >= 2 ? village : '');
    setFiltersExpanded(false);
  }, [admissionNoInput, fatherNameInput, mobileInput, searchQuery, villageInput]);

  // Class Structures view filters locally on searchQuery, so submit only
  // matters for the Students view.
  const handleSearchSubmit = useCallback(() => {
    if (activeView === 'Students') commitStudentSearch();
  }, [activeView, commitStudentSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSubmittedSearch('');
  }, []);

  const studentFiltersActive = hasActiveStudentFilters({
    submittedSearch,
    selectedClassId,
    submittedAdmissionNo,
    submittedFatherName,
    submittedMobile,
    submittedVillage,
    activeFilter,
  });

  const studentQueryReady = hasStudentQueryCriteria({
    submittedSearch,
    selectedClassId,
    submittedAdmissionNo,
    submittedFatherName,
    submittedMobile,
    submittedVillage,
  });

  const clearStudentFilters = useCallback(() => {
    setSelectedClassId(null);
    setAdmissionNoInput('');
    setSubmittedAdmissionNo('');
    setFatherNameInput('');
    setSubmittedFatherName('');
    setMobileInput('');
    setSubmittedMobile('');
    setVillageInput('');
    setSubmittedVillage('');
    setSearchQuery('');
    setSubmittedSearch('');
    setActiveFilter('All');
    setFiltersExpanded(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (activeView !== 'Students') return;

    if (!studentQueryReady) {
      requestIdRef.current += 1;
      setStudents([]);
      setMeta({
        total: 0,
        page: 1,
        limit: PAGE_LIMIT,
        total_pages: 1,
        counts: EMPTY_COUNTS,
      });
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    loadData({ nextPage: 1 });
  }, [
    activeFilter,
    activeView,
    submittedAdmissionNo,
    submittedFatherName,
    submittedMobile,
    submittedSearch,
    loadData,
    selectedClassId,
    studentQueryReady,
    user,
  ]);

  const filterCounts = meta.counts;

  const filteredStructures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return structures;
    return structures.filter((item) => {
      const haystack = [
        item.class_name,
        item.section_name,
        item.fee_type,
        item.academic_year,
        item.frequency,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery, structures]);

  const handleViewLedger = useCallback((student: any) => {
    router.push({
      pathname: '/accounts/fees/details' as any,
      params: {
        studentId: student.id,
        name: student.name,
        fatherName: student.fatherName,
        fatherMobile: student.fatherMobile,
      },
    });
  }, [router]);

  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter);
  }, []);

  const handleRefresh = useCallback(() => {
    void refetchStats();
    void refetchStructures();
    if (activeView === 'Students') {
      if (studentQueryReady) {
        loadData({ nextPage: 1, isRefreshing: true });
      } else {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 400);
      }
    } else {
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 400);
    }
  }, [activeView, loadData, refetchStats, refetchStructures, studentQueryReady]);

  const hasMore = meta.page < meta.total_pages;

  const handleEndReached = useCallback(() => {
    if (!studentQueryReady || loading || loadingMore || refreshing || !hasMore) return;
    loadData({ nextPage: meta.page + 1, append: true });
  }, [hasMore, loadData, loading, loadingMore, meta.page, refreshing, studentQueryReady]);

  const renderStudentItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <StudentCard
      item={item}
      index={index}
      isDark={isDark}
      onPress={() => handleViewLedger(item)}
    />
  ), [isDark, handleViewLedger]);

  const renderStructureItem = useCallback(({ item, index }: { item: ClassFeeStructure; index: number }) => (
    <ClassStructureCard item={item} index={index} isDark={isDark} />
  ), [isDark]);

  const ListHeader = useMemo(() => (
    <>
      {!loading && summaryStats && (
        <SummaryHeader stats={summaryStats} isDark={isDark} />
      )}

      <View style={styles.viewModeRow}>
        {VIEW_MODES.map((mode) => (
          <ViewModePill
            key={mode}
            label={mode}
            active={activeView === mode}
            isDark={isDark}
            onPress={() => setActiveView(mode)}
          />
        ))}
      </View>

      {activeView === 'Students' ? (
        <>
          <StudentFiltersPanel
            expanded={filtersExpanded}
            onToggle={() => setFiltersExpanded((prev) => !prev)}
            isDark={isDark}
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClass={setSelectedClassId}
            admissionNo={admissionNoInput}
            onAdmissionNoChange={setAdmissionNoInput}
            fatherName={fatherNameInput}
            onFatherNameChange={setFatherNameInput}
            mobile={mobileInput}
            onMobileChange={setMobileInput}
            village={villageInput}
            onVillageChange={setVillageInput}
            onClear={clearStudentFilters}
            onSubmit={commitStudentSearch}
            hasActiveFilters={studentFiltersActive}
          />

          <View style={styles.filterRow}>
            {FILTERS.map(f => (
              <FilterPill
                key={f}
                label={f}
                active={activeFilter === f}
                count={filterCounts[f]}
                isDark={isDark}
                onPress={() => handleFilterChange(f)}
              />
            ))}
          </View>

          {!loading && studentQueryReady && (
            <Animated.View entering={FadeIn.duration(280)} style={styles.resultsBar}>
              <View style={styles.resultsLeft}>
                <View style={[styles.resultsIcon, { backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : '#DBEAFE' }]}>
                  <Ionicons name="people" size={13} color="#2563EB" />
                </View>
                <Text style={styles.resultsCount}>
                  {meta.total} student{meta.total !== 1 ? 's' : ''}
                  {activeFilter !== 'All' ? ` · ${activeFilter}` : ''}
                </Text>
              </View>
              <Text style={styles.resultsHint} numberOfLines={1}>
                {[
                  submittedSearch ? `"${submittedSearch}"` : null,
                  selectedClassId ? (classes.find((c) => c.id === selectedClassId)?.name || 'Class') : null,
                  submittedAdmissionNo ? `Adm ${submittedAdmissionNo}` : null,
                  submittedFatherName || null,
                  submittedMobile || null,
                  submittedVillage || null,
                ].filter(Boolean).join(' · ') || 'Tap a card to open ledger'}
              </Text>
            </Animated.View>
          )}
        </>
      ) : (
        !structuresLoading && (
          <Animated.View entering={FadeIn.duration(280)} style={styles.resultsBar}>
            <View style={styles.resultsLeft}>
              <View style={[styles.resultsIcon, { backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : '#DBEAFE' }]}>
                <Ionicons name="layers" size={13} color="#2563EB" />
              </View>
              <Text style={styles.resultsCount}>
                {filteredStructures.length} structure{filteredStructures.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.resultsHint} numberOfLines={1}>
              {searchQuery.trim() ? `"${searchQuery.trim()}"` : 'Class fee setup overview'}
            </Text>
          </Animated.View>
        )
      )}
    </>
  ), [
    activeFilter,
    activeView,
    admissionNoInput,
    classes,
    clearStudentFilters,
    commitStudentSearch,
    submittedAdmissionNo,
    submittedFatherName,
    submittedMobile,
    submittedSearch,
    submittedVillage,
    filterCounts,
    filteredStructures.length,
    filtersExpanded,
    fatherNameInput,
    handleFilterChange,
    isDark,
    loading,
    meta.total,
    mobileInput,
    searchQuery,
    selectedClassId,
    studentFiltersActive,
    studentQueryReady,
    structuresLoading,
    styles.filterRow,
    styles.resultsBar,
    styles.resultsCount,
    styles.resultsHint,
    styles.resultsIcon,
    styles.resultsLeft,
    styles.viewModeRow,
    summaryStats,
    villageInput,
  ]);

  const ListFooter = useMemo(() => (
    loadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator color="#3B82F6" />
      </View>
    ) : null
  ), [loadingMore, styles.footerLoader]);

  const EmptyState = useMemo(() => {
    if (activeView === 'Class Structures') {
      const hasQuery = searchQuery.trim().length > 0;
      return (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : '#DBEAFE' }]}>
            <Ionicons name="layers-outline" size={28} color="#2563EB" />
          </View>
          <Text style={styles.emptyTitle}>
            {hasQuery ? 'No class fee structures found' : 'No class fee structures yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {hasQuery
              ? 'Try a different class, fee type, or academic year'
              : 'Ask an admin to configure class fees under Admin → Fee Setup'}
          </Text>
        </View>
      );
    }

    const hasQuery = studentQueryReady;
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : '#DBEAFE' }]}>
          <Ionicons name={hasQuery ? 'search-outline' : 'school-outline'} size={28} color="#2563EB" />
        </View>
        <Text style={styles.emptyTitle}>
          {hasQuery ? 'No students found' : 'Find a student to collect fees'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {hasQuery
            ? 'Try different filters, or clear them and search again'
            : 'Search by name, admission no, parent phone, or village — then press Enter or Search'}
        </Text>
        {!hasQuery ? (
          <View style={styles.emptyTips}>
            {[
              { icon: 'person-outline' as const, text: 'Student name' },
              { icon: 'call-outline' as const, text: 'Parent mobile' },
              { icon: 'home-outline' as const, text: 'Village / stop' },
            ].map((tip) => (
              <View key={tip.text} style={[styles.emptyTip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)' }]}>
                <Ionicons name={tip.icon} size={13} color={isDark ? '#93C5FD' : '#2563EB'} />
                <Text style={[styles.emptyTipText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#475569' }]}>{tip.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }, [activeView, isDark, searchQuery, studentQueryReady, styles.emptyIconWrap, styles.emptySubtitle, styles.emptyTip, styles.emptyTipText, styles.emptyTips, styles.emptyTitle, styles.emptyWrap]);

  const isListLoading = activeView === 'Students'
    ? loading && studentQueryReady && students.length === 0
    : structuresLoading;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isDark ? '#0F1117' : '#1E293B'}
      />
      {!shellActive && <AdminHeader title="Fee Management" showBackButton />}

      {/* Search bar */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.searchWrapFrame, searchFocused && styles.searchWrapFrameFocused]}
      >
        <View style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]}>
          <LinearGradient
            colors={isDark ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.9 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        <View style={[styles.searchRecessedWell, searchFocused && styles.searchRecessedWellFocused]}>
          <Ionicons
            name="search"
            size={18}
            color={searchFocused ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.45)' : '#64748B')}
            style={{ zIndex: 2 }}
          />
          <AppTextInput
            style={[ds.inputInChrome, styles.searchInput, { zIndex: 2 }]}
            placeholder={activeView === 'Students'
              ? 'Search name, ID, phone…'
              : 'Search class, fee type or year…'}
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            blurOnSubmit={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={{ zIndex: 2 }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={isDark ? 'rgba(255,255,255,0.4)' : '#64748B'} />
            </TouchableOpacity>
          )}
          {activeView === 'Students' ? (
            <TouchableOpacity
              onPress={handleSearchSubmit}
              style={styles.searchAction}
              activeOpacity={0.85}
            >
              <Text style={styles.searchActionText}>Search</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {isListLoading ? (
        <View style={styles.loadingWrap}>
          <LogoLoader size={52} color="#3B82F6" />
          <Text style={styles.loadingText}>
            {activeView === 'Students' ? 'Loading fee data…' : 'Loading class fee structures…'}
          </Text>
        </View>
      ) : activeView === 'Students' ? (
        <FlatList
          data={students}
          keyExtractor={(item) => `${item.id}_${item.rawId}`}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={EmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.45}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={10}
        />
      ) : (
        <FlatList
          data={filteredStructures}
          keyExtractor={(item) => item.id}
          renderItem={renderStructureItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={EmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={10}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? FEE_UX.pageBgDark : FEE_UX.pageBgLight,
  },

  // Search
  searchWrapFrame: {
    backgroundColor: isDark ? '#2A3142' : FEE_UX.clayLight,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 24,
    borderTopWidth: 1.5,
    borderTopColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
    borderBottomWidth: 3,
    borderBottomColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(76,90,120,0.18)',
    shadowColor: isDark ? '#000' : '#6B7A99',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.25 : 0.15,
    shadowRadius: 12,
    elevation: 3,
    padding: 4,
    position: 'relative',
  },
  searchWrapFrameFocused: {
    backgroundColor: isDark ? '#2D3547' : '#EAF2FF',
  },
  searchRecessedWell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: isDark ? '#0A0B12' : '#D5E0ED',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 20,
    borderWidth: 0,
    borderTopWidth: 1.5,
    borderTopColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
    zIndex: 2,
  },
  searchRecessedWellFocused: {
    backgroundColor: isDark ? '#08090E' : '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: isDark ? '#F9FAFB' : '#111827',
  },
  searchAction: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  searchActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  viewModeRow: {
    flexDirection: 'row',
    padding: 4,
    marginHorizontal: 16,
    backgroundColor: isDark ? '#141824' : '#DDE3EE',
    borderRadius: 20,
    marginTop: 2,
    marginBottom: 12,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Results count
  resultsBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(76,90,120,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  resultsIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '800',
    color: isDark ? 'rgba(255,255,255,0.72)' : '#334155',
    letterSpacing: -0.1,
  },
  resultsHint: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
    color: isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  footerLoader: {
    paddingVertical: 18,
    alignItems: 'center',
  },

  // Loading
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 12,
    backgroundColor: isDark ? '#1C1F2A' : FEE_UX.clayLight,
    borderTopWidth: 1.5,
    borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
    borderBottomWidth: 3,
    borderBottomColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(76,90,120,0.15)',
    shadowColor: isDark ? '#000' : '#6B7A99',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.20 : 0.10,
    shadowRadius: 12,
    elevation: 2,
    gap: 10,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: isDark ? 'rgba(255,255,255,0.72)' : '#1E293B',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: isDark ? 'rgba(255,255,255,0.35)' : '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 340,
  },
  emptyTips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  emptyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  emptyTipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
