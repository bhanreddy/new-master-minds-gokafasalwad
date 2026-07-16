import React, { useState, useEffect, useRef } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Switch, ScrollView, Platform,
  Animated as RNAnimated
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { NoticeService, Notice, CreateNoticeRequest } from '../../src/services/commonServices';
import { ClassService, ClassInfo } from '../../src/services/classService';
import { Modal } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import { useTranslation } from 'react-i18next';
import { t_field } from '../../src/utils/lang';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const PINK = '#EC4899';
const PINK_LT = '#FDF2F8';
const PINK_MD = '#FCE7F3';
const PINK_BD = '#F9A8D4';

const PRIORITY_META = {
  high: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444', icon: 'alert-circle', label: 'HIGH' },
  medium: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', dot: '#F59E0B', icon: 'warning', label: 'MEDIUM' },
  low: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6', icon: 'information', label: 'LOW' },
  normal: { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB', dot: '#9CA3AF', icon: 'remove-circle', label: 'NORMAL' },
};

const AUDIENCE_META: Record<string, { icon: string; color: string; bg: string; lib: 'ion' | 'fa5' }> = {
  all: { icon: 'globe-outline', color: '#8B5CF6', bg: '#EDE9FE', lib: 'ion' },
  students: { icon: 'graduation-cap', color: '#3B82F6', bg: '#DBEAFE', lib: 'fa5' },
  staff: { icon: 'briefcase-outline', color: '#F59E0B', bg: '#FEF3C7', lib: 'ion' },
  parents: { icon: 'people-outline', color: '#10B981', bg: '#D1FAE5', lib: 'ion' },
  class: { icon: 'layers-outline', color: '#EC4899', bg: '#FCE7F3', lib: 'ion' },
};

// Pulsing dot for priority/pinned
const PulseDot = ({ color, size = 6 }: { color: string; size?: number }) => {
  const scale = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scale, { toValue: 1.9, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: size + 4, height: size + 4, justifyContent: 'center', alignItems: 'center' }}>
      <RNAnimated.View style={{
        position: 'absolute',
        width: size + 4, height: size + 4,
        borderRadius: (size + 4) / 2,
        backgroundColor: color, opacity: 0.22,
        transform: [{ scale }],
      }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
};

// Audience icon helper
const AudienceIcon = ({ type, size = 12, color }: { type: string; size?: number; color: string }) => {
  const m = AUDIENCE_META[type] ?? AUDIENCE_META.all;
  if (m.lib === 'fa5') return <FontAwesome5 name={m.icon} size={size} color={color} />;
  return <Ionicons name={m.icon as any} size={size} color={color} />;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminNotices() {
  useTranslation(); // Subscribe so list rows re-render when language changes (t_field).
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Create Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<'all' | 'students' | 'staff' | 'parents' | 'class'>('all');
  const [priority, setPriority] = useState('medium');
  const [targetClassId, setTargetClassId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [creating, setCreating] = useState(false);

  // FAB animation
  const fabScale = useRef(new RNAnimated.Value(1)).current;
  const onFabIn = () => RNAnimated.spring(fabScale, { toValue: 0.91, useNativeDriver: true }).start();
  const onFabOut = () => RNAnimated.spring(fabScale, { toValue: 1, useNativeDriver: true }).start();

  useEffect(() => { fetchNotices(); fetchClasses(); }, []);

  const fetchClasses = async () => {
    try { setClasses(await ClassService.getClasses()); } catch { }
  };

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setNotices(await NoticeService.getAll());
    } catch {
      alertCompat('Error', 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${Math.floor(seconds)}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
  };

  const filteredNotices = notices.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: pinned first
  const sortedNotices = [...filteredNotices].sort((a, b) =>
    (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)
  );

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) { alertCompat('Error', 'Title and Content are required'); return; }
    if (audience === 'class' && !targetClassId) { alertCompat('Error', 'Please select a target class'); return; }
    try {
      setCreating(true);
      const payload: CreateNoticeRequest = {
        title, content, audience, priority,
        is_pinned: isPinned,
        target_class_id: audience === 'class' ? targetClassId : undefined,
      };
      await NoticeService.create(payload);
      alertCompat('Success', 'Notice published successfully');
      setModalVisible(false);
      resetForm();
      fetchNotices();
    } catch (error: any) {
      alertCompat('Error', error.response?.data?.error || 'Failed to create notice');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setContent(''); setAudience('all');
    setPriority('medium'); setTargetClassId(''); setIsPinned(false);
  };

  // Stats
  const pinnedCount = notices.filter(n => n.is_pinned).length;
  const highCount = notices.filter(n => (n.priority || '').toLowerCase() === 'high').length;

  // ── RENDER ITEM ──────────────────────────────────────────────────────────
  const renderItem = ({ item, index }: { item: Notice; index: number }) => {
    const pKey = (item.priority || 'normal').toLowerCase() as keyof typeof PRIORITY_META;
    const pm = PRIORITY_META[pKey] ?? PRIORITY_META.normal;
    const am = AUDIENCE_META[item.audience] ?? AUDIENCE_META.all;
    const pinned = !!item.is_pinned;

    return (
      <Animated.View entering={FadeInDown.delay(index * 70).duration(480).springify().damping(14)}>
        <TouchableOpacity style={[styles.card, pinned && styles.cardPinned]} activeOpacity={0.8}>

          {/* Priority accent stripe */}
          <View style={[styles.cardStripe, { backgroundColor: pm.dot }]} />

          <View style={styles.cardInner}>
            {/* Top row: title + priority badge */}
            <View style={styles.cardTop}>
              <View style={styles.titleRow}>
                {pinned && (
                  <View style={styles.pinBadge}>
                    <Ionicons name="pin" size={10} color={PINK} />
                    <Text style={styles.pinText}>PINNED</Text>
                  </View>
                )}
                <Text style={[styles.cardTitle, pinned && styles.cardTitlePinned]} numberOfLines={2}>
                  {t_field(item.title, item.title_te)}
                </Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: pm.bg, borderColor: pm.border }]}>
                <PulseDot color={pm.dot} size={5} />
                <Text style={[styles.priorityText, { color: pm.text }]}>{pm.label}</Text>
              </View>
            </View>

            {/* Content preview */}
            <Text style={styles.cardContent} numberOfLines={2}>{t_field(item.content, item.content_te)}</Text>

            {/* Footer: audience + time */}
            <View style={styles.cardFooter}>
              <View style={[styles.audiencePill, { backgroundColor: am.bg }]}>
                <AudienceIcon type={item.audience} size={11} color={am.color} />
                <Text style={[styles.audienceText, { color: am.color }]}>
                  {item.audience.charAt(0).toUpperCase() + item.audience.slice(1)}
                </Text>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={11} color={theme.colors.textTertiary} style={{ marginRight: 3 }} />
                <Text style={styles.dateText}>{formatTimeAgo(item.published_at || item.created_at)}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <AdminHeader title="Notice Board" showBackButton={true} />

      {/* ── SEARCH ── */}
      <View style={[styles.searchContainer, ds.searchBarWrapper, searchFocused && styles.searchFocused]}>
        <Ionicons
          name="search-outline" size={17}
          color={searchFocused ? PINK : '#9CA3AF'}
          style={styles.searchIcon}
        />
        <AppTextInput
          style={[ds.inputInChrome, styles.searchInput]}
          placeholder="Search notices..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Ionicons name="close" size={13} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── STATS STRIP ── */}
      {!loading && notices.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.statsStrip}>
          <View style={styles.statChip}>
            <Text style={styles.statNumber}>{notices.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.statChip, { borderLeftColor: PINK }]}>
            <Text style={[styles.statNumber, { color: PINK }]}>{pinnedCount}</Text>
            <Text style={styles.statLabel}>Pinned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.statChip, { borderLeftColor: '#EF4444' }]}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>{highCount}</Text>
            <Text style={styles.statLabel}>High Priority</Text>
          </View>
        </Animated.View>
      )}

      {/* ── LIST ── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <LogoLoader size={56} color={PINK} />
          <Text style={styles.loadingText}>Loading notices...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedNotices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchNotices}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Animated.View entering={ZoomIn.duration(400)} style={styles.emptyIconWrap}>
                <Ionicons name="megaphone-outline" size={30} color="#F9A8D4" />
              </Animated.View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No Results Found' : 'No Notices Yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `Nothing matched "${searchQuery}"`
                  : 'Tap the button below to post your first notice'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── FAB ── */}
      <RNAnimated.View style={[styles.fabWrapper, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          onPressIn={onFabIn}
          onPressOut={onFabOut}
          activeOpacity={1}
        >
          <Ionicons name="megaphone-outline" size={20} color="#fff" />
          <Text style={styles.fabLabel}>Post Notice</Text>
        </TouchableOpacity>
      </RNAnimated.View>

      {/* ══════════════════════════════════════════════════════════
          CREATE MODAL — Bottom Sheet
      ══════════════════════════════════════════════════════════ */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View entering={FadeInUp.duration(320).springify()} style={styles.sheetContent}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View style={styles.sheetIconBadge}>
                  <Ionicons name="megaphone-outline" size={16} color={PINK} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Post a Notice</Text>
                  <Text style={styles.sheetSubtitle}>Broadcast to your audience</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>

              {/* Section: Content */}
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: PINK }]} />
                <Text style={styles.sectionTitle}>CONTENT</Text>
              </View>

              <Text style={styles.label}>TITLE</Text>
              <AppTextInput
                style={styles.input}
                placeholder="Notice headline..."
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>BODY</Text>
              <AppTextInput
                style={[styles.input, styles.textArea]}
                placeholder="Write the full notice details..."
                placeholderTextColor="#9CA3AF"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Section: Targeting */}
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.sectionTitle}>TARGETING</Text>
              </View>

              <Text style={styles.label}>AUDIENCE</Text>
              <View style={styles.pillGrid}>
                {(['all', 'students', 'staff', 'parents', 'class'] as const).map((a) => {
                  const am = AUDIENCE_META[a];
                  const active = audience === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[styles.audienceChip, active && { backgroundColor: am.bg, borderColor: am.color }]}
                      onPress={() => setAudience(a)}
                    >
                      <AudienceIcon type={a} size={12} color={active ? am.color : '#9CA3AF'} />
                      <Text style={[styles.chipText, active && { color: am.color, fontWeight: '700' }]}>
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {audience === 'class' && (
                <Animated.View entering={FadeInDown.duration(300)}>
                  <Text style={styles.label}>SELECT CLASS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classRow}>
                    {classes.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.classChip, targetClassId === c.id && styles.classChipActive]}
                        onPress={() => setTargetClassId(c.id)}
                      >
                        <Text style={[styles.classChipText, targetClassId === c.id && styles.classChipTextActive]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </Animated.View>
              )}

              {/* Section: Settings */}
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.sectionTitle}>SETTINGS</Text>
              </View>

              <Text style={styles.label}>PRIORITY</Text>
              <View style={styles.priorityGrid}>
                {(['low', 'medium', 'high'] as const).map((p) => {
                  const pm = PRIORITY_META[p];
                  const active = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.priorityChip, active && { backgroundColor: pm.bg, borderColor: pm.dot }]}
                      onPress={() => setPriority(p)}
                    >
                      <PulseDot color={active ? pm.dot : '#D1D5DB'} size={5} />
                      <Text style={[styles.chipText, active && { color: pm.text, fontWeight: '700' }]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Pin toggle */}
              <View style={[styles.pinRow, isPinned && styles.pinRowActive]}>
                <View style={styles.pinRowLeft}>
                  <View style={[styles.pinIconBox, isPinned && styles.pinIconBoxActive]}>
                    <Ionicons name="pin" size={16} color={isPinned ? '#fff' : '#9CA3AF'} />
                  </View>
                  <View>
                    <Text style={styles.pinLabel}>Pin to Top</Text>
                    <Text style={styles.pinSubLabel}>Stays above all other notices</Text>
                  </View>
                </View>
                <Switch
                  value={isPinned}
                  onValueChange={setIsPinned}
                  trackColor={{ false: theme.colors.card, true: PINK_BD }}
                  thumbColor={isPinned ? PINK : '#E5E7EB'}
                  ios_backgroundColor={theme.colors.card}
                />
              </View>

              {/* Publish button */}
              <TouchableOpacity
                style={[styles.publishBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <LogoLoader color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.publishBtnText}>Publish Notice</Text>
                  </>
                )}
              </TouchableOpacity>

            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 14, fontSize: 13, color: theme.colors.textSecondary, letterSpacing: 0.3 },

  // ── SEARCH ────────────────────────────────────────────────
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.background,
    marginHorizontal: 20, marginTop: 16,
    paddingHorizontal: 14, borderRadius: 14, height: 50,
    elevation: 2, borderWidth: 1.5, borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 5,
  },
  searchFocused: {
    borderColor: PINK,
    shadowColor: PINK, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937', fontWeight: '500' },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center',
  },

  // ── STATS STRIP ───────────────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    marginHorizontal: 20, marginTop: 12,
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18,
    elevation: 2, alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 5,
  },
  statChip: { flex: 1, alignItems: 'center', borderLeftWidth: 3, borderLeftColor: '#E5E7EB', paddingLeft: 10 },
  statDivider: { width: 1, height: 30, backgroundColor: theme.colors.card, marginHorizontal: 4 },
  statNumber: { fontSize: 18, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: theme.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  // ── LIST ──────────────────────────────────────────────────
  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 110 },

  // ── CARD ──────────────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 20, marginBottom: 14,
    flexDirection: 'row', overflow: 'hidden',
    elevation: 4,
    shadowColor: '#1F1F2E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09, shadowRadius: 12,
  },
  cardPinned: {
    borderWidth: 1.5, borderColor: PINK_BD,
    shadowColor: PINK, shadowOpacity: 0.14, shadowRadius: 14, elevation: 6,
  },
  cardStripe: { width: 4 },
  cardInner: { flex: 1, padding: 16 },

  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8, gap: 8,
  },
  titleRow: { flex: 1 },
  pinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: PINK_MD, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6,
    borderWidth: 1, borderColor: PINK_BD,
  },
  pinText: { fontSize: 9, fontWeight: '900', color: PINK, letterSpacing: 0.8 },

  cardTitle: {
    fontSize: 15, fontWeight: '700', color: '#111827', letterSpacing: -0.3, lineHeight: 22,
  },
  cardTitlePinned: { color: '#1F2937' },

  priorityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, flexShrink: 0,
  },
  priorityText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },

  cardContent: {
    fontSize: 13, color: theme.colors.textSecondary,
    lineHeight: 19, marginBottom: 12,
  },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audiencePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  audienceText: { fontSize: 11, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 11, color: theme.colors.textTertiary, fontWeight: '500' },

  // ── EMPTY ─────────────────────────────────────────────────
  emptyContainer: { alignItems: 'center', paddingTop: 70 },
  emptyIconWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: PINK_LT,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
    elevation: 3, shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#374151', letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 6, textAlign: 'center', paddingHorizontal: 44 },

  // ── FAB ───────────────────────────────────────────────────
  fabWrapper: { position: 'absolute', bottom: 28, right: 18 },
  fab: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: PINK,
    paddingVertical: 15, paddingHorizontal: 24,
    borderRadius: 32, gap: 8,
    elevation: 12,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 16,
  },
  fabLabel: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.2 },

  // ── BOTTOM SHEET ──────────────────────────────────────────
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(8,8,24,0.58)', justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 22, paddingBottom: 10, paddingTop: 12,
    maxHeight: '92%',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 22,
  },
  sheetHandle: {
    width: 42, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetIconBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: PINK_MD,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#111827', letterSpacing: -0.4 },
  sheetSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.card,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetScroll: { paddingTop: 16, paddingBottom: 36 },

  // ── SECTION HEADERS ───────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 20, marginBottom: 4,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', color: '#9CA3AF',
    letterSpacing: 1.4, textTransform: 'uppercase',
  },

  // ── FORM ──────────────────────────────────────────────────
  label: {
    fontSize: 10, fontWeight: '800', color: '#9CA3AF',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 14, marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 13, padding: 14,
    fontSize: 15, color: '#1F2937', fontWeight: '500',
  },
  textArea: { height: 110, textAlignVertical: 'top' },

  // Audience chips
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  audienceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },

  // Class row
  classRow: { marginBottom: 4 },
  classChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    backgroundColor: theme.colors.card, marginRight: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  classChipActive: { backgroundColor: PINK_MD, borderColor: PINK },
  classChipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  classChipTextActive: { color: PINK, fontWeight: '700' },

  // Priority chips
  priorityGrid: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  priorityChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5, borderColor: 'transparent',
  },

  // Pin toggle
  pinRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: 16, padding: 14,
    marginTop: 6, marginBottom: 4,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  pinRowActive: { backgroundColor: PINK_LT, borderColor: PINK_BD },
  pinRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pinIconBox: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  pinIconBoxActive: { backgroundColor: PINK },
  pinLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  pinSubLabel: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },

  // Publish button
  publishBtn: {
    backgroundColor: PINK,
    padding: 17, borderRadius: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    marginTop: 20,
    elevation: 8,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45, shadowRadius: 14,
  },
  publishBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
});