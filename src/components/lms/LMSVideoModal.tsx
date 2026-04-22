import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer, { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';
import Toast from 'react-native-toast-message';
import LMSWebYoutubePlayer from '@/src/components/lms/LMSWebYoutubePlayer';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/services/apiClient';
import { Theme } from '@/src/theme/themes';
import { extractYoutubeVideoId } from '@/src/utils/youtube';
import {
  getVideoProgress,
  upsertVideoProgress,
  type VideoProgress,
} from '@/src/utils/lmsVideoProgress';

const SKIP_BUFFER_SEC = 3;
const COMPLETE_RATIO = 0.95;
const TOAST_THROTTLE_MS = 2200;

export type LMSVideoMaterial = {
  id: string;
  title: string;
  course_title: string;
  teacher_name: string;
  content_url: string;
};

type Props = {
  visible: boolean;
  material: LMSVideoMaterial | null;
  theme: Theme;
  isDark: boolean;
  onClose: () => void;
  onProgressUpdated: () => void;
};

function subjectAccent(courseTitle: string, isDark: boolean): { bg: string; text: string } {
  const t = courseTitle.toLowerCase();
  if (t.includes('math')) return { bg: isDark ? 'rgba(37,99,235,0.25)' : '#DBEAFE', text: '#2563EB' };
  if (t.includes('science') || t.includes('physics') || t.includes('biology'))
    return { bg: isDark ? 'rgba(16,185,129,0.25)' : '#D1FAE5', text: '#059669' };
  if (t.includes('english')) return { bg: isDark ? 'rgba(245,158,11,0.25)' : '#FEF3C7', text: '#D97706' };
  if (t.includes('social')) return { bg: isDark ? 'rgba(139,92,246,0.25)' : '#EDE9FE', text: '#7C3AED' };
  if (t.includes('hindi')) return { bg: isDark ? 'rgba(236,72,153,0.25)' : '#FCE7F3', text: '#DB2777' };
  if (t.includes('telugu')) return { bg: isDark ? 'rgba(20,184,166,0.25)' : '#CCFBF1', text: '#0D9488' };
  return { bg: isDark ? 'rgba(79,70,229,0.25)' : '#EEF2FF', text: '#4F46E5' };
}

export default function LMSVideoModal({
  visible,
  material,
  theme,
  isDark,
  onClose,
  onProgressUpdated,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 768;
  const playerRef = useRef<YoutubeIframeRef | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [maxWatchedTime, setMaxWatchedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);
  const lastSkipToastAt = useRef(0);
  const maxRef = useRef(0);
  const durationRef = useRef(0);
  const completedRef = useRef(false);
  const viewCountedRef = useRef(false);
  const materialIdRef = useRef<string | null>(null);
  const progressAnim = useSharedValue(0);

  const videoId = material ? extractYoutubeVideoId(material.content_url) : null;
  const sheetHPad = isDesktopWeb ? 28 : 16;
  const playerW = Math.min(
    winW - sheetHPad * 2,
    isDesktopWeb ? Math.min(880, winW - 64) : 960
  );
  const playerH = Math.round((playerW * 9) / 16);

  const syncProgressToStorage = useCallback(
    async (patch: Partial<VideoProgress> & { materialId: string }) => {
      const base: VideoProgress = {
        materialId: patch.materialId,
        maxWatchedTime: patch.maxWatchedTime ?? maxRef.current,
        duration: patch.duration ?? durationRef.current,
        completed: patch.completed ?? completedRef.current,
        viewCounted: patch.viewCounted ?? viewCountedRef.current,
      };
      await upsertVideoProgress(base);
      onProgressUpdated();
    },
    [onProgressUpdated]
  );

  useEffect(() => {
    maxRef.current = maxWatchedTime;
  }, [maxWatchedTime]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);
  useEffect(() => {
    viewCountedRef.current = viewCounted;
  }, [viewCounted]);

  useEffect(() => {
    if (!visible || !material) return;
    materialIdRef.current = material.id;
    let cancelled = false;
    (async () => {
      const saved = await getVideoProgress(material.id);
      if (cancelled || materialIdRef.current !== material.id) return;
      const d0 = saved?.duration ?? 0;
      const m0 = saved?.maxWatchedTime ?? 0;
      setDuration(d0);
      setMaxWatchedTime(m0);
      maxRef.current = m0;
      setCompleted(!!saved?.completed);
      completedRef.current = !!saved?.completed;
      setViewCounted(!!saved?.viewCounted);
      viewCountedRef.current = !!saved?.viewCounted;
      setCurrentTime(0);
      setPlayerReady(false);
      setShowCompletionOverlay(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, material]);

  useEffect(() => {
    const d = durationRef.current;
    const pct = d > 0 ? Math.min(1, maxWatchedTime / d) : 0;
    progressAnim.value = withTiming(pct, { duration: 280 });
  }, [maxWatchedTime, duration, progressAnim]);

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  const onReady = useCallback(async () => {
    setPlayerReady(true);
    try {
      const d = await playerRef.current?.getDuration?.();
      if (typeof d === 'number' && d > 0 && !Number.isNaN(d)) {
        setDuration(d);
        durationRef.current = d;
        if (material?.id) {
          await syncProgressToStorage({
            materialId: material.id,
            duration: d,
            maxWatchedTime: maxRef.current,
            completed: completedRef.current,
            viewCounted: viewCountedRef.current,
          });
        }
      }
      const start = maxRef.current;
      if (start > 1 && !completedRef.current && material?.id) {
        playerRef.current?.seekTo(start, true);
      }
    } catch {
      /* ignore */
    }
  }, [material?.id, syncProgressToStorage]);

  const handleWebPlayerError = useCallback((msg: string) => {
    setPlayerReady(true);
    Toast.show({
      type: 'error',
      text1: 'Could not load the video player',
      text2: msg,
      position: 'bottom',
      visibilityTime: 4500,
    });
  }, []);

  const showSkipToast = useCallback(() => {
    const now = Date.now();
    if (now - lastSkipToastAt.current < TOAST_THROTTLE_MS) return;
    lastSkipToastAt.current = now;
    Toast.show({
      type: 'info',
      text1: 'Please watch the full video to mark it complete',
      position: 'bottom',
      visibilityTime: 2500,
    });
  }, []);

  const enforceWatchProgress = useCallback(async () => {
    if (!playerRef.current || !material?.id || completedRef.current) return;
    try {
      const t = await playerRef.current.getCurrentTime();
      if (typeof t !== 'number' || Number.isNaN(t)) return;
      setCurrentTime(t);
      const max = maxRef.current;
      const lim = max + SKIP_BUFFER_SEC;
      if (t > lim) {
        playerRef.current.seekTo(max, true);
        showSkipToast();
        return;
      }
      if (t > max) {
        setMaxWatchedTime(t);
        maxRef.current = t;
        await syncProgressToStorage({
          materialId: material.id,
          maxWatchedTime: t,
          duration: durationRef.current,
          completed: false,
          viewCounted: viewCountedRef.current,
        });
      }
    } catch {
      /* ignore */
    }
  }, [material?.id, showSkipToast, syncProgressToStorage]);

  useEffect(() => {
    if (!visible || !playerReady || !videoId) return;
    const id = setInterval(() => {
      if (completedRef.current) return;
      enforceWatchProgress();
    }, 320);
    return () => clearInterval(id);
  }, [visible, playerReady, videoId, enforceWatchProgress]);

  const postViewIfNeeded = useCallback(async () => {
    if (viewCountedRef.current || !material?.id) return;
    try {
      await api.post(`/lms/material/${material.id}/view`, {}, { silent: true });
      viewCountedRef.current = true;
      setViewCounted(true);
      await syncProgressToStorage({
        materialId: material.id,
        maxWatchedTime: maxRef.current,
        duration: durationRef.current,
        completed: true,
        viewCounted: true,
      });
    } catch {
      await syncProgressToStorage({
        materialId: material.id,
        maxWatchedTime: maxRef.current,
        duration: durationRef.current,
        completed: true,
        viewCounted: false,
      });
    }
  }, [material?.id, syncProgressToStorage]);

  const handleStateChange = useCallback(
    async (state: PLAYER_STATES) => {
      if (state === PLAYER_STATES.ENDED && material?.id) {
        const d = durationRef.current;
        const max = maxRef.current;
        if (d > 0 && max / d >= COMPLETE_RATIO && !completedRef.current) {
          completedRef.current = true;
          setCompleted(true);
          setShowCompletionOverlay(true);
          await postViewIfNeeded();
        }
      }
    },
    [material?.id, postViewIfNeeded]
  );

  const accent = material ? subjectAccent(material.course_title, isDark) : subjectAccent('', isDark);
  const styles = React.useMemo(
    () => buildStyles(theme, isDark, isDesktopWeb, insets.bottom),
    [theme, isDark, isDesktopWeb, insets.bottom]
  );

  const headPositionPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  if (!material || !videoId) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={[styles.backdrop, isDesktopWeb && styles.backdropDesktop]}>
          <View
            style={[
              styles.sheet,
              styles.sheetError,
              isDesktopWeb && styles.sheetDesktop,
              { paddingBottom: 16 + insets.bottom },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.headerTitle}>Video</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtnInner} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.errorText}>This video link is not supported.</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={[styles.backdrop, isDesktopWeb && styles.backdropDesktop]}>
        <View
          style={[
            styles.sheet,
            isDesktopWeb && styles.sheetDesktop,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              maxHeight: isDesktopWeb ? Math.min(winH * 0.9, 920) : '92%',
            },
          ]}
        >
          <LinearGradient
            colors={[accent.text + (isDark ? '55' : '35'), accent.text + '00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sheetAccentBar}
          />

          <View style={[styles.sheetHeader, { paddingTop: isDesktopWeb ? 14 : 10 + Math.min(insets.top, 28) }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconWrap, { backgroundColor: accent.bg }]}>
                <Ionicons name="play-circle" size={22} color={accent.text} />
              </View>
              <View>
                <Text style={styles.headerKicker}>Now watching</Text>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {material.title}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityLabel="Close video"
              onPress={onClose}
              style={styles.closeBtnInner}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.closeBtnCircle}>
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[
              styles.scroll,
              {
                maxHeight: isDesktopWeb
                  ? Math.min(680, winH * 0.78)
                  : Math.min(Math.round(winH * 0.5), 420),
              },
            ]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.playerStage}>
              <View style={[styles.playerStageRing, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)' }]}>
                <View style={[styles.playerWrap, { width: playerW, height: playerH }]}>
                  {!playerReady ? (
                    <View style={styles.playerLoading}>
                      <ActivityIndicator size="large" color={theme.colors.primary} />
                    </View>
                  ) : null}
                  {Platform.OS === 'web' ? (
                    <LMSWebYoutubePlayer
                      ref={playerRef}
                      videoId={videoId}
                      width={playerW}
                      height={playerH}
                      hostDomId={material.id}
                      onReady={onReady}
                      onChangeState={handleStateChange}
                      onError={handleWebPlayerError}
                    />
                  ) : (
                    <YoutubePlayer
                      ref={playerRef}
                      height={playerH}
                      width={playerW}
                      videoId={videoId}
                      onReady={onReady}
                      onChangeState={handleStateChange}
                      initialPlayerParams={{
                        controls: true,
                        preventFullScreen: false,
                      }}
                      webViewProps={{
                        androidLayerType: Platform.OS === 'android' ? 'hardware' : undefined,
                      }}
                    />
                  )}
                  {showCompletionOverlay ? (
                    <Animated.View entering={FadeIn.duration(420)} style={styles.completionOverlay}>
                      <Ionicons name="checkmark-circle" size={72} color={theme.colors.success} />
                      <Text style={styles.completionTitle}>Video Completed!</Text>
                    </Animated.View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={[styles.detailsCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
              <View style={styles.progressBlock}>
                <View style={styles.progressLabelRow}>
                  <View style={styles.progressLabelLeft}>
                    <MaterialIcons name="timeline" size={18} color={theme.colors.primary} />
                    <Text style={styles.progressLabel}>Watch progress</Text>
                  </View>
                  {!completed ? (
                    <View style={styles.hintPill}>
                      <Text style={styles.hintPillText}>Watch in order — skipping is limited</Text>
                    </View>
                  ) : (
                    <View style={styles.hintPillDone}>
                      <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                      <Text style={styles.hintPillDoneText}>Completed</Text>
                    </View>
                  )}
                </View>

                <View style={styles.trackOuter}>
                  {!completed ? (
                    <View
                      style={[
                        styles.lockMarker,
                        { left: `${headPositionPct}%` as `${number}%`, marginLeft: -14 },
                      ]}
                    >
                      <View style={styles.lockBubble}>
                        <Text style={styles.lockEmoji}>🔒</Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={[styles.track, { backgroundColor: isDark ? theme.colors.borderLight : theme.colors.border }]}>
                    <Animated.View style={[styles.trackFillClip, barFillStyle]}>
                      <LinearGradient
                        colors={[theme.colors.info, theme.colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </Animated.View>
                  </View>
                </View>

                <View style={styles.timeRow}>
                  <Text style={styles.timeMain}>
                    <Text style={styles.timeElapsed}>{formatClock(maxWatchedTime)}</Text>
                    <Text style={styles.timeSep}> / </Text>
                    <Text style={styles.timeTotal}>{formatClock(duration)}</Text>
                  </Text>
                  {duration > 0 ? (
                    <Text style={styles.pctLabel}>
                      {Math.min(100, Math.round((maxWatchedTime / duration) * 100))}% watched
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={[styles.metaDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.metaBlock}>
                <Text style={styles.videoTitle} numberOfLines={3}>
                  {material.title}
                </Text>
                <View style={styles.metaRow}>
                  <View style={[styles.badge, { backgroundColor: accent.bg }]}>
                    <Text style={[styles.badgeText, { color: accent.text }]}>{material.course_title}</Text>
                  </View>
                </View>
                <View style={styles.teacherRow}>
                  <MaterialIcons name="person-outline" size={18} color={theme.colors.textTertiary} />
                  <Text style={styles.teacher}>{material.teacher_name}</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatClock(sec: number): string {
  if (!sec || sec < 0 || !Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildStyles(theme: Theme, isDark: boolean, isDesktopWeb: boolean, _bottomInset: number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.78)' : 'rgba(15,23,42,0.5)',
      justifyContent: 'flex-end',
    },
    backdropDesktop: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    sheet: {
      width: '100%',
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingTop: 0,
      paddingHorizontal: isDesktopWeb ? 24 : 16,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 -12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 -12px 40px rgba(15,23,42,0.15), 0 0 0 1px rgba(15,23,42,0.06)',
        },
        default: {
          elevation: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 20,
        },
      }),
    },
    sheetDesktop: {
      width: '100%',
      maxWidth: 920,
      borderRadius: 24,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08)'
            : '0 24px 56px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.08)',
        },
        default: {},
      }),
    },
    sheetError: {
      paddingTop: 16,
      borderRadius: isDesktopWeb ? 20 : 22,
    },
    sheetAccentBar: {
      height: 3,
      width: '100%',
      opacity: 0.95,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      marginHorizontal: -4,
      paddingHorizontal: 4,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
      paddingRight: 8,
    },
    headerIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerKicker: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textStrong,
    },
    closeBtnInner: {
      padding: 4,
    },
    closeBtnCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    scroll: {
      width: '100%',
      maxWidth: 960,
      alignSelf: 'center',
    },
    scrollContent: {
      paddingTop: 16,
      paddingBottom: 20,
      alignItems: 'center',
    },
    playerStage: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 4,
    },
    playerStageRing: {
      padding: 4,
      borderRadius: 18,
      borderWidth: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.35)'
            : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 36px rgba(15,23,42,0.12)',
        },
        default: {},
      }),
    },
    playerWrap: {
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#0a0a0a',
      position: 'relative',
    },
    playerLoading: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 5,
      backgroundColor: theme.colors.background,
    },
    completionOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(11,15,25,0.9)' : 'rgba(255,255,255,0.94)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 12,
      gap: 10,
    },
    completionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.success,
    },
    detailsCard: {
      width: '100%',
      maxWidth: 960,
      marginTop: 16,
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      ...Platform.select({
        web: {
          boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.35)' : '0 4px 20px rgba(15,23,42,0.08)',
        },
        default: {
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
      }),
    },
    progressBlock: {
      gap: 0,
    },
    progressLabelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 12,
    },
    progressLabelLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textStrong,
    },
    hintPill: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.12)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.25)',
      maxWidth: '100%',
    },
    hintPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.warning,
    },
    hintPillDone: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    hintPillDoneText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.success,
    },
    trackOuter: {
      position: 'relative',
      width: '100%',
      paddingTop: 18,
      marginTop: 2,
    },
    track: {
      height: 11,
      borderRadius: 999,
      overflow: 'hidden',
      position: 'relative',
    },
    trackFillClip: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      overflow: 'hidden',
      borderRadius: 999,
    },
    lockMarker: {
      position: 'absolute',
      top: 0,
      zIndex: 4,
    },
    lockBubble: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(11,15,25,0.92)' : 'rgba(255,255,255,0.96)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
        default: { elevation: 3 },
      }),
    },
    lockEmoji: {
      fontSize: 13,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      flexWrap: 'wrap',
      gap: 8,
    },
    timeMain: {
      fontVariant: ['tabular-nums'],
    },
    timeElapsed: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.info,
    },
    timeSep: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.textTertiary,
    },
    timeTotal: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    pctLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textTertiary,
    },
    metaDivider: {
      height: StyleSheet.hairlineWidth,
      marginVertical: 16,
    },
    metaBlock: {
      gap: 10,
    },
    videoTitle: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '800',
      color: theme.colors.textStrong,
      letterSpacing: -0.3,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
    },
    badge: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 10,
      alignSelf: 'flex-start',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    teacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    teacher: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    errorText: {
      color: theme.colors.textSecondary,
      padding: 20,
      textAlign: 'center',
      fontSize: 15,
    },
  });
}
