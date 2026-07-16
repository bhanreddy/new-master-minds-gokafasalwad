import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, RefreshControl, Platform } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing
} from
  'react-native-reanimated';
import * as Haptics from '@/src/utils/haptics';
import { api } from '../../src/services/apiClient';
import {
  startDriverLocationUpdates,
  stopDriverLocationUpdates,
  postBusLocation,
  adaptDriverLocationSampling,
  flushQueuedBusLocations,
  setDriverNextStopTarget,
} from '../../src/services/driverLocationTask';
import { usePersistedSWR } from '../../src/hooks/usePersistedSWR';
import LogoLoader from '../../src/components/LogoLoader';
import DashboardHero from '../../src/components/DashboardHero';
import { useTheme } from '../../src/hooks/useTheme';

const PINK = '#EC4899';
const PINK_DARK = '#BE185D';
const PINK_GRADIENT: [string, string] = ['#EC4899', '#BE185D'];
const GREEN = '#10B981';
const RED = '#EF4444';
const HEARTBEAT_INTERVAL = 30000;
/** Auto-mark "arrived" when the bus is within this distance of the next stop. */
const AUTO_ARRIVE_RADIUS_KM = 0.15;
/** Auto-complete an arrived stop once the bus pulls this far away. Larger than
 *  the arrive radius (hysteresis) so a bus idling at the boundary can't flap. */
const AUTO_COMPLETE_EXIT_RADIUS_KM = 0.25;

/** Haversine distance in km. */
const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

type StopStatus = 'pending' | 'arrived' | 'completed' | 'skipped';

interface TripStop {
  id: string;
  stop_id: string;
  stop_name: string;
  stop_order: number;
  status: StopStatus;
  latitude?: number;
  longitude?: number;
  student_count: number;
  arrival_time?: string;
  departure_time?: string;
}

interface BusInfo {
  id: string;
  bus_no: string;
  capacity: number;
}

interface RouteInfo {
  id: string;
  name: string;
  direction: string;
  total_stops: number;
  bus_id?: string;
}

type TripLeg = 'morning' | 'evening';

/** Phase A calibration status for the selected route-leg (drives the badge). */
interface CalibrationInfo {
  trip_direction: string;
  is_calibrated: boolean;
  stops_total: number;
  stops_calibrated: number;
  segments_total: number;
  segments_learned: number;
  clean_trip_count: number;
}

/** Latest foreground GPS fix, attached to stop marks for calibration. */
type GpsFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  mocked: boolean;
  ts: number;
};
/** A fix older than this is not trustworthy as "where the stop is". */
const FIX_MAX_AGE_MS = 60_000;

const LEG_LABEL: Record<TripLeg, string> = {
  morning: 'Morning (pickup)',
  evening: 'Evening (drop-off)',
};

/* ─── Status Colors ─── */
const STATUS_CONFIG: Record<StopStatus, { bg: string; colorKey: 'info' | 'warning' | 'success' | 'danger' | 'textMuted'; icon: string; label: string; }> = {
  pending: { bg: '#F1F5F9', colorKey: 'textMuted', icon: 'ellipse-outline', label: 'Pending' },
  arrived: { bg: '#FEF3C7', colorKey: 'warning', icon: 'location', label: 'At Stop' },
  completed: { bg: '#DCFCE7', colorKey: 'success', icon: 'checkmark-circle', label: 'Done' },
  skipped: { bg: '#FEE2E2', colorKey: 'danger', icon: 'close-circle', label: 'Skipped' }
};

/* ════════════════════════════════════════════════════════════
   ████  DRIVER DASHBOARD  ████
   ════════════════════════════════════════════════════════════ */
