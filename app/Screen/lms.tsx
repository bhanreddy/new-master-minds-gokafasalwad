import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import StudentHeader from '../../src/components/StudentHeader';
import { api } from '../../src/services/apiClient';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import LMSVideoModal, { type LMSVideoMaterial } from '@/src/components/lms/LMSVideoModal';
import { extractYoutubeVideoId } from '@/src/utils/youtube';
import { getVideoProgressMap, type VideoProgress } from '@/src/utils/lmsVideoProgress';

const TABLET_MIN_W = 768;
const NEW_DAYS = 7;

/** `duration` from API is seconds (integer); format for badge. Legacy string like "10:00" is passed through. */
function formatVideoDurationLabel(raw: unknown): string {
  if (raw == null || raw === '') return '—';
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/\s/g, ''), 10);
  if (Number.isFinite(n) && n > 0) {
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(t)) return t;
  }
  return '—';
}

interface LMSMaterial {
  id: string;
  title: string;
  description: string;
  content_url: string;
  duration: string;
  material_type: string;
  created_at: string;
  createdAtIso: string;
  course_title: string;
  class_name: string;
  teacher_name: string;
}

const SUBJECTS = [
  'All',
  'Mathematics',
  'Science',
  'English',
  'Social Science',
  'Hindi',
  'Telugu',
  'Physics',
  'Biology',
] as const;

type SubjectKey = (typeof SUBJECTS)[number];

/** Compare course title from API to filter tab (handles ENGLISH vs English, extra spaces, etc.). */
function normalizeSubjectString(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function courseMatchesSubjectTab(courseTitle: string, tab: SubjectKey): boolean {
  if (tab === 'All') return true;
  const c = normalizeSubjectString(courseTitle);
  const t = normalizeSubjectString(tab);
  if (c === t) return true;
  // e.g. course "English — Grade 10" or "English Literature" still under English
  if (c.startsWith(`${t} `) || c.startsWith(`${t}-`)) return true;
  return false;
}

const SUBJECT_TAB: Record<string, { icon: string; accent: string }> = {
  All: { icon: '📚', accent: '#6366F1' },
  Mathematics: { icon: '📐', accent: '#2563EB' },
  Science: { icon: '🔬', accent: '#059669' },
  English: { icon: '🔤', accent: '#D97706' },
  'Social Science': { icon: '🌍', accent: '#7C3AED' },
  Hindi: { icon: '🔠', accent: '#DB2777' },
  Telugu: { icon: '✍️', accent: '#0D9488' },
  Physics: { icon: '⚛️', accent: '#0891B2' },
  Biology: { icon: '🧬', accent: '#10B981' },
};

function topicAccent(courseTitle: string): string {
  const cfg = SUBJECT_TAB[courseTitle];
  if (cfg) return cfg.accent;
  const t = courseTitle.toLowerCase();
  if (t.includes('math')) return '#2563EB';
  if (t.includes('science')) return '#059669';
  if (t.includes('english')) return '#D97706';
  if (t.includes('social')) return '#7C3AED';
  if (t.includes('hindi')) return '#DB2777';
  if (t.includes('telugu')) return '#0D9488';
  if (t.includes('physics')) return '#0891B2';
  if (t.includes('bio')) return '#10B981';
  return '#4F46E5';
}

function AnimatedProgressFill({
  ratio,
  theme,
  isDark,
}: {
  ratio: number;
  theme: Theme;
  isDark: boolean;
}) {
  const [trackW, setTrackW] = useState(0);
  const wPx = useSharedValue(0);

  useEffect(() => {
    const target = trackW * Math.min(1, Math.max(0, ratio));
    wPx.value = withTiming(target, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [trackW, ratio, wPx]);

  const fillStyle = useAnimatedStyle(() => ({
    width: wPx.value,
  }));

  return (
    <View
      style={{
        height: 8,
        borderRadius: 999,
        overflow: 'hidden',
        width: '100%',
        backgroundColor: isDark ? theme.colors.borderLight : theme.colors.border,
      }}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: 999,
            backgroundColor: theme.colors.info,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}

function ThumbnailShimmer({ active, theme }: { active: boolean; theme: Theme }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    p.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [active, p]);
  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + p.value * 0.45,
  }));
  if (!active) return null;
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: theme.colors.border, zIndex: 0 },
        animStyle,
      ]}
    />
  );
}

