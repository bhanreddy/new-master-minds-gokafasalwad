/**
 * LiveRouteTracker — realtime schematic bus tracker.
 *
 * Deliberately does NOT use MapLibre: that wrapper is a stub on web
 * (MapWrapper.web.tsx), so a map-based tracker can't look live on the web
 * build. This renders the route + a gliding bus with plain react-native-svg
 * (route line + stops, drawn once) plus Reanimated overlay views for the bus
 * marker and pulse — the motion runs on the UI thread, so it holds 60fps on
 * low-end Android and works identically on web and native.
 *
 * Bus position priority: real GPS fix → else the last completed stop, so the
 * tracker still animates from checkpoint data alone when the driver's GPS is
 * sparse. Nothing here is fabricated: with no data it shows a waiting state.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

export type TrackerStop = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
};

type Props = {
  stops: TrackerStop[];
  bus: { latitude: number; longitude: number; heading?: number | null } | null;
  boardingStopId?: string | null;
  isFresh?: boolean;
  etaMinutes?: number | null;
  height?: number;
  mode?: 'live' | 'preview';
};

const PAD = 30;
const BUS = 34;

const served = (s: string) => s === 'completed' || s === 'skipped';

export default function LiveRouteTracker({
  stops,
  bus,
  boardingStopId,
  isFresh = true,
  etaMinutes,
  height = 230,
  mode = 'live',
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [w, setW] = useState(0);

  const coordStops = useMemo(
    () => stops.filter((s) => s.latitude != null && s.longitude != null),
    [stops],
  );

  const projectionCoords = useMemo(() => {
    const coords = coordStops.map((stop) => ({
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
    }));
    // A one-stop route can still show the real approach line from the bus to
    // that stop. Scheduled preview never invents a GPS coordinate here.
    if (coords.length === 1 && bus) {
      coords.push({ latitude: bus.latitude, longitude: bus.longitude });
    }
    return coords;
  }, [coordStops, bus]);

  // Stable projection frame comes from route stops. A one-stop live route also
  // includes the real bus fix so the approach can be drawn.
  const project = useMemo(() => {
    if (w === 0 || projectionCoords.length < 2) return null;
    const lats = projectionCoords.map((s) => s.latitude);
    const lngs = projectionCoords.map((s) => s.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const k = Math.cos((midLat * Math.PI) / 180) || 1; // lng→x aspect correction
    const axMin = minLng * k, axMax = maxLng * k;
    const spanX = Math.max(axMax - axMin, 1e-6);
    const spanY = Math.max(maxLat - minLat, 1e-6);
    const availW = w - 2 * PAD, availH = height - 2 * PAD;
    const s = Math.min(availW / spanX, availH / spanY);
    const ox = PAD + (availW - spanX * s) / 2;
    const oy = PAD + (availH - spanY * s) / 2;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    return {
      x: (lng: number) => clamp(ox + (lng * k - axMin) * s, 6, w - 6),
      y: (lat: number) => clamp(height - oy - (lat - minLat) * s, 6, height - 6),
    };
  }, [w, height, projectionCoords]);

  const points = useMemo(() => {
    if (!project) return [];
    return coordStops.map((s) => ({
      ...s,
      px: project.x(Number(s.longitude)),
      py: project.y(Number(s.latitude)),
    }));
  }, [project, coordStops]);

  // Where to draw the bus: real GPS, else the last completed stop.
  const busTarget = useMemo(() => {
    if (!project) return null;
    if (bus) return { x: project.x(bus.longitude), y: project.y(bus.latitude), heading: bus.heading };
    const done = [...coordStops].reverse().find((s) => s.status === 'completed');
    const at = done || coordStops[0];
    if (!at) return null;
    return { x: project.x(Number(at.longitude)), y: project.y(Number(at.latitude)), heading: null };
  }, [project, bus, coordStops]);

  const displayRoutePoints = useMemo(() => {
    if (points.length >= 2) return points.map((point) => ({ px: point.px, py: point.py }));
    if (mode === 'live' && busTarget && points.length === 1) {
      return [{ px: busTarget.x, py: busTarget.y }, { px: points[0].px, py: points[0].py }];
    }
    return [];
  }, [points, busTarget, mode]);

  // ── Bus glide + heading (UI thread) ──
  const bx = useSharedValue(0);
  const by = useSharedValue(0);
  const brot = useSharedValue(0);
  const seeded = useRef(false);
  const prev = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!busTarget) return;
    let rot = 0;
    if (busTarget.heading != null) {
      rot = busTarget.heading;
    } else if (prev.current) {
      const dx = busTarget.x - prev.current.x;
      const dy = busTarget.y - prev.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) rot = (Math.atan2(dx, -dy) * 180) / Math.PI;
      else rot = brot.value;
    }
    if (!seeded.current) {
      bx.value = busTarget.x;
      by.value = busTarget.y;
      brot.value = rot;
      seeded.current = true;
    } else {
      bx.value = withTiming(busTarget.x, { duration: 1200, easing: Easing.inOut(Easing.ease) });
      by.value = withTiming(busTarget.y, { duration: 1200, easing: Easing.inOut(Easing.ease) });
      brot.value = withTiming(rot, { duration: 600 });
    }
    prev.current = { x: busTarget.x, y: busTarget.y };
  }, [busTarget, brot, bx, by]);

  // ── Pulse (UI thread, only while fresh) ──
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isFresh) {
      pulse.value = withRepeat(withTiming(2.4, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    } else {
      pulse.value = withTiming(1);
    }
  }, [isFresh, pulse]);

  const busWrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bx.value - BUS / 2 }, { translateY: by.value - BUS / 2 }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${brot.value}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 2.4], [0.45, 0]),
  }));

  const accent = theme.colors.primary;
  const fresh = isFresh ? accent : '#94A3B8';

  // Traveled polyline (through served stops + the first live/next stop).
  const traveledPts = useMemo(() => {
    const out: typeof points = [];
    for (const p of points) {
      out.push(p);
      if (!served(p.status)) break;
    }
    return out.length >= 2 ? out : [];
  }, [points]);

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {project && displayRoutePoints.length >= 2 ? (
        <>
          {/* Muted road geometry gives the schematic the visual hierarchy of a map. */}
          <Svg width={w} height={height} style={StyleSheet.absoluteFill}>
            <Line x1={-20} y1={height * 0.2} x2={w + 20} y2={height * 0.43} stroke="#E2E8F0" strokeWidth={16} />
            <Line x1={w * 0.18} y1={-20} x2={w * 0.42} y2={height + 20} stroke="#E7ECF1" strokeWidth={11} />
            <Line x1={w * 0.72} y1={-20} x2={w * 0.61} y2={height + 20} stroke="#E7ECF1" strokeWidth={9} />
            <Line x1={-20} y1={height * 0.78} x2={w + 20} y2={height * 0.62} stroke="#E2E8F0" strokeWidth={13} />
          </Svg>
          <Svg width={w} height={height}>
            {/* Full route */}
            <Polyline
              points={displayRoutePoints.map((p) => `${p.px},${p.py}`).join(' ')}
              fill="none"
              stroke="#CBD5E1"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Traveled portion */}
            {traveledPts.length >= 2 && (
              <Polyline
                points={traveledPts.map((p) => `${p.px},${p.py}`).join(' ')}
                fill="none"
                stroke={accent}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
            )}
            {/* Stops */}
            {points.map((p) => {
              const isBoarding = p.id === boardingStopId;
              const done = served(p.status);
              const fill = done ? '#059669' : isBoarding ? accent : '#FFFFFF';
              const stroke = done ? '#059669' : isBoarding ? accent : '#94A3B8';
              return (
                <React.Fragment key={p.id}>
                  {isBoarding && <Circle cx={p.px} cy={p.py} r={11} fill={accent} opacity={0.15} />}
                  <Circle cx={p.px} cy={p.py} r={isBoarding ? 7 : 5} fill={fill} stroke={stroke} strokeWidth={2.5} />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Bus marker (Reanimated overlay) */}
          {busTarget && (
            <Animated.View pointerEvents="none" style={[styles.busWrap, busWrapStyle]}>
              <Animated.View style={[styles.pulseRing, { backgroundColor: fresh }, pulseStyle]} />
              {(bus?.heading != null || prev.current) && (
                <Animated.View style={[styles.arrowWrap, arrowStyle]}>
                  <View style={[styles.arrow, { borderBottomColor: fresh }]} />
                </Animated.View>
              )}
              <View style={[styles.busBadge, { backgroundColor: fresh, shadowColor: fresh }]}>
                <Ionicons name="bus" size={15} color="#FFFFFF" />
              </View>
            </Animated.View>
          )}

          {/* Your-stop label pill */}
          <View style={[styles.legend, { borderColor: accent }]}>
            <View style={[styles.legendDot, { backgroundColor: accent }]} />
            <Text style={[styles.legendText, { color: accent }]}>{t('busTracker.your_stop')}</Text>
          </View>
        </>
      ) : (
        mode === 'preview' ? (
          <View style={styles.previewFallback}>
            <Svg width={w || 640} height={height} style={StyleSheet.absoluteFill}>
              <Line x1={-20} y1={height * 0.25} x2={(w || 640) + 20} y2={height * 0.48} stroke="#E2E8F0" strokeWidth={18} />
              <Line x1={(w || 640) * 0.28} y1={-20} x2={(w || 640) * 0.46} y2={height + 20} stroke="#E7ECF1" strokeWidth={11} />
              <Line x1={(w || 640) * 0.76} y1={-20} x2={(w || 640) * 0.61} y2={height + 20} stroke="#E7ECF1" strokeWidth={9} />
              <Polyline
                points={`${(w || 640) * 0.2},${height * 0.7} ${(w || 640) * 0.45},${height * 0.55} ${(w || 640) * 0.76},${height * 0.34}`}
                fill="none"
                stroke="#94A3B8"
                strokeWidth={5}
                strokeDasharray="8 8"
                strokeLinecap="round"
              />
              <Circle cx={(w || 640) * 0.76} cy={height * 0.34} r={11} fill={accent} opacity={0.16} />
              <Circle cx={(w || 640) * 0.76} cy={height * 0.34} r={7} fill={accent} stroke="#FFFFFF" strokeWidth={2} />
            </Svg>
            <View style={[styles.previewBus, { backgroundColor: '#111827' }]}>
              <Ionicons name="bus" size={17} color="#FFFFFF" />
            </View>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>{t('busTracker.route_preview')}</Text>
            </View>
            <View style={styles.previewStopLabel}>
              <Text style={[styles.previewStopText, { color: accent }]} numberOfLines={1}>
                {stops.find((stop) => stop.id === boardingStopId)?.name || t('busTracker.your_stop_fallback')}
              </Text>
            </View>
          </View>
        ) : (
          // Graceful live fallback when the route has no stop coordinates.
          <View style={styles.fallback}>
            <View style={[styles.fallbackPulseWrap]}>
              <Animated.View style={[styles.pulseRing, { backgroundColor: fresh, position: 'absolute' }, pulseStyle]} />
              <View style={[styles.busBadge, { backgroundColor: fresh, shadowColor: fresh }]}>
                <Ionicons name="bus" size={16} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.fallbackTitle}>
              {isFresh ? t('busTracker.live_gps_active') : t('busTracker.waiting_gps_signal')}
            </Text>
            <Text style={styles.fallbackSub}>
              {etaMinutes != null
                ? etaMinutes === 0
                  ? t('busTracker.arriving_at_stop')
                  : t('busTracker.eta_to_stop', { min: etaMinutes })
                : t('busTracker.stops_coords_needed')}
            </Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  busWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BUS,
    height: BUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: BUS,
    height: BUS,
    borderRadius: BUS / 2,
  },
  busBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  arrowWrap: {
    position: 'absolute',
    width: BUS,
    height: BUS,
    alignItems: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  legend: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '700' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  previewFallback: {
    flex: 1,
    overflow: 'hidden',
  },
  previewBus: {
    position: 'absolute',
    left: '18%',
    top: '64%',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 5,
  },
  previewBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#64748B' },
  previewStopLabel: {
    position: 'absolute',
    right: '18%',
    top: '23%',
    maxWidth: 160,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  previewStopText: { fontSize: 11, fontWeight: '800' },
  fallbackPulseWrap: {
    width: BUS,
    height: BUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  fallbackTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  fallbackSub: { fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center' },
});
