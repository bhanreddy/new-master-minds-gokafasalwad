import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
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

const { width } = Dimensions.get('window');

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
  boarding_stop_order?: number;
  trip?: {
    id: string;
    status: string;
    ui_status?: string;
    started_at?: string | null;
    ended_at?: string | null;
  } | null;
  stops?: Array<{
    id: string;
    name: string;
    stop_order: number;
    status?: string | null;
    reached_at?: string | null;
  }>;
  current_stop?: { name: string; stop_order: number } | null;
  stops_until_boarding?: number | null;
};

// ─── Pulsing live dot ─────────────────────────────────────────────────────────
const LiveDot = () => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 700, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.in(Easing.ease) }),
      ),
      -1,
    );
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [1, 1.5], [0.5, 0]),
  }));
  return (
    <View style={liveDotStyles.wrap}>
      <Animated.View style={[liveDotStyles.ring, ringStyle]} />
      <View style={liveDotStyles.core} />
    </View>
  );
};
const liveDotStyles = StyleSheet.create({
  wrap: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  ring: {
    position: 'absolute', width: 14, height: 14,
    borderRadius: 7, backgroundColor: C.emerald, opacity: 0.4,
  },
  core: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.emerald },
});

// ─── Pulsing stop node (current bus position) ─────────────────────────────────
const CurrentStopNode = () => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.ease) }),
      ),
      -1,
    );
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [1, 1.6], [0.5, 0]),
  }));
  return (
    <View style={nodeStyles.wrap}>
      <Animated.View style={[nodeStyles.pulseRing, ringStyle]} />
      <View style={nodeStyles.currentNode}>
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
const UrgencyBadge = ({ until }: { until: number }) => {
  const isUrgent = until <= 2;
  const isClose = until <= 4;
  const bg = isUrgent ? C.redLight : isClose ? C.amberLight : C.blueLight;
  const border = isUrgent ? '#FECACA' : isClose ? C.amberBorder : C.blueBorder;
  const color = isUrgent ? C.red : isClose ? C.amber : C.blue;

  return (
    <View style={[urgencyStyles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons
        name={isUrgent ? 'alert-circle' : 'navigate-circle-outline'}
        size={15}
        color={color}
      />
      <Text style={[urgencyStyles.text, { color }]}>
        {until === 0 ? 'Arriving now' : `${until} stop${until > 1 ? 's' : ''} away`}
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
  const [data, setData] = useState<BusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get<BusPayload>('/transport/my-bus');
      setData(res);
    } catch {
      setData({ assigned: false });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load]),
  );

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const ui = data?.trip?.ui_status || data?.trip?.status;
    if (tripStatusIsActive(ui)) {
      pollRef.current = setInterval(() => load(true), 20000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [data?.trip?.ui_status, data?.trip?.status, load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  // ── Loading ──
  if (loading && !data) {
    return (
      <ScreenLayout>
        <StatusBar barStyle="dark-content" backgroundColor={C.white} />
        <StudentHeader title="Bus Tracker" />
        <View style={s.center}>
          <LogoLoader size={52} color={C.blue} />
          <Text style={s.loadingText}>Fetching route…</Text>
        </View>
      </ScreenLayout>
    );
  }

  // ── Not assigned ──
  if (!data?.assigned) {
    return (
      <ScreenLayout>
        <StatusBar barStyle="dark-content" backgroundColor={C.white} />
        <StudentHeader title="Bus Tracker" />
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="bus-outline" size={36} color={C.slate400} />
          </View>
          <Text style={s.emptyTitle}>No bus assigned</Text>
          <Text style={s.emptySub}>Contact your school admin to get a route assigned.</Text>
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
  const boardingOrder = data.boarding_stop_order;
  const until = data.stops_until_boarding;
  const currentOrder = data.current_stop?.stop_order;
  const atYourStop =
    isLive && boardingOrder != null && currentOrder === boardingOrder;

  const statusLabel = isLive ? 'In Progress' : isCompleted ? 'Completed' : 'Scheduled';
  const statusColor = isLive ? C.emerald : isCompleted ? C.slate400 : C.amber;
  const statusBg = isLive ? C.emeraldLight : isCompleted ? C.slate100 : C.amberLight;

  return (
    <ScreenLayout>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <StudentHeader title={data.route_name ? `Bus · ${data.route_name}` : 'Bus Tracker'} />

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

        {/* ── Hero Route Card ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(500).springify()}>
          <LinearGradient
            colors={['#EFF6FF', '#DBEAFE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            {/* Top row: route name + status chip */}
            <View style={s.heroTop}>
              <View style={s.heroLeft}>
                <View style={s.routeIconWrap}>
                  <Ionicons name="bus" size={20} color={C.blue} />
                </View>
                <View>
                  <Text style={s.routeLabel}>Route</Text>
                  <Text style={s.routeName}>{data.route_name || 'Bus Route'}</Text>
                </View>
              </View>
              <View style={[s.statusChip, { backgroundColor: statusBg }]}>
                {isLive && <LiveDot />}
                <Text style={[s.statusChipText, { color: statusColor }]}>
                  {statusLabel}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={s.heroDivider} />

            {/* Bottom row: your stop + urgency */}
            <View style={s.heroBottom}>
              <View style={s.yourStopBlock}>
                <Text style={s.yourStopLabel}>Your boarding stop</Text>
                <View style={s.yourStopRow}>
                  <Ionicons name="location" size={16} color={C.blue} />
                  <Text style={s.yourStopName}>{boarding || '—'}</Text>
                </View>
              </View>
              {isLive && until != null && (
                <UrgencyBadge until={until} />
              )}
              {isLive && until == null && atYourStop && (
                <UrgencyBadge until={0} />
              )}
            </View>
          </LinearGradient>
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
                <Text style={s.alertTitle}>Bus is at your stop!</Text>
                <Text style={s.alertSub}>Head out now — don't miss it.</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Route Timeline ──────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(500).springify()}
          style={s.timelineCard}
        >
          <View style={s.timelineHeader}>
            <Text style={s.timelineTitle}>Route Stops</Text>
            <Text style={s.timelineCount}>{stops.length} stops</Text>
          </View>

          {stops.map((stop, idx) => {
            const isReached = stop.status === 'completed';
            const isCurrent =
              isLive && currentOrder != null && stop.stop_order === currentOrder;
            const isBoardingStop = stop.name === boarding;
            const isLast = idx === stops.length - 1;
            const isUpcoming = !isReached && !isCurrent;

            // Node appearance
            const nodeColor = isReached
              ? C.emerald
              : isCurrent
                ? C.blue
                : isBoardingStop
                  ? C.blue
                  : C.slate200;

            const nodeBg = isReached
              ? C.emerald
              : isCurrent
                ? C.blue
                : isBoardingStop
                  ? C.blueLight
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
                    <CurrentStopNode />
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
                        <Ionicons name="person" size={11} color={C.blue} />
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
                    isCurrent && s.stopContentCurrent,
                    isBoardingStop && !isCurrent && s.stopContentBoarding,
                    isLast && { marginBottom: 0 },
                  ]}
                >
                  <View style={s.stopContentInner}>
                    <View style={{ flex: 1 }}>
                      <View style={s.stopNameRow}>
                        <Text
                          style={[
                            s.stopName,
                            isReached && { color: C.slate400 },
                            isCurrent && { color: C.blue, fontWeight: '700' },
                            isBoardingStop && !isReached && { color: C.blue },
                          ]}
                        >
                          {stop.name}
                        </Text>
                        {isBoardingStop && (
                          <View style={s.boardingTag}>
                            <Text style={s.boardingTagText}>Your stop</Text>
                          </View>
                        )}
                        {isCurrent && (
                          <View style={s.currentTag}>
                            <Text style={s.currentTagText}>Bus here</Text>
                          </View>
                        )}
                      </View>

                      {stop.reached_at ? (
                        <Text style={s.stopTime}>
                          Reached at {new Date(stop.reached_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      ) : isUpcoming && !isCurrent ? (
                        <Text style={s.stopTimePending}>Pending</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {stops.length === 0 && (
            <Text style={s.noStops}>No stop data available.</Text>
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

  // ── Hero card ──
  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.blueBorder,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: C.white, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.blue, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
  routeLabel: { fontSize: 11, color: C.slate400, fontWeight: '600', letterSpacing: 0.4 },
  routeName: { fontSize: 17, fontWeight: '800', color: C.slate900, marginTop: 1 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
  },
  statusChipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  heroDivider: { height: 1, backgroundColor: C.blueBorder, marginVertical: 14 },
  heroBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', gap: 12,
  },
  yourStopBlock: { flex: 1 },
  yourStopLabel: { fontSize: 11, color: C.slate400, fontWeight: '600', letterSpacing: 0.4, marginBottom: 4 },
  yourStopRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yourStopName: { fontSize: 15, fontWeight: '700', color: C.slate900 },

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
    padding: 20,
    borderWidth: 1,
    borderColor: C.slate200,
    shadowColor: C.slate900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  timelineHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  timelineTitle: { fontSize: 16, fontWeight: '800', color: C.slate900 },
  timelineCount: { fontSize: 12, color: C.slate400, fontWeight: '600' },

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
    paddingBottom: 20,
    paddingLeft: 4,
  },
  stopContentCurrent: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.blueBorder,
  },
  stopContentBoarding: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
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
    color: C.slate200,
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
});