export default function LMSPage() {
  const { theme, isDark } = useTheme();
  const { width: winW } = useWindowDimensions();
  const isWide = winW >= TABLET_MIN_W;
  const numCols = isWide ? 2 : 1;
  const styles = useMemo(() => getStyles(theme, isDark, isWide, winW), [theme, isDark, isWide, winW]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey>('All');
  const [materials, setMaterials] = useState<LMSMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbLoaded, setThumbLoaded] = useState<Record<string, boolean>>({});
  const [progressMap, setProgressMap] = useState<Record<string, VideoProgress>>({});
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [activeVideo, setActiveVideo] = useState<LMSVideoMaterial | null>(null);
  const listRef = useRef<FlatList<LMSMaterial>>(null);

  const refreshProgressMap = useCallback(async () => {
    const m = await getVideoProgressMap();
    setProgressMap(m);
  }, []);

  useEffect(() => {
    fetchLMSFeed();
    refreshProgressMap();
  }, [refreshProgressMap]);

  const fetchLMSFeed = async () => {
    try {
      setLoading(true);
      const data: any[] = await api.get('/lms/all-materials');
      const mapped: LMSMaterial[] = data.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        content_url: m.content_url,
        duration: formatVideoDurationLabel(m.duration),
        material_type: m.material_type,
        created_at: new Date(m.created_at).toLocaleDateString(),
        createdAtIso: typeof m.created_at === 'string' ? m.created_at : new Date(m.created_at).toISOString(),
        course_title: m.course_title,
        class_name: m.class_name || 'Class',
        teacher_name: m.instructor_name || 'Teacher',
      }));
      setMaterials(mapped);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const filteredContent = useMemo(() => {
    return materials.filter((item) => {
      const matchesSearch =
        item.course_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = courseMatchesSubjectTab(item.course_title, selectedSubject);
      return matchesSearch && matchesSubject;
    });
  }, [materials, searchQuery, selectedSubject]);

  const progressStats = useMemo(() => {
    const total = filteredContent.length;
    const done = filteredContent.filter((it) => progressMap[it.id]?.completed).length;
    return { total, done, ratio: total > 0 ? done / total : 0 };
  }, [filteredContent, progressMap]);

  const firstIncompleteIndex = useMemo(() => {
    return filteredContent.findIndex((it) => !progressMap[it.id]?.completed);
  }, [filteredContent, progressMap]);

  const scrollToFirstIncomplete = useCallback(() => {
    if (firstIncompleteIndex < 0) return;
    listRef.current?.scrollToIndex({
      index: firstIncompleteIndex,
      animated: true,
      viewPosition: 0.12,
    });
  }, [firstIncompleteIndex]);

  const openMaterial = useCallback((item: LMSMaterial) => {
    const vid = extractYoutubeVideoId(item.content_url);
    if (vid) {
      setActiveVideo({
        id: item.id,
        title: item.title,
        course_title: item.course_title,
        teacher_name: item.teacher_name,
        content_url: item.content_url,
      });
      setVideoModalVisible(true);
      return;
    }
    Linking.openURL(item.content_url).catch(() => {});
  }, []);

  const closeVideoModal = useCallback(() => {
    setVideoModalVisible(false);
    setActiveVideo(null);
  }, []);

  const isNewMaterial = (iso: string) => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t < NEW_DAYS * 24 * 60 * 60 * 1000;
  };

  const renderItem = ({ item, index }: { item: LMSMaterial; index: number }) => {
    const accent = topicAccent(item.course_title);
    const yid = extractYoutubeVideoId(item.content_url);
    const thumbUri = yid ? `https://img.youtube.com/vi/${yid}/hqdefault.jpg` : null;
    const loaded = !!thumbLoaded[item.id];
    const completed = !!progressMap[item.id]?.completed;
    const isNew = isNewMaterial(item.createdAtIso);

    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index, 12) * 70).duration(520)}
        style={numCols > 1 ? styles.gridCell : undefined}
      >
        <Pressable
          onPress={() => openMaterial(item)}
          style={({ pressed, hovered }) => [
            styles.card,
            { borderLeftColor: accent },
            Platform.OS === 'web' && hovered ? styles.cardHoverWeb : null,
            pressed ? styles.cardPressed : null,
          ]}
        >
          <View style={styles.thumbFrame}>
            <View style={styles.thumbnailContainer}>
              <ThumbnailShimmer active={!!thumbUri && !loaded} theme={theme} />
              {thumbUri ? (
                <Image
                  source={{ uri: thumbUri }}
                  style={[styles.thumbnail, !loaded && styles.thumbnailHidden]}
                  resizeMode="cover"
                  onLoadEnd={() => setThumbLoaded((prev) => ({ ...prev, [item.id]: true }))}
                />
              ) : (
                <View style={[styles.thumbnail, styles.thumbPlaceholder]}>
                  <Ionicons name="logo-youtube" size={40} color={theme.colors.textTertiary} />
                </View>
              )}
              <LinearGradient
                pointerEvents="none"
                colors={
                  isDark
                    ? ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)', 'transparent']
                    : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.08)', 'transparent']
                }
                locations={[0, 0.45, 1]}
                style={styles.thumbnailTopShine}
              />
              <View style={styles.playButtonOverlay} pointerEvents="none">
                <View style={styles.playOuterRing}>
                  {Platform.OS === 'web' ? (
                    <View style={[styles.playBlurFallback, isDark && styles.playBlurFallbackDark]}>
                      <Ionicons name="play" size={28} color="#FFF" style={{ marginLeft: 5 }} />
                    </View>
                  ) : (
                    <BlurView intensity={52} tint={isDark ? 'dark' : 'light'} style={styles.playBlurInner}>
                      <Ionicons name="play" size={28} color="#FFF" style={{ marginLeft: 5 }} />
                    </BlurView>
                  )}
                </View>
              </View>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']} style={styles.thumbnailGradient} />
              <View style={styles.durationBadge}>
                <MaterialIcons name="schedule" size={12} color="rgba(255,255,255,0.95)" style={{ marginRight: 4 }} />
                <Text style={styles.durationText}>{item.duration}</Text>
              </View>
              {isNew ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>New</Text>
                </View>
              ) : null}
              {completed ? (
                <View style={styles.doneCorner}>
                  <Ionicons name="checkmark-circle" size={28} color={theme.colors.success} />
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.badgesRow}>
              <View style={[styles.topicBadge, { backgroundColor: isDark ? `${accent}33` : `${accent}22` }]}>
                <Text style={[styles.topicText, { color: accent }]}>{item.course_title}</Text>
              </View>
              <View style={styles.classBadge}>
                <Text style={styles.classBadgeText}>{item.class_name}</Text>
              </View>
            </View>
            <Text style={styles.subTopic} numberOfLines={2}>
              {item.title}
            </Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.footer}>
              <View style={styles.teacherInfo}>
                <MaterialIcons name="person" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.teacherName}>{item.teacher_name}</Text>
              </View>
              <Text style={styles.date}>{item.created_at}</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.card} />
      <StudentHeader showBackButton={true} title="LMS" />

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          {SUBJECTS.map((subject) => {
            const active = selectedSubject === subject;
            const tabMeta = SUBJECT_TAB[subject] ?? SUBJECT_TAB.All;
            return (
              <TouchableOpacity
                key={subject}
                activeOpacity={0.85}
                style={[styles.tabItem, active && styles.tabItemActiveShell]}
                onPress={() => setSelectedSubject(subject)}
              >
                {active ? (
                  <LinearGradient
                    colors={['#2563EB', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                ) : null}
                <View style={styles.tabInner}>
                  <Text style={styles.tabEmoji}>{tabMeta.icon}</Text>
                  <Text style={[styles.tabText, active && styles.activeTabText]}>{subject}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.progressBanner}
        onPress={scrollToFirstIncomplete}
        disabled={firstIncompleteIndex < 0}
      >
        <View style={styles.progressBannerHeader}>
          <Text style={styles.progressBannerTitle}>
            You&apos;ve completed {progressStats.done} of {progressStats.total} videos
          </Text>
          {firstIncompleteIndex >= 0 ? (
            <Ionicons name="chevron-down" size={18} color={theme.colors.primary} />
          ) : null}
        </View>
        <AnimatedProgressFill ratio={progressStats.ratio} theme={theme} isDark={isDark} />
      </TouchableOpacity>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, ds.searchBarWrapper]}>
          <Ionicons name="search" size={20} color={theme.colors.textTertiary} />
          <AppTextInput
            style={[
              ds.inputInChrome,
              styles.searchInput,
              {
                minHeight: 40,
                color: theme.colors.textStrong,
              },
            ]}
            placeholder="Search topics..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.searchClear}
            >
              <Ionicons name="close-circle" size={22} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <LogoLoader size={60} color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filteredContent}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          key={numCols}
          numColumns={numCols}
          columnWrapperStyle={numCols > 1 ? styles.columnWrap : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            const approx = 360;
            setTimeout(() => {
              listRef.current?.scrollToOffset({
                offset: approx * info.index,
                animated: true,
              });
            }, 120);
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="video-library" size={64} color={theme.colors.border} />
              <Text style={styles.emptyText}>No content found</Text>
            </View>
          }
        />
      )}

      <LMSVideoModal
        visible={videoModalVisible}
        material={activeVideo}
        theme={theme}
        isDark={isDark}
        onClose={closeVideoModal}
        onProgressUpdated={refreshProgressMap}
      />
    </View>
  );
}

