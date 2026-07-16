import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  Platform,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { isTelugu } from '../../src/utils/lang';
import { useTheme } from '../../src/hooks/useTheme';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { api } from '../../src/services/apiClient';
import LogoLoader from '../../src/components/LogoLoader';
import { BusAttendanceService } from '../../src/services/busAttendanceService';
import LiveBusMap, { LiveStop } from '../../src/components/LiveBusMap';
import LiveRouteTracker from '../../src/components/LiveRouteTracker';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  blue: '#2563EB',
  blueMid: '#3B82F6',
  blueLight: '#EFF6FF',
  blueBorder: '#BFDBFE',
  emerald: '#059669',
  emeraldLight: '#ECFDF5',
  amber: '#D97706',
  amberLight: '#FFFBEB',
  amberBorder: '#FDE68A',
  red: '#DC2626',
  redLight: '#FEF2F2',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate700: '#334155',
  slate900: '#0F172A',
  white: '#FFFFFF',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const tripStatusIsActive = (s?: string | null) =>
  s === 'in_progress' || s === 'active';

type BusPayload = {
  assigned: boolean;
  route_name?: string;
  boarding_stop?: string;
  boarding_stop_id?: string;
  boarding_stop_order?: number;
  trip?: {
    id: string;
    status: string;
    ui_status?: string;
    started_at?: string | null;
    ended_at?: string | null;
  } | null;
  stops?: {
    id: string;
    name: string;
    stop_order: number;
    exec_order?: number;
    latitude?: number | null;
    longitude?: number | null;
    status?: string | null;
    reached_at?: string | null;
  }[];
  current_stop?: { id: string; name: string; stop_order: number } | null;
  stops_until_boarding?: number | null;
};

type LivePayload = {
  assigned: boolean;
  live: boolean;
  trip?: { id: string; status: string } | null;
  location?: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    recorded_at: string;
    age_seconds: number | null;
    is_fresh: boolean;
  } | null;
  eta_minutes?: number | null;
  eta_low_minutes?: number | null;
  eta_high_minutes?: number | null;
  eta_confidence?: 'high' | 'medium' | 'low';
  eta_source?: string;
  distance_km?: number | null;
  boarding_stop_id?: string | null;
  stops?: LiveStop[];
};

const formatAge = (ageSeconds: number | null | undefined, t: TFunction) => {
  if (ageSeconds == null) return null;
  if (ageSeconds < 15) return t('busTracker.just_now');
  if (ageSeconds < 60) return t('busTracker.seconds_ago', { count: ageSeconds });
  return t('busTracker.minutes_ago', { count: Math.round(ageSeconds / 60) });
};

// ─── Pulsing stop node (current bus position) ─────────────────────────────────
const CurrentStopNode = ({ theme }: { theme: any }) => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.ease) }),
      ),
      -1,
    );
  }, [scale]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [1, 1.6], [0.5, 0]),
  }));
  return (
    <View style={nodeStyles.wrap}>
      <Animated.View style={[nodeStyles.pulseRing, ringStyle, { backgroundColor: theme.colors.primary }]} />
      <View style={[nodeStyles.currentNode, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}>
        <Ionicons name="bus" size={12} color={C.white} />
      </View>
    </View>
  );
};
const nodeStyles = StyleSheet.create({
  wrap: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  pulseRing: {
    position: 'absolute', width: 28, height: 28,
    borderRadius: 14, backgroundColor: C.blue, opacity: 0.3,
  },
  currentNode: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.blue, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.blue, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
});