export default function DriverDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();

  const PRIMARY = theme.colors.primary;
  const PRIMARY_DARK = theme.colors.primaryDark;
  const PRIMARY_GRADIENT: [string, string] = [theme.colors.primary, theme.colors.primaryDark];
  const GREEN = theme.colors.success;
  const RED = theme.colors.danger;

  const s = React.useMemo(() => getStyles(theme), [theme]);

  // Data state
  const [buses, setBuses] = useState<BusInfo[]>([]);
  const [selectedBus, setSelectedBus] = useState<BusInfo | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
  const [tripLeg, setTripLeg] = useState<TripLeg>('morning');
  const [stops, setStops] = useState<TripStop[]>([]);

  // Trip state
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [tripStartedAt, setTripStartedAt] = useState<Date | null>(null);
  const [elapsedMin, setElapsedMin] = useState(0);

  // UI state
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [locationSharingPaused, setLocationSharingPaused] = useState(false);

  const {
    data: driverBusData,
    loading: busDataLoading,
    isRefreshing: busDataRefreshing,
    refetch: refetchBusData,
  } = usePersistedSWR<any>({
    cacheKey: 'driver-my-bus',
    userId: user?.userId,
    ttlMs: 30_000,
    persist: true,
    revalidateOnMount: true,
    enabled: !!user?.userId,
    fetcher: () => api.get<any>('/transport/driver/my-bus'),
  });

  const loading = busDataLoading && !driverBusData;
  const tripControlsEnabled = !busDataRefreshing;

  // Refs
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const foregroundIntervalRef = useRef(5000);
  const foregroundRestartingRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoArrivedStopsRef = useRef<Set<string>>(new Set());
  const autoCompletedStopsRef = useRef<Set<string>>(new Set());
  const lastFixRef = useRef<GpsFix | null>(null);
  const [calibration, setCalibration] = useState<CalibrationInfo | null>(null);

  const displayName = user?.display_name || user?.first_name || 'Driver';
  const greeting = new Date().getHours() < 12 ? t('dashboard.good_morning', 'Good Morning') :
    new Date().getHours() < 17 ? t('dashboard.good_afternoon', 'Good Afternoon') : t('dashboard.good_evening', 'Good Evening');

  // Pulse animation
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isTracking) {
      pulse.value = withRepeat(
        withTiming(1.25, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1, true
      );
    } else { pulse.value = withTiming(1, { duration: 200 }); }
  }, [isTracking]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const inferTripLeg = (direction?: string | null): TripLeg => {
    if (direction === 'afternoon' || direction === 'evening') return 'evening';
    if (direction === 'morning') return 'morning';
    return new Date().getHours() >= 12 ? 'evening' : 'morning';
  };

  const resolveTripDirectionParam = (route: RouteInfo | null, leg: TripLeg) => {
    if (!route) return leg === 'evening' ? 'evening' : 'morning';
    if (route.direction === 'both') return leg === 'evening' ? 'evening' : 'morning';
    if (route.direction === 'afternoon' || route.direction === 'evening') return route.direction;
    return route.direction || 'morning';
  };

  const routesForSelectedBus = selectedBus
    ? routes.filter((r) => r.bus_id === selectedBus.id)
    : routes;

  /* ─── Apply driver's buses & routes from API payload ─── */
  const applyDriverPayload = useCallback(async (data: any) => {
    const busList: BusInfo[] = data.buses?.length ? data.buses : (data.bus ? [data.bus] : []);
    const routeList: RouteInfo[] = data.routes || [];
    setBuses(busList);
    setRoutes(routeList);

    const activeTrips: any[] = data.activeTrips?.length
      ? data.activeTrips
      : (data.activeTrip ? [data.activeTrip] : []);

    if (activeTrips.length > 0) {
      const active = activeTrips[0];
      const activeBus = busList.find((b) => b.id === active.bus_id) || busList[0] || null;
      setSelectedBus(activeBus);
      const activeRoute = routeList.find((r) => r.id === active.route_id) || null;
      if (activeRoute) {
        setSelectedRoute(activeRoute);
        setTripLeg(active.trip_direction === 'evening' || active.trip_direction === 'afternoon' ? 'evening' : 'morning');
      }
      setActiveTripId(active.id);
      setIsTracking(true);
      setTripStartedAt(new Date(active.started_at));
      await fetchTripStatus(active.id);
      // Resume GPS streaming after an app restart mid-trip — without this the
      // trip shows as tracking but no location ever reaches parents.
      if (activeBus) void startLocationTracking(activeBus.id);
    } else if (busList.length > 0) {
      const initialBus = busList[0];
      setSelectedBus(initialBus);
      const busRoutes = routeList.filter((r) => r.bus_id === initialBus.id);
      if (busRoutes.length > 0) {
        setSelectedRoute(busRoutes[0]);
        const leg = inferTripLeg(busRoutes[0].direction);
        setTripLeg(leg);
        await fetchRouteStops(busRoutes[0].id, leg);
      }
    }
  }, []);

  useEffect(() => {
    if (!driverBusData) return;
    void applyDriverPayload(driverBusData);
  }, [driverBusData, applyDriverPayload]);

  const refreshDriverData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchBusData();
    } finally {
      setRefreshing(false);
    }
  }, [refetchBusData]);

  /* ─── Fetch route stops (pre-trip) ─── */
  const fetchRouteStops = async (routeId: string, leg: TripLeg = tripLeg) => {
    try {
      const route = routes.find((r) => r.id === routeId) || selectedRoute;
      const tripDirection = resolveTripDirectionParam(route, leg);
      const data = await api.get<any[]>(`/transport/driver/route/${routeId}/stops?trip_direction=${tripDirection}`);
      setStops(data.map((s, idx) => ({
        id: '', stop_id: s.id, stop_name: s.name,
        stop_order: s.exec_order ?? idx + 1,
        status: 'pending' as StopStatus, latitude: s.latitude, longitude: s.longitude,
        student_count: s.student_count || 0
      })));
    } catch (err) { }
  };

  /* ─── Fetch trip status (during trip) ─── */
  const fetchTripStatus = async (tripId: string) => {
    try {
      const data = await api.get<any>(`/transport/trips/${tripId}/status`);
      setStops(data.stops.map((s: any) => ({
        id: s.id, stop_id: s.stop_id, stop_name: s.stop_name,
        stop_order: s.stop_order, status: s.status,
        latitude: s.latitude, longitude: s.longitude,
        student_count: Number(s.student_count) || 0,
        arrival_time: s.arrival_time, departure_time: s.departure_time
      })));
    } catch (err) { }
  };

  /* ─── Calibration status (Phase A badge) ─── */
  useEffect(() => {
    if (!selectedRoute?.id) { setCalibration(null); return; }
    let cancelled = false;
    api.get<CalibrationInfo>(`/transport/driver/route/${selectedRoute.id}/calibration?trip_direction=${tripLeg}`)
      .then((d) => { if (!cancelled) setCalibration(d); })
      .catch(() => { if (!cancelled) setCalibration(null); });
    return () => { cancelled = true; };
  }, [selectedRoute?.id, tripLeg, isTracking]);

  /** GPS fix payload for stop marks — only when fresh enough to trust. */
  const freshFixBody = () => {
    const fix = lastFixRef.current;
    if (!fix || Date.now() - fix.ts > FIX_MAX_AGE_MS) return {};
    return {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      is_mocked: fix.mocked,
    };
  };

  /* ─── Timer for elapsed time ─── */
  useEffect(() => {
    if (isTracking && tripStartedAt) {
      timerRef.current = setInterval(() => {
        setElapsedMin(Math.floor((Date.now() - tripStartedAt.getTime()) / 60000));
      }, 10000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, tripStartedAt]);

  /* ─── START TRIP ─── */
  const handleStartTrip = async () => {
    if (!selectedBus || !selectedRoute) return alertCompat('Error', 'Select a bus and route first.');
    if (selectedRoute.direction === 'both' && !tripLeg) {
      return alertCompat('Error', 'Choose Morning or Evening for this route.');
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setActionLoading(true);
    try {
      const tripDirection = resolveTripDirectionParam(selectedRoute, tripLeg);
      const data = await api.post<any>('/transport/trips/start', {
        route_id: selectedRoute.id,
        bus_id: selectedBus.id,
        trip_direction: tripDirection,
      });
      setActiveTripId(data.trip.id);
      setIsTracking(true);
      setTripStartedAt(new Date());
      setElapsedMin(0);
      await fetchTripStatus(data.trip.id);
      startLocationTracking(selectedBus.id);
    } catch (err: any) {
      alertCompat('Error', err?.message || 'Failed to start trip');
    } finally { setActionLoading(false); }
  };

  /* ─── END TRIP ─── */
  const handleEndTrip = async () => {
    alertCompat('End Trip', 'Are you sure you want to end this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip', style: 'destructive', onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setActionLoading(true);
          try {
            await api.post<any>(`/transport/trips/${activeTripId}/end`);
            setIsTracking(false);
            setActiveTripId(null);
            stopLocationTracking();
            await refreshDriverData();
          } catch (err: any) {
            alertCompat('Error', err?.message || 'Failed to end trip');
          } finally { setActionLoading(false); }
        }
      }]
    );
  };

  /* ─── ARRIVE AT STOP ─── */
  const handleArriveStop = async (stopId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoading(true);
    try {
      // Manual mark + fresh GPS fix = a calibration sample (Phase A).
      await api.post<any>(`/transport/trips/${activeTripId}/stops/${stopId}/arrive`, {
        ...freshFixBody(),
        source: 'manual',
      });
      await fetchTripStatus(activeTripId!);
    } catch (err: any) {
      alertCompat('Cannot Arrive', err?.message || 'Failed');
    } finally { setActionLoading(false); }
  };

  /* ─── COMPLETE STOP ─── */
  const handleCompleteStop = async (stopId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoading(true);
    try {
      await api.post<any>(`/transport/trips/${activeTripId}/stops/${stopId}/complete`);
      await fetchTripStatus(activeTripId!);
    } catch (err: any) {
      alertCompat('Cannot Complete', err?.message || 'Failed');
    } finally { setActionLoading(false); }
  };

  /* ─── SKIP STOP ─── */
  const handleSkipStop = async (stopId: string) => {
    alertCompat('Skip Stop', 'Are you sure you want to skip this stop?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Skip', style: 'destructive', onPress: async () => {
          Haptics.selectionAsync();
          setActionLoading(true);
          try {
            await api.post<any>(`/transport/trips/${activeTripId}/stops/${stopId}/skip`);
            await fetchTripStatus(activeTripId!);
          } catch (err: any) { alertCompat('Cannot Skip', err?.message || 'Failed'); } finally { setActionLoading(false); }
        }
      }]
    );
  };

  /* ─── Geofence auto-advance (hands-free) ───
     One long-lived GPS callback drives the whole stop sequence with zero driver
     taps: entering the arrive radius marks a stop 'arrived'; leaving the larger
     exit radius marks it 'completed' — the bus pulling away IS the driver's
     confirmation that boarding is done. Kept in a render-refreshed ref so the
     callback always sees current trip/stop state. Manual buttons stay as
     overrides for GPS drift. */
  const autoAdvanceRef = useRef<(lat: number, lng: number) => void>(() => {});
  autoAdvanceRef.current = (lat: number, lng: number) => {
    if (!activeTripId) return;

    // 1. Complete the stop we're at, once the bus has pulled away from it.
    const arrived = stops.find((st) => st.status === 'arrived');
    if (arrived && arrived.latitude != null && arrived.longitude != null) {
      const pulledAway =
        distanceKm(lat, lng, Number(arrived.latitude), Number(arrived.longitude)) >= AUTO_COMPLETE_EXIT_RADIUS_KM;
      if (pulledAway && !autoCompletedStopsRef.current.has(arrived.stop_id)) {
        autoCompletedStopsRef.current.add(arrived.stop_id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        api.post<any>(`/transport/trips/${activeTripId}/stops/${arrived.stop_id}/complete`)
          .then(() => fetchTripStatus(activeTripId))
          .catch(() => { autoCompletedStopsRef.current.delete(arrived.stop_id); });
        return; // one transition per GPS fix keeps stop ordering strict
      }
    }

    // 2. Arrive at the next pending stop as the bus reaches it.
    const next = stops.find((st) => st.status === 'pending');
    if (!next || next.latitude == null || next.longitude == null) return;
    if (autoArrivedStopsRef.current.has(next.stop_id)) return;
    if (distanceKm(lat, lng, Number(next.latitude), Number(next.longitude)) > AUTO_ARRIVE_RADIUS_KM) return;
    autoArrivedStopsRef.current.add(next.stop_id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Device-geofence mark: provenance is 'geofence', so the server excludes
    // it from geo calibration (it can fire up to 150m before the stop).
    api.post<any>(`/transport/trips/${activeTripId}/stops/${next.stop_id}/arrive`, {
      latitude: lat, longitude: lng, source: 'geofence',
    })
      .then(() => fetchTripStatus(activeTripId))
      .catch(() => { autoArrivedStopsRef.current.delete(next.stop_id); });
  };

  /* ─── GPS Tracking ───
     Position streaming to the backend lives in the background task
     (driverLocationTask), which survives screen-off and app-background via a
     foreground service. The foreground watch below only feeds the on-screen
     speedometer and the geofence auto-arrive. */
  const startLocationTracking = async (busId: string) => {
    // Web is not the driver's real platform: browser geolocation is unreliable,
    // expo-location's web watch cleanup throws, and background tracking is
    // native-only. Trips remain fully manageable on web without GPS.
    if (Platform.OS === 'web') return;

    let permGranted = false;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      permGranted = status === 'granted';
    } catch {
      // Permission API unavailable — treat as denied, don't crash trip start.
    }
    if (!permGranted) {
      setLocationSharingPaused(true);
      return alertCompat(
        'Location sharing paused',
        'Allow Precise Location and “Allow all the time”. On Xiaomi, Oppo, Vivo, and Samsung also set this app to Unrestricted battery use so parents keep seeing the bus when the screen is off.',
      );
    }

    let backgroundOk = true;
    try {
      await startDriverLocationUpdates(busId);
      setLocationSharingPaused(false);
    } catch {
      // Background updates unavailable (e.g. old build) — fall back to
      // posting from the foreground watch so tracking still works.
      backgroundOk = false;
    }

    const attachForegroundWatch = async (intervalMs: number) => {
      if (locationSubRef.current) return;
      foregroundIntervalRef.current = intervalMs;
      try {
        locationSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: intervalMs <= 5000 ? Location.Accuracy.High : Location.Accuracy.Balanced,
            timeInterval: intervalMs,
            distanceInterval: intervalMs <= 5000 ? 10 : 50,
          },
          (loc) => {
            const spd = loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed * 3.6 : 0;
            setSpeed(spd);
            lastFixRef.current = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? null,
              mocked: loc.mocked || false,
              ts: Date.now(),
            };
            if (!backgroundOk) void postBusLocation(busId, loc);
            autoAdvanceRef.current(loc.coords.latitude, loc.coords.longitude);

            // Expo re-registers the existing background task with new options;
            // Android's foreground service remains attached. Mirror the same
            // cadence in this UI watch so it does not keep GPS artificially fast.
            void adaptDriverLocationSampling(loc).then((nextInterval) => {
              if (nextInterval === foregroundIntervalRef.current || foregroundRestartingRef.current) return;
              foregroundRestartingRef.current = true;
              try { locationSubRef.current?.remove(); } catch { /* no-op */ }
              locationSubRef.current = null;
              void attachForegroundWatch(nextInterval).finally(() => {
                foregroundRestartingRef.current = false;
              });
            }).catch(() => { /* background stream remains on its last safe mode */ });
          }
        );
      } catch {
        // Foreground watch unavailable — the background task still streams.
      }
    };
    await attachForegroundWatch(5000);

    if (!heartbeatRef.current) {
      heartbeatRef.current = setInterval(async () => {
        try { await api.post(`/transport/buses/${busId}/heartbeat`); } catch { }
      }, HEARTBEAT_INTERVAL);
    }
  };

  const stopLocationTracking = () => {
    void stopDriverLocationUpdates();
    if (locationSubRef.current) {
      try { locationSubRef.current.remove(); } catch { /* web cleanup no-op */ }
      locationSubRef.current = null;
    }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    autoArrivedStopsRef.current.clear();
    autoCompletedStopsRef.current.clear();
  };

  useEffect(() => () => { stopLocationTracking(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  /* ─── Derived state ─── */
  const currentStop = stops.find((s) => s.status === 'pending' || s.status === 'arrived');
  const completedCount = stops.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const progressPercent = stops.length > 0 ? completedCount / stops.length * 100 : 0;

  useEffect(() => {
    if (!isTracking || currentStop?.latitude == null || currentStop?.longitude == null) {
      void setDriverNextStopTarget(null);
      return;
    }
    void setDriverNextStopTarget({
      latitude: Number(currentStop.latitude),
      longitude: Number(currentStop.longitude),
    });
  }, [isTracking, currentStop?.stop_id, currentStop?.latitude, currentStop?.longitude]);

  useEffect(() => {
    if (!isTracking || !selectedBus?.id || Platform.OS === 'web') return;
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void flushQueuedBusLocations(selectedBus.id).catch(() => {});
      }
    });
  }, [isTracking, selectedBus?.id]);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <ScreenLayout>
        <StudentHeader title="Dashboard" menuUserType="driver" />
        <View style={s.center}><LogoLoader size={60} color={PRIMARY} /></View>
      </ScreenLayout>);

  }

  return (
    <ScreenLayout>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
      <StudentHeader title={t('driver_ui.dashboard', 'Dashboard')} menuUserType="driver" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDriverData} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>

        {refreshing &&
          <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
            <LogoLoader size={30} />
          </View>
        }
        {/* ═══════ Greeting panel ═══════ */}
        <View style={{ marginBottom: 16 }}>
          <DashboardHero
            eyebrow={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
            greeting={greeting}
            name={displayName}
          />
        </View>

        {/* ═══════ Trip Tracking Card ═══════ */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={s.heroWrap}>
          <LinearGradient colors={PRIMARY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <View style={[s.heroDecor, { top: -30, right: -30, width: 120, height: 120 }]} />
            <View style={[s.heroDecor, { bottom: -15, left: -15, width: 60, height: 60 }]} />
            <View style={s.heroTop}>
              <View>
                <Text style={s.heroGreet}>{t('driver_ui.on_duty', 'On duty')}</Text>
                <Text style={s.heroName}>{t('driver_ui.todays_trip', 'Today\'s Trip')}</Text>
              </View>
              <View style={s.heroBusPill}>
                <Ionicons name="bus" size={14} color="#FFF" />
                <Text style={s.heroBusText}>{selectedBus?.bus_no || buses[0]?.bus_no || t('driver_ui.no_bus', 'No Bus')}</Text>
              </View>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroBottom}>
              <View style={s.heroMini}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={s.heroMiniText}>{isTracking ? `${elapsedMin} min` : t('driver_ui.ready', 'Ready')}</Text>
              </View>
              <View style={s.heroMini}>
                <Ionicons name="speedometer-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={s.heroMiniText}>{isTracking ? `${speed.toFixed(0)} km/h` : '—'}</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: isTracking ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.15)' }]}>
                <Animated.View style={[s.statusDot, { backgroundColor: locationSharingPaused ? '#FCA5A5' : isTracking ? GREEN : '#FCD34D' }, isTracking && !locationSharingPaused && pulseStyle]} />
                <Text style={s.statusPillText}>{locationSharingPaused ? 'LOCATION PAUSED' : isTracking ? t('driver_ui.on_trip', 'ON TRIP') : t('driver_ui.idle', 'IDLE')}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
        {isTracking && locationSharingPaused &&
          <View style={{ marginTop: -8, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3' }}>
            <Text style={{ color: '#9F1239', fontWeight: '700' }}>Location sharing is paused</Text>
            <Text style={{ color: '#9F1239', marginTop: 3 }}>Allow Precise + background location, then set battery use to Unrestricted. The trip remains open; GPS restarts when you return.</Text>
          </View>
        }
        {/* ═══════ No Bus State ═══════ */}
        {!selectedBus && buses.length === 0 &&
          <Animated.View entering={FadeInDown.delay(150).duration(500)} style={s.emptyCard}>
            <View style={s.emptyIcon}><Ionicons name="bus-outline" size={36} color="#CBD5E1" /></View>
            <Text style={s.emptyTitle}>{t('driver_ui.no_bus_assigned', 'No Bus Assigned')}</Text>
            <Text style={s.emptySub}>{t('driver_ui.contact_admin_bus', 'Contact admin to get a bus assigned to you.')}</Text>
          </Animated.View>
        }
        {/* ═══════ Bus Selector (multi-bus drivers) ═══════ */}
        {buses.length > 1 && !isTracking &&
          <Animated.View entering={FadeInDown.delay(140).duration(500)}>
            <View style={s.secHeader}>
              <View style={s.secIconBox}><Ionicons name="bus" size={14} color={PRIMARY} /></View>
              <Text style={s.secTitle}>{t('driver_ui.select_bus', 'Select Bus')}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.routeScroll}>
              {buses.map((b) =>
                <TouchableOpacity
                  key={b.id}
                  style={[s.routeChip, selectedBus?.id === b.id && s.routeChipActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedBus(b);
                    const busRoutes = routes.filter((r) => r.bus_id === b.id);
                    if (busRoutes.length > 0) {
                      setSelectedRoute(busRoutes[0]);
                      setTripLeg(inferTripLeg(busRoutes[0].direction));
                      fetchRouteStops(busRoutes[0].id, inferTripLeg(busRoutes[0].direction));
                    } else {
                      setSelectedRoute(null);
                      setStops([]);
                    }
                  }}>

                  <Ionicons name="bus-outline" size={14}
                    color={selectedBus?.id === b.id ? '#FFF' : PRIMARY} />
                  <Text style={[s.routeChipText, selectedBus?.id === b.id && { color: '#FFF' }]}>
                    {b.bus_no}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        }
        {/* ═══════ Route Selector (pre-trip) ═══════ */}
        {selectedBus && !isTracking && routesForSelectedBus.length > 0 &&
          <Animated.View entering={FadeInDown.delay(150).duration(500)}>
            <View style={s.secHeader}>
              <View style={s.secIconBox}><Ionicons name="map" size={14} color={PRIMARY} /></View>
              <Text style={s.secTitle}>{t('driver_ui.select_route', 'Select Route')}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.routeScroll}>
              {routesForSelectedBus.map((r) =>
                <TouchableOpacity
                  key={r.id}
                  style={[s.routeChip, selectedRoute?.id === r.id && s.routeChipActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedRoute(r);
                    const leg = inferTripLeg(r.direction);
                    setTripLeg(leg);
                    fetchRouteStops(r.id, leg);
                  }}>

                  <Ionicons name="navigate-outline" size={14}
                    color={selectedRoute?.id === r.id ? '#FFF' : PRIMARY} />
                  <Text style={[s.routeChipText, selectedRoute?.id === r.id && { color: '#FFF' }]}>
                    {r.name}
                  </Text>
                  <Text style={[s.routeChipDir, selectedRoute?.id === r.id && { color: 'rgba(255,255,255,0.7)' }]}>
                    {r.direction}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            {selectedRoute?.direction === 'both' &&
              <View style={s.legRow}>
                {(['morning', 'evening'] as TripLeg[]).map((leg) =>
                  <TouchableOpacity
                    key={leg}
                    style={[s.legChip, tripLeg === leg && s.legChipActive]}
                    onPress={() => {
                      setTripLeg(leg);
                      if (selectedRoute) fetchRouteStops(selectedRoute.id, leg);
                    }}>

                    <Text style={[s.legChipText, tripLeg === leg && { color: '#FFF' }]}>
                      {leg === 'morning' ? t('driver_ui.morning_pickup', 'Morning (pickup)') : t('driver_ui.evening_dropoff', 'Evening (drop-off)')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          </Animated.View>
        }
        {/* ═══════ Trip Progress Bar ═══════ */}
        {isTracking &&
          <Animated.View entering={FadeInDown.delay(150).duration(500)} style={s.progressCard}>
            <View style={s.progressHeader}>
              <Text style={s.progressTitle}>{t('driver_ui.trip_progress', 'Trip Progress')}</Text>
              <Text style={s.progressCount}>{completedCount}/{stops.length} {t('driver_ui.stops', 'stops')}</Text>
            </View>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={s.progressRoute}>
              {selectedRoute?.name} • {isTracking ? resolveTripDirectionParam(selectedRoute, tripLeg) : selectedRoute?.direction}
            </Text>
          </Animated.View>
        }
        {/* ═══════ Calibration badge (Phase A) ═══════ */}
        {selectedRoute && calibration && stops.length > 0 &&
          <Animated.View
            entering={FadeInDown.delay(180).duration(400)}
            style={[s.calibCard, calibration.is_calibrated && s.calibCardDone]}>
            <Ionicons
              name={calibration.is_calibrated ? 'checkmark-circle' : 'compass-outline'}
              size={18}
              color={calibration.is_calibrated ? GREEN : '#B45309'}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.calibTitle, calibration.is_calibrated && { color: '#065F46' }]}>
                {calibration.is_calibrated
                  ? t('driver_ui.route_calibrated', 'Route calibrated')
                  : t('driver_ui.calibrating_route', 'Calibrating route') +
                    ` · trip ${Math.min(calibration.clean_trip_count + 1, 2)} of 2`}
              </Text>
              <Text style={[s.calibSub, calibration.is_calibrated && { color: '#047857' }]}>
                {calibration.is_calibrated
                  ? t('driver_ui.calibrated_sub', 'Stop locations and timings learned from your trips')
                  : t('driver_ui.calibrating_sub', 'Mark each stop on arrival — GPS learns stop locations and timings')}
              </Text>
            </View>
          </Animated.View>
        }
        {/* ═══════ Stop List ═══════ */}
        {stops.length > 0 &&
          <Animated.View entering={FadeInUp.delay(200).duration(500)}>
            <View style={s.secHeader}>
              <View style={[s.secIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="list" size={14} color={GREEN} />
              </View>
              <Text style={s.secTitle}>{isTracking ? t('driver_ui.stop_execution', 'Stop Execution') : t('driver_ui.route_stops', 'Route Stops')}</Text>
            </View>
            {stops.map((stop, idx) => {
              const cfg = STATUS_CONFIG[stop.status];
              const isCurrent = currentStop?.stop_id === stop.stop_id;
              const isLast = idx === stops.length - 1;

              return (
                <Animated.View
                  key={stop.stop_id}
                  entering={FadeInDown.delay(250 + idx * 60).duration(400)}
                  style={[s.stopCard, isCurrent && s.stopCardCurrent]}>

                  {/* Timeline connector */}
                  <View style={s.timeline}>
                    <View style={[s.timelineDot, { backgroundColor: cfg.colorKey === 'textMuted' ? theme.colors.textMuted : theme.colors[cfg.colorKey] }]}>
                      <Ionicons name={cfg.icon as any} size={12} color="#FFF" />
                    </View>
                    {!isLast && <View style={[s.timelineLine, {
                      backgroundColor: stop.status === 'completed' ? GREEN : '#E2E8F0'
                    }]} />}
                  </View>
                  {/* Stop Info */}
                  <View style={s.stopContent}>
                    <View style={s.stopTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stopOrder}>{t('driver_ui.stop', 'Stop')} {stop.stop_order}</Text>
                        <Text style={s.stopName}>{stop.stop_name}</Text>
                      </View>
                      <View style={[s.stopBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[s.stopBadgeText, { color: cfg.colorKey === 'textMuted' ? theme.colors.textMuted : theme.colors[cfg.colorKey] }]}>{t(`driver_ui.${stop.status}`, cfg.label)}</Text>
                      </View>
                    </View>
                    {stop.student_count > 0 &&
                      <View style={s.studentRow}>
                        <Ionicons name="people" size={12} color="#94A3B8" />
                        <Text style={s.studentText}>{stop.student_count} student{stop.student_count > 1 ? 's' : ''}</Text>
                      </View>
                    }
                    {/* Action Buttons (only during active trip, only for current stop) */}
                    {isTracking && isCurrent &&
                      <View style={s.stopActions}>
                        {stop.status === 'pending' &&
                          <>
                            <TouchableOpacity
                              style={[s.stopBtn, { backgroundColor: '#FEF3C7' }]}
                              onPress={() => handleArriveStop(stop.stop_id)}
                              disabled={actionLoading || !tripControlsEnabled}>

                              <Ionicons name="location" size={14} color="#D97706" />
                              <Text style={[s.stopBtnText, { color: '#D97706' }]}>{t('driver_ui.arrive', 'Arrive')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.stopBtn, { backgroundColor: '#FEE2E2' }]}
                              onPress={() => handleSkipStop(stop.stop_id)}
                              disabled={actionLoading || !tripControlsEnabled}>

                              <Ionicons name="close-circle-outline" size={14} color={RED} />
                              <Text style={[s.stopBtnText, { color: RED }]}>{t('driver_ui.skip', 'Skip')}</Text>
                            </TouchableOpacity>
                          </>
                        }
                        {stop.status === 'arrived' &&
                          <TouchableOpacity
                            style={[s.stopBtn, { backgroundColor: '#DCFCE7', flex: 1 }]}
                            onPress={() => handleCompleteStop(stop.stop_id)}
                            disabled={actionLoading || !tripControlsEnabled}>

                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text style={[s.stopBtnText, { color: '#059669' }]}>{t('driver_ui.complete_stop', 'Complete Stop')}</Text>
                          </TouchableOpacity>
                        }
                      </View>
                    }
                  </View>
                </Animated.View>);

            })}
          </Animated.View>
        }
        {/* ═══════ Trip Control ═══════ */}
        {selectedBus &&
          <Animated.View entering={FadeInUp.delay(400).duration(500)} style={s.controlSection}>
            {!isTracking ?
              <TouchableOpacity
                style={s.startWrap}
                onPress={handleStartTrip}
                activeOpacity={0.8}
                disabled={actionLoading || !selectedRoute || !tripControlsEnabled}>

                <LinearGradient colors={PRIMARY_GRADIENT} style={s.startGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {actionLoading ?
                    <LogoLoader color="#FFF" /> :

                    <>
                      <Ionicons name="play" size={22} color="#FFF" />
                      <Text style={s.ctrlText}>{t('driver_ui.start_trip', 'START TRIP').toUpperCase()}</Text>
                    </>
                  }
                </LinearGradient>
              </TouchableOpacity> :

              <TouchableOpacity style={s.endBtn} onPress={handleEndTrip} activeOpacity={0.8} disabled={actionLoading || !tripControlsEnabled}>
                {actionLoading ? <LogoLoader color="#FFF" /> :
                  <>
                    <Ionicons name="stop" size={22} color="#FFF" />
                    <Text style={s.ctrlText}>{t('driver_ui.end_trip', 'END TRIP').toUpperCase()}</Text>
                  </>
                }
              </TouchableOpacity>
            }
          </Animated.View>
        }
        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenLayout>);

}

/* ════════════════════════════ STYLES ════════════════════════════ */
const getStyles = (theme: any) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },

  /* Hero */
  heroWrap: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  hero: { padding: 24, overflow: 'hidden' },
  heroDecor: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroGreet: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  heroName: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  heroBusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroBusText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 18 },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroMini: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMiniText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  /* Empty */
  emptyCard: {
    alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 28, marginBottom: 24,
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 2,
    borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.6)'
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  /* Sections */
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  secIconBox: {
    width: 32, height: 32, borderRadius: 12, backgroundColor: '#FDF2F8',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 1
  },
  secTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', letterSpacing: -0.3 },

  /* Route selector */
  routeScroll: { marginBottom: 24 },
  routeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: 16, marginRight: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
  },
  routeChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primaryDark, shadowOpacity: 0.15, shadowColor: theme.colors.primary },
  routeChipText: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  routeChipDir: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'capitalize' },
  legRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  legChip: {
    flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
  },
  legChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primaryDark, shadowOpacity: 0.15, shadowColor: theme.colors.primary },
  legChipText: { fontSize: 14, fontWeight: '800', color: '#475569' },

  /* Progress */
  calibCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 16, padding: 14, marginBottom: 16,
  },
  calibCardDone: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  calibTitle: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  calibSub: { fontSize: 11, color: '#B45309', marginTop: 2, fontWeight: '500' },
  progressCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, marginBottom: 24,
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 3,
    borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.6)'
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' },
  progressTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', letterSpacing: -0.3 },
  progressCount: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  progressBarBg: { height: 12, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  progressBarFill: { height: '100%', backgroundColor: theme.colors.success, borderRadius: 6 },
  progressRoute: { fontSize: 13, color: '#64748B', fontWeight: '600' },

  /* Stop Cards */
  stopCard: {
    flexDirection: 'row', marginBottom: 8, padding: 6,
    backgroundColor: 'transparent', borderRadius: 20
  },
  stopCardCurrent: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 12,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 4,
    borderWidth: 1, borderColor: '#FBCFE8'
  },
  timeline: { width: 40, alignItems: 'center', marginRight: 12 },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2
  },
  timelineLine: { width: 3, flex: 1, marginVertical: 4, borderRadius: 1.5 },
  stopContent: { flex: 1, paddingBottom: 16 },
  stopTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  stopOrder: { fontSize: 11, color: '#64748B', fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  stopName: { fontSize: 17, fontWeight: '800', color: '#1E293B', letterSpacing: -0.3 },
  stopBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  stopBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  studentText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  stopActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 5, flex: 1
  },
  stopBtnText: { fontSize: 13, fontWeight: '600' },

  /* Control */
  controlSection: { marginTop: 12, marginBottom: 12 },
  startWrap: {
    borderRadius: 36, overflow: 'hidden',
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 8
  },
  startGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 64, gap: 12, borderRadius: 36
  },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 64, borderRadius: 36, backgroundColor: theme.colors.danger, gap: 12,
    shadowColor: theme.colors.danger, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 8
  },
  ctrlText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 1.5 }
});