function getStyles(theme: Theme, isDark: boolean, isWide: boolean, winW: number) {
  const pad = 20;
  const gap = 12;
  const colBasis = isWide ? (winW - pad * 2 - gap) / 2 : winW - pad * 2;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    loaderWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabsContainer: {
      backgroundColor: theme.colors.background,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tabsContent: {
      paddingHorizontal: pad,
      gap: 10,
      alignItems: 'center',
    },
    tabItem: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      position: 'relative',
    },
    tabItemActiveShell: {
      borderColor: 'transparent',
    },
    tabInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      zIndex: 1,
    },
    tabEmoji: {
      fontSize: 15,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    activeTabText: {
      color: '#FFFFFF',
    },
    progressBanner: {
      marginHorizontal: pad,
      marginTop: 12,
      marginBottom: 4,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    progressBannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    progressBannerTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textStrong,
      flex: 1,
      paddingRight: 8,
    },
    searchContainer: {
      paddingHorizontal: pad,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      minHeight: 44,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.textStrong,
      minHeight: 40,
    },
    searchClear: {
      padding: 2,
    },
    listContent: {
      padding: pad,
      paddingTop: 8,
      paddingBottom: 32,
    },
    columnWrap: {
      gap,
      marginBottom: gap,
    },
    gridCell: {
      width: colBasis,
    },
    card: {
      backgroundColor: theme.colors.background,
      borderRadius: 18,
      overflow: 'hidden',
      borderLeftWidth: 4,
      marginBottom: isWide ? 0 : gap,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.06,
      shadowRadius: 10,
      elevation: 2,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 2px 12px rgba(0,0,0,0.35)'
            : '0 2px 12px rgba(15,23,42,0.08)',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        },
        default: {},
      }),
    },
    cardHoverWeb: {
      shadowOpacity: isDark ? 0.4 : 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      transform: [{ translateY: -3 }],
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 14px 28px rgba(0,0,0,0.45)'
            : '0 14px 28px rgba(15,23,42,0.14)',
        },
        default: {},
      }),
    },
    cardPressed: {
      opacity: 0.96,
      elevation: 4,
      shadowOpacity: isDark ? 0.35 : 0.1,
    },
    thumbFrame: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 10,
      backgroundColor: theme.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    thumbnailContainer: {
      position: 'relative',
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: isDark ? '#1E293B' : theme.colors.border,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 6px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 6px 20px rgba(15,23,42,0.1), inset 0 1px 0 rgba(255,255,255,0.85)',
        },
        default: {
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: isDark ? 0.45 : 0.12,
          shadowRadius: 10,
        },
      }),
    },
    thumbnailTopShine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '42%',
      zIndex: 2,
    },
    thumbnail: {
      width: '100%',
      height: '100%',
      zIndex: 1,
    },
    thumbnailHidden: {
      opacity: 0,
    },
    thumbPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.border,
    },
    thumbnailGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '48%',
      zIndex: 3,
    },
    playButtonOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 4,
    },
    playOuterRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      padding: 3,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.5)',
      backgroundColor: 'rgba(0,0,0,0.22)',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: '0 10px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12) inset',
          backdropFilter: 'blur(10px)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 10,
        },
      }),
    },
    playBlurInner: {
      width: '100%',
      height: '100%',
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    playBlurFallback: {
      width: '100%',
      height: '100%',
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.32)',
    },
    playBlurFallbackDark: {
      backgroundColor: 'rgba(30,41,59,0.55)',
    },
    durationBadge: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(8,12,22,0.78)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      zIndex: 5,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      ...Platform.select({
        web: {
          boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
        },
        default: {},
      }),
    },
    durationText: {
      color: '#FFF',
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    newBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: theme.colors.success,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      zIndex: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      ...Platform.select({
        web: {
          boxShadow: '0 2px 8px rgba(16,185,129,0.45)',
        },
        default: {
          elevation: 3,
          shadowColor: theme.colors.success,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 4,
        },
      }),
    },
    newBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    doneCorner: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 7,
      backgroundColor: isDark ? 'rgba(11,15,25,0.82)' : 'rgba(255,255,255,0.94)',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      ...Platform.select({
        web: { boxShadow: '0 2px 10px rgba(0,0,0,0.12)' },
        default: { elevation: 2 },
      }),
    },
    cardContent: {
      paddingHorizontal: 15,
      paddingTop: 14,
      paddingBottom: 15,
    },
    badgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      flexWrap: 'wrap',
    },
    topicBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    topicText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    classBadge: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    classBadgeText: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
    },
    subTopic: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.textStrong,
      marginBottom: 6,
      lineHeight: 22,
    },
    description: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    teacherInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    teacherName: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    date: {
      fontSize: 12,
      color: theme.colors.textTertiary,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    emptyText: {
      marginTop: 10,
      color: theme.colors.textTertiary,
      fontSize: 16,
    },
  });
}