// ─── Urgency countdown badge ──────────────────────────────────────────────────
const UrgencyBadge = ({ until, theme }: { until: number; theme: any }) => {
  const { t } = useTranslation();
  const isUrgent = until <= 2;
  const isClose = until <= 4;
  const bg = isUrgent ? C.redLight : isClose ? C.amberLight : C.white;
  const border = isUrgent ? '#FECACA' : isClose ? C.amberBorder : theme.colors.primary;
  const color = isUrgent ? C.red : isClose ? C.amber : theme.colors.primary;

  return (
    <View style={[urgencyStyles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons
        name={isUrgent ? 'alert-circle' : 'navigate-circle-outline'}
        size={15}
        color={color}
      />
      <Text style={[urgencyStyles.text, { color }]}>
        {until === 0
          ? t('busTracker.arriving_now')
          : t(until === 1 ? 'busTracker.stops_away_one' : 'busTracker.stops_away_other', { count: until })}
      </Text>
    </View>
  );
};
const urgencyStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 24, borderWidth: 1.5, alignSelf: 'flex-start',
  },
  text: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function StudentBusTrackerScreen() {
  const { theme, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const dateLocale = isTelugu(i18n.language) ? 'te-IN' : 'en-IN';
  const [data, setData] = useState<BusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [smoothEta, setSmoothEta] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingHighEtaRef = useRef<number | null>(null);

  const load = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get<BusPayload>('/transport/my-bus');
      setData(res);

      if (res?.assigned) {
        const history = await BusAttendanceService.getMyAttendance();
        setAttendanceHistory(history || []);
      }
    } catch {
      setData({ assigned: false });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadLive = useCallback(async () => {
    try {
      const res = await api.get<LivePayload>('/transport/my-bus/live');
      setLive(res);
    } catch {
      // Keep last known live state; the checkpoint timeline stays the truth.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (livePollRef.current) clearInterval(livePollRef.current);
      };
    }, [load]),
  );

  // A tracker left open in the background must not display yesterday's GPS
  // position or checkpoint state when the parent returns to the app.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        load(true);
        loadLive();
      }
    });
    return () => subscription.remove();
  }, [load, loadLive]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const ui = data?.trip?.ui_status || data?.trip?.status;
    if (tripStatusIsActive(ui)) {
      pollRef.current = setInterval(() => load(true), 20000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [data?.trip?.ui_status, data?.trip?.status, load]);

  // Light live-location poll (few hundred bytes) only while a trip is running.
  useEffect(() => {
    if (livePollRef.current) clearInterval(livePollRef.current);
    const ui = data?.trip?.ui_status || data?.trip?.status;
    if (tripStatusIsActive(ui)) {
      loadLive();
      livePollRef.current = setInterval(loadLive, 10000);
    } else {
      setLive(null);
    }
    return () => { if (livePollRef.current) clearInterval(livePollRef.current); };
  }, [data?.trip?.ui_status, data?.trip?.status, loadLive]);

  // Keep the freshness label accurate between 10-second live-location polls.
  useEffect(() => {
    const activeUi = data?.trip?.ui_status || data?.trip?.status;
    if (!tripStatusIsActive(activeUi)) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data?.trip?.ui_status, data?.trip?.status]);

  // ETA smoothing: a trustworthy ETA drops immediately (good news) but only
  // rises when the higher reading persists across two polls — no jitter.
  useEffect(() => {
    const e = live?.eta_minutes ?? null;
    if (e == null) { setSmoothEta(null); pendingHighEtaRef.current = null; return; }
    setSmoothEta((prev) => {
      if (prev == null || e <= prev) { pendingHighEtaRef.current = null; return e; }
      if (pendingHighEtaRef.current != null) { pendingHighEtaRef.current = null; return e; }
      pendingHighEtaRef.current = e;
      return prev;
    });
  }, [live?.eta_minutes]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
    loadLive();
  };

  // ── Loading ──
  if (loading && !data) {
    return (
      <ScreenLayout>
        <StatusBar barStyle="dark-content" backgroundColor={C.white} />
        <StudentHeader title={t('busTracker.title')} />
        <View style={s.center}>
          <LogoLoader size={52} color={C.blue} />
          <Text style={s.loadingText}>{t('busTracker.loading')}</Text>
        </View>
      </ScreenLayout>
    );
  }

  // ── Not assigned ──
  if (!data?.assigned) {
    return (
      <ScreenLayout>
        <StatusBar barStyle="dark-content" backgroundColor={C.white} />
        <StudentHeader title={t('busTracker.title')} />
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="bus-outline" size={36} color={C.slate400} />
          </View>
          <Text style={s.emptyTitle}>{t('busTracker.no_bus_title')}</Text>
          <Text style={s.emptySub}>{t('busTracker.no_bus_sub')}</Text>
        </View>
      </ScreenLayout>
    );
  }

  // ── Derived state ──
  const rawTrip = data.trip?.ui_status || data.trip?.status || '';
  const isLive = tripStatusIsActive(rawTrip);
  const isCompleted = rawTrip === 'completed';
  const stops = data.stops ?? [];
  const boarding = data.boarding_stop;
  const boardingStopId = data.boarding_stop_id;
  const until = data.stops_until_boarding;
  const currentOrder = data.current_stop?.stop_order;
  const atYourStop =
    isLive && boardingStopId != null && data.current_stop?.id === boardingStopId;

  const statusLabel = isLive
    ? t('busTracker.status_in_progress')
    : isCompleted
      ? t('busTracker.completed')
      : t('busTracker.status_scheduled');

  // ── Live tracking — only driver GPS and server-calculated ETA ──
  const liveData = live;
  const showLive = isLive && !!live?.live;
  const loc = liveData?.location ?? null;
  // Freshness recomputed locally against the 1s clock so it feels real-time
  // between the 10s polls, instead of only updating when the server answers.
  const locAgeSec = loc?.recorded_at
    ? Math.max(0, Math.round((nowMs - new Date(loc.recorded_at).getTime()) / 1000))
    : null;
  const locFresh = locAgeSec != null && locAgeSec <= 120;

  // Smoothed ETA point + learned confidence range (Phase C).
  const etaPoint = smoothEta ?? liveData?.eta_minutes ?? null;
  const etaLow = liveData?.eta_low_minutes ?? null;
  const etaHigh = liveData?.eta_high_minutes ?? null;
  const etaHasRange = etaLow != null && etaHigh != null && etaHigh > etaLow;
  const etaConfLabel = liveData?.eta_confidence === 'high'
    ? t('busTracker.eta_live_estimate')
    : liveData?.eta_confidence === 'low'
      ? t('busTracker.eta_rough_estimate')
      : t('busTracker.eta_estimated');
  const rideHeadline = atYourStop
    ? t('busTracker.bus_at_your_stop')
    : isLive && etaPoint != null
      ? etaPoint === 0
        ? t('busTracker.arriving_now')
        : t('busTracker.bus_arrives_in', { min: etaPoint })
      : isLive
        ? t('busTracker.bus_on_the_way')
        : isCompleted
          ? t('busTracker.trip_complete')
          : t('busTracker.bus_scheduled');
  const rideDetail = atYourStop
    ? t('busTracker.head_to_boarding')
    : isLive
      ? t('busTracker.live_auto_update')
      : isCompleted
        ? t('busTracker.check_details_below')
        : t('busTracker.tracking_starts_when_driver');
  const previewStops: LiveStop[] = stops.map((stop) => ({
    id: stop.id,
    name: stop.name,
    latitude: stop.latitude ?? null,
    longitude: stop.longitude ?? null,
    exec_order: stop.exec_order ?? stop.stop_order,
    status: stop.status || 'pending',
  }));
  const trackerStops = showLive && liveData?.stops?.length ? liveData.stops : previewStops;

  return (
    <ScreenLayout>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <StudentHeader
        title={
          data.route_name
            ? t('busTracker.header_route', { route: data.route_name })
            : t('busTracker.title')
        }
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.blue}
            colors={[C.blue]}
          />
        }
      >
        {/* Ride-hailing style trip sheet: the next useful answer comes first. */}
        <Animated.View
          entering={FadeInDown.duration(450).springify()}
          style={[s.tripSheet, isDark && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <View style={s.sheetHandle} />
          <View style={s.tripTopRow}>
            <View style={[s.routeIconWrap, { backgroundColor: `${theme.colors.primary}14` }]}>
              <Ionicons name="bus" size={20} color={theme.colors.primary} />
            </View>
            <View style={s.tripTitleBlock}>
              <Text style={s.tripEyebrow}>
                {isLive ? t('busTracker.live_school_ride') : t('busTracker.todays_school_ride')}
              </Text>
              <Text style={[s.tripHeadline, isDark && { color: theme.colors.textPrimary }]}>{rideHeadline}</Text>
              <Text style={s.tripDetail}>{rideDetail}</Text>
            </View>
            <View style={[s.statusChip, { backgroundColor: isLive ? C.emeraldLight : C.slate100 }]}>
              {isLive && <View style={s.statusLiveDot} />}
              <Text style={[s.statusChipText, { color: isLive ? C.emerald : C.slate500 }]}>{statusLabel}</Text>
            </View>
          </View>

          <View style={[s.tripRouteRow, { borderTopColor: isDark ? theme.colors.border : C.slate100 }]}>
            <View style={s.tripRouteRail}>
              <View style={[s.tripRouteDot, { backgroundColor: theme.colors.primary }]} />
              <View style={s.tripRouteLine} />
              <View style={s.tripRoutePin} />
            </View>
            <View style={s.tripStopBlock}>
              <Text style={s.tripStopLabel}>{t('busTracker.boarding_stop_label')}</Text>
              <Text style={[s.tripStopName, isDark && { color: theme.colors.textPrimary }]} numberOfLines={1}>{boarding || '—'}</Text>
              <Text style={s.tripRouteName}>{data.route_name || t('busTracker.bus_route_fallback')}</Text>
            </View>
            {isLive && until != null && <UrgencyBadge until={until} theme={theme} />}
          </View>
        </Animated.View>

        {/* ── Route map: preview while scheduled, real GPS while active ── */}
        <Animated.View
          entering={FadeInUp.delay(80).duration(500).springify()}
          style={[s.liveCard, isDark && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderBottomColor: theme.colors.borderLight }]}
        >
            <View style={s.sheetHandle} />
            <View style={s.liveHeader}>
              <View style={s.liveHeaderLeft}>
                <View style={[s.liveGreenDot, { backgroundColor: showLive && locFresh ? C.emerald : C.slate400 }]} />
                <Text style={[s.liveTitle, isDark && { color: theme.colors.textPrimary }]}>
                  {showLive ? t('busTracker.live_bus_map') : t('busTracker.route_map_preview')}
                </Text>
                {locFresh && (
                  <View style={s.liveNowPill}>
                    <View style={s.liveNowDot} />
                    <Text style={s.liveNowText}>{t('busTracker.live')}</Text>
                  </View>
                )}
              </View>
              {loc && (
                <Text style={s.liveFreshness}>
                  {locFresh
                    ? t('busTracker.updated_ago', { age: formatAge(locAgeSec, t) })
                    : t('busTracker.last_seen_ago', { age: formatAge(locAgeSec, t) })}
                </Text>
              )}
            </View>

            {/* Realtime tracker — self-contained (works on web + native) */}
            <LiveRouteTracker
              stops={trackerStops}
              bus={showLive && loc ? { latitude: loc.latitude, longitude: loc.longitude, heading: loc.heading } : null}
              boardingStopId={boardingStopId}
              isFresh={showLive && locFresh}
              etaMinutes={showLive ? liveData?.eta_minutes : null}
              mode={showLive ? 'live' : 'preview'}
              height={280}
            />

            {/* ETA row */}
            {showLive && liveData ? (
            <View style={[s.liveEtaRow, { marginTop: 16 }]}>
              <View style={[s.liveEtaIcon, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="navigate" size={18} color={C.white} />
              </View>
              <View style={{ flex: 1 }}>
                {etaPoint != null ? (
                  <>
                    <View style={s.liveEtaTopRow}>
                      <Text style={[s.liveEtaBig, isDark && { color: theme.colors.textPrimary }]}>
                        {etaPoint === 0 ? t('busTracker.arriving_now') : t('busTracker.eta_min', { min: etaPoint })}
                      </Text>
                      {etaPoint > 0 && (
                        <View style={s.etaConfChip}>
                          <Text style={s.etaConfChipText}>
                            {etaHasRange
                              ? t('busTracker.eta_range', { low: etaLow, high: etaHigh })
                              : etaConfLabel}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.liveEtaSub}>
                      {etaPoint === 0
                        ? t('busTracker.bus_at_or_near_stop')
                        : `${liveData.distance_km != null ? t('busTracker.distance_km', { distance: liveData.distance_km }) : t('busTracker.on_the_way')} ${t('busTracker.to_stop', { stop: boarding || t('busTracker.your_stop_fallback') })}${etaHasRange ? t('busTracker.eta_suffix', { label: etaConfLabel }) : ''}`}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[s.liveEtaBig, isDark && { color: theme.colors.textPrimary }]}>
                      {loc ? t('busTracker.on_the_way') : t('busTracker.waiting_for_gps')}
                    </Text>
                    <Text style={s.liveEtaSub}>
                      {loc
                        ? t('busTracker.eta_unavailable')
                        : t('busTracker.bus_appears_when_gps')}
                    </Text>
                  </>
                )}
              </View>
            </View>
            ) : (
              <View style={s.previewMapFooter}>
                <View style={[s.previewMapIcon, { backgroundColor: `${theme.colors.primary}14` }]}>
                  <Ionicons name="navigate-outline" size={17} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.previewMapTitle, isDark && { color: theme.colors.textPrimary }]}>
                    {t('busTracker.driver_not_started')}
                  </Text>
                  <Text style={s.previewMapText}>
                    {t('busTracker.preview_marker_moves', {
                      stop: boarding || t('busTracker.your_stop_fallback'),
                    })}
                  </Text>
                </View>
              </View>
            )}

            {/* Stale-signal notice */}
            {showLive && loc && !locFresh && (
              <View style={s.liveStaleBanner}>
                <Ionicons name="cloud-offline-outline" size={15} color={C.amber} />
                <Text style={s.liveStaleText}>{t('busTracker.gps_signal_lost')}</Text>
              </View>
            )}

            {/* Full street map (MapLibre) — native only; the web wrapper is a stub */}
            {showLive && liveData && Platform.OS !== 'web' && (
              <>
                <TouchableOpacity
                  style={[s.liveMapToggle, isDark && { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => setMapOpen((v) => !v)}
                >
                  <Ionicons name={mapOpen ? 'chevron-up' : 'map-outline'} size={16} color={theme.colors.primary} />
                  <Text style={[s.liveMapToggleText, { color: theme.colors.primary }]}>
                    {mapOpen ? t('busTracker.hide_street_map') : t('busTracker.open_street_map')}
                  </Text>
                </TouchableOpacity>

                {mapOpen && (
                  <Animated.View entering={FadeIn.duration(250)} style={{ marginTop: 12 }}>
                    <LiveBusMap
                      stops={trackerStops}
                      busLocation={loc ? { latitude: loc.latitude, longitude: loc.longitude } : null}
                      boardingStopId={liveData.boarding_stop_id}
                      height={240}
                    />
                  </Animated.View>
                )}
              </>
            )}
        </Animated.View>

        {/* ── Bus at stop alert ───────────────────────────────────────── */}
        {atYourStop && (
          <Animated.View entering={FadeIn.duration(400)}>
            <LinearGradient
              colors={['#FEF3C7', '#FDE68A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.alertBanner}
            >
              <View style={s.alertIconWrap}>
                <Ionicons name="alert-circle" size={22} color={C.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>{t('busTracker.bus_at_stop')}</Text>
                <Text style={s.alertSub}>{t('busTracker.head_out')}</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Route Timeline ──────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(500).springify()}
          style={[s.timelineCard, isDark && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderBottomColor: theme.colors.borderLight }]}
        >
          {/* Soft top-left highlight linear gradient */}
          {!isDark && (
            <LinearGradient
              colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.5, y: 0.8 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}
          <View style={s.timelineHeader}>
            <Text style={[s.timelineTitle, isDark && { color: theme.colors.textPrimary }]}>{t('busTracker.route_stops')}</Text>
            <Text style={s.timelineCount}>{stops.length} {t('busTracker.stops')}</Text>
          </View>

          {stops.map((stop, idx) => {
            const isReached = stop.status === 'completed';
            const isCurrent =
              isLive && currentOrder != null && stop.id === data.current_stop?.id;
            const isBoardingStop = stop.id === boardingStopId;
            const isLast = idx === stops.length - 1;
            const isUpcoming = !isReached && !isCurrent;

            // Node appearance
            const nodeColor = isReached
              ? C.emerald
              : isCurrent
                ? theme.colors.primary
                : isBoardingStop
                  ? theme.colors.primary
                  : C.slate200;

            const nodeBg = isReached
              ? C.emerald
              : isCurrent
                ? theme.colors.primary
                : isBoardingStop
                  ? 'rgba(0,0,0,0)'
                  : C.white;

            return (
              <View key={stop.id} style={s.timelineRow}>
                {/* ── Left: node + connector line ── */}
                <View style={s.timelineLeft}>
                  {/* Connector line above */}
                  {idx > 0 && (
                    <View
                      style={[
                        s.connectorLine,
                        s.connectorTop,
                        { backgroundColor: isReached || isCurrent ? C.emerald : C.slate200 },
                      ]}
                    />
                  )}

                  {/* Stop node */}
                  {isCurrent ? (
                    <CurrentStopNode theme={theme} />
                  ) : (
                    <View
                      style={[
                        s.stopNode,
                        {
                          backgroundColor: nodeBg,
                          borderColor: nodeColor,
                          borderWidth: isBoardingStop && !isReached ? 2.5 : 1.5,
                        },
                      ]}
                    >
                      {isReached ? (
                        <Ionicons name="checkmark" size={12} color={C.white} />
                      ) : isBoardingStop ? (
                        <Ionicons name="person" size={11} color={theme.colors.primary} />
                      ) : (
                        <View style={[s.innerDot, { backgroundColor: isUpcoming ? C.slate200 : nodeColor }]} />
                      )}
                    </View>
                  )}

                  {/* Connector line below */}
                  {!isLast && (
                    <View
                      style={[
                        s.connectorLine,
                        s.connectorBottom,
                        { backgroundColor: isReached ? C.emerald : C.slate200 },
                      ]}
                    />
                  )}
                </View>

                {/* ── Right: stop content ── */}
                <View
                  style={[
                    s.stopContent,
                    isCurrent && [s.stopContentCurrent, isDark && { backgroundColor: theme.colors.background }, { borderColor: theme.colors.primaryLight, borderBottomColor: theme.colors.primaryDark }],
                    isBoardingStop && !isCurrent && [s.stopContentBoarding, isDark && { backgroundColor: theme.colors.background }, { borderColor: theme.colors.primaryLight, borderBottomColor: theme.colors.primary }],
                    isLast && { marginBottom: 0 },
                  ]}
                >
                  <View style={s.stopContentInner}>
                    <View style={{ flex: 1 }}>
                      <View style={s.stopNameRow}>
                        <Text
                          style={[
                            s.stopName,
                            isDark && { color: theme.colors.textPrimary },
                            isReached && { color: isDark ? theme.colors.textMuted : C.slate400 },
                            isCurrent && { color: theme.colors.primary, fontWeight: '700' },
                            isBoardingStop && !isReached && { color: theme.colors.primary },
                          ]}
                        >
                          {stop.name}
                        </Text>
                        {isBoardingStop && (
                          <View style={[s.boardingTag, { backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: theme.colors.primary }]}>
                            <Text style={[s.boardingTagText, { color: theme.colors.primary }]}>{t('busTracker.your_stop')}</Text>
                          </View>
                        )}
                        {isCurrent && (
                          <View style={[s.currentTag, { backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: theme.colors.primary }]}>
                            <Text style={[s.currentTagText, { color: theme.colors.primary }]}>{t('busTracker.bus_here')}</Text>
                          </View>
                        )}
                      </View>

                      {stop.reached_at ? (
                        <Text style={s.stopTime}>
                          {t('busTracker.reached_at')} {new Date(stop.reached_at).toLocaleTimeString(dateLocale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      ) : isUpcoming && !isCurrent ? (
                        <Text style={s.stopTimePending}>{t('busTracker.pending')}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {stops.length === 0 && (
            <Text style={s.noStops}>{t('busTracker.no_stop_data')}</Text>
          )}
        </Animated.View>

        {/* ── Attendance Log ──────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.delay(250).duration(500).springify()}
          style={[s.timelineCard, isDark && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderBottomColor: theme.colors.borderLight }]}
        >
          {/* Soft top-left highlight linear gradient */}
          {!isDark && (
            <LinearGradient
              colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.5, y: 0.8 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}
          <View style={s.timelineHeader}>
            <Text style={[s.timelineTitle, isDark && { color: theme.colors.textPrimary }]}>{t('busTracker.attendance_log')}</Text>
            <Text style={s.timelineCount}>{attendanceHistory.length} {t('busTracker.logs')}</Text>
          </View>

          {attendanceHistory.map((item, idx) => {
            const isPresent = item.status === 'present';
            const logColor = isPresent ? C.emerald : C.red;
            const logBg = isPresent ? C.emeraldLight : C.redLight;
            const dateStr = new Date(item.attendance_date).toLocaleDateString(dateLocale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });
            const timeStr = new Date(item.marked_at).toLocaleTimeString(dateLocale, {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <View key={item.id} style={[s.logItem, idx > 0 && [s.logItemBorder, isDark && { borderTopColor: theme.colors.borderLight }]]}>
                <View style={[s.logStatusBadge, { backgroundColor: logBg, borderColor: logColor }]}>
                  <Ionicons
                    name={isPresent ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={logColor}
                  />
                  <Text style={[s.logStatusText, { color: logColor }]}>
                    {isPresent ? t('busTracker.present') : t('busTracker.absent')}
                  </Text>
                </View>
                <View style={s.logDetails}>
                  <Text style={[s.logStopName, isDark && { color: theme.colors.textPrimary }]}>
                    {item.stop_name || t('busTracker.stop_fallback')}
                  </Text>
                  <Text style={s.logRouteName}>{item.route_name || t('busTracker.route_fallback')}</Text>
                  <Text style={s.logTime}>{dateStr} · {timeStr}</Text>
                </View>
              </View>
            );
          })}

          {attendanceHistory.length === 0 && (
            <Text style={s.noStops}>{t('busTracker.no_log_data')}</Text>
          )}
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const TIMELINE_LEFT = 44;
const NODE_SIZE = 26;

const s = StyleSheet.create({
  scroll: { padding: 16, paddingTop: 8 },

  // ── States ──
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 14 },
  loadingText: { fontSize: 14, color: C.slate400, fontWeight: '500' },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.slate100, justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.slate700 },
  emptySub: { fontSize: 14, color: C.slate400, textAlign: 'center', lineHeight: 20 },

  // ── Trip sheet ──
  tripSheet: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.slate200,
    shadowColor: C.slate900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: C.slate200,
    marginBottom: 16,
  },
  tripTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  tripTitleBlock: { flex: 1, minWidth: 0 },
  tripEyebrow: { fontSize: 10, fontWeight: '800', color: C.slate500, letterSpacing: 0.8, marginBottom: 3 },
  tripHeadline: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: C.slate900, letterSpacing: -0.3 },
  tripDetail: { fontSize: 12, lineHeight: 17, color: C.slate500, marginTop: 3 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 9, borderRadius: 99,
  },
  statusChipText: { fontSize: 11, fontWeight: '800' },
  statusLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.emerald },
  tripRouteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, paddingTop: 14, borderTopWidth: 1,
  },
  tripRouteRail: { width: 16, height: 38, alignItems: 'center', justifyContent: 'space-between' },
  tripRouteDot: { width: 9, height: 9, borderRadius: 5 },
  tripRouteLine: { width: 2, flex: 1, backgroundColor: C.slate200 },
  tripRoutePin: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.slate400, backgroundColor: C.white },
  tripStopBlock: { flex: 1, minWidth: 0 },
  tripStopLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: C.slate400 },
  tripStopName: { fontSize: 15, fontWeight: '700', color: C.slate900, marginTop: 2 },
  tripRouteName: { fontSize: 12, color: C.slate500, marginTop: 2 },

  // ── Live GPS card ──
  liveCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: C.slate900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveGreenDot: { width: 9, height: 9, borderRadius: 4.5 },
  liveTitle: { fontSize: 15, fontWeight: '800', color: C.slate900, letterSpacing: -0.2 },
  liveFreshness: { fontSize: 11, color: C.slate400, fontWeight: '600' },
  liveNowPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.emeraldLight, borderRadius: 20,
    paddingVertical: 3, paddingHorizontal: 8,
  },
  liveNowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.emerald },
  liveNowText: { fontSize: 10, fontWeight: '800', color: C.emerald, letterSpacing: 0.5 },
  liveEtaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingBottom: 4 },
  liveEtaIcon: {
    width: 40, height: 40, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  liveEtaBig: { fontSize: 25, fontWeight: '800', color: C.slate900, letterSpacing: -0.7 },
  liveEtaSub: { fontSize: 12, color: C.slate500, fontWeight: '500', marginTop: 2 },
  liveEtaTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  etaConfChip: {
    backgroundColor: C.blueLight, borderRadius: 12,
    paddingVertical: 3, paddingHorizontal: 9,
    borderWidth: 1, borderColor: C.blueBorder,
  },
  etaConfChipText: { fontSize: 11, fontWeight: '700', color: C.blue },
  liveStaleBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.amberLight, borderColor: C.amberBorder, borderWidth: 1,
    borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginTop: 12,
  },
  liveStaleText: { fontSize: 12, color: C.amber, fontWeight: '600', flex: 1 },
  liveMapToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 14, paddingVertical: 12, borderRadius: 14,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200,
    minHeight: 44,
  },
  liveMapToggleText: { fontSize: 13, fontWeight: '700' },
  previewMapFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginTop: 12, paddingHorizontal: 4, paddingVertical: 4,
  },
  previewMapIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  previewMapTitle: { fontSize: 13, fontWeight: '800', color: C.slate900 },
  previewMapText: { fontSize: 11, lineHeight: 16, color: C.slate500, marginTop: 2 },

  // ── Alert banner ──
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.amberBorder,
    shadowColor: C.amber, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },
  alertIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  alertTitle: { fontSize: 15, fontWeight: '800', color: '#92400E' },
  alertSub: { fontSize: 12, color: '#B45309', marginTop: 2 },

  // ── Timeline card ──
  timelineCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: C.slate900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  timelineHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 18,
  },
  timelineTitle: { fontSize: 16, fontWeight: '800', color: C.slate900, letterSpacing: -0.2 },
  timelineCount: { fontSize: 12, color: C.slate500, fontWeight: '700' },

  // ── Timeline row ──
  timelineRow: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timelineLeft: {
    width: TIMELINE_LEFT,
    alignItems: 'center',
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    width: 2,
    left: TIMELINE_LEFT / 2 - 1,
  },
  connectorTop: {
    top: 0,
    height: NODE_SIZE / 2,
  },
  connectorBottom: {
    top: NODE_SIZE / 2 + NODE_SIZE / 2,
    bottom: 0,
    height: 28,
  },
  stopNode: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    zIndex: 2,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Stop content ──
  stopContent: {
    flex: 1,
    paddingBottom: 15,
    paddingLeft: 2,
  },
  stopContentCurrent: {
    backgroundColor: C.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginLeft: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderBottomWidth: 1,
  },
  stopContentBoarding: {
    backgroundColor: C.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginLeft: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderBottomWidth: 1,
  },
  stopContentInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stopNameRow: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', gap: 6,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.slate700,
    flexShrink: 1,
  },
  stopTime: {
    fontSize: 11,
    color: C.slate400,
    marginTop: 3,
    fontWeight: '500',
  },
  stopTimePending: {
    fontSize: 11,
    color: C.slate400,
    marginTop: 3,
    fontWeight: '500',
  },
  boardingTag: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  boardingTagText: { fontSize: 10, fontWeight: '700', color: C.emerald },
  currentTag: {
    backgroundColor: C.blueLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  currentTagText: { fontSize: 10, fontWeight: '700', color: C.blue },
  noStops: {
    textAlign: 'center',
    color: C.slate400,
    fontSize: 14,
    paddingVertical: 20,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  logItemBorder: {
    borderTopWidth: 1,
    borderTopColor: C.slate100,
  },
  logStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    marginRight: 12,
  },
  logStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  logDetails: {
    flex: 1,
  },
  logStopName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.slate700,
  },
  logRouteName: {
    fontSize: 12,
    color: C.slate400,
    marginTop: 2,
  },
  logTime: {
    fontSize: 11,
    color: C.slate400,
    marginTop: 2,
  },
});
