/**
 * LiveBusMap — the map body of the parent/student live-tracking card.
 *
 * Pure presentational: fed entirely by the backend `/transport/my-bus/live`
 * payload (no direct DB access). Rendered only while the card is expanded, so
 * the MapLibre surface and OSM tile fetches cost nothing when collapsed.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Map, Camera, GeoJSONSource, Layer, Marker } from './MapWrapper';
import { useTheme } from '../hooks/useTheme';

// OpenStreetMap raster tiles (no API key required)
const OSM_STYLE = JSON.stringify({
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }],
});

export type LiveStop = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  exec_order: number;
  status: string;
};

type Props = {
  stops: LiveStop[];
  busLocation: { latitude: number; longitude: number } | null;
  heading?: number | null;
  speed?: number | null;
  isFresh?: boolean;
  boardingStopId?: string | null;
  height?: number;
};

const PAD = 0.004;

export default function LiveBusMap({
  stops,
  busLocation,
  heading,
  speed,
  isFresh = true,
  boardingStopId,
  height = 260,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    if (!busLocation) setFollowing(false);
  }, [busLocation]);

  const mapStops = useMemo(
    () => stops.filter((s) => s.latitude != null && s.longitude != null),
    [stops],
  );

  const routeGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: mapStops.map((s) => [Number(s.longitude), Number(s.latitude)]),
      },
    }],
  }), [mapStops]);

  const bounds = useMemo(() => {
    const lats = mapStops.map((s) => Number(s.latitude));
    const lngs = mapStops.map((s) => Number(s.longitude));
    if (busLocation) {
      lats.push(busLocation.latitude);
      lngs.push(busLocation.longitude);
    }
    if (lats.length === 0) return null;
    return [
      Math.min(...lngs) - PAD, Math.min(...lats) - PAD,
      Math.max(...lngs) + PAD, Math.max(...lats) + PAD,
    ] as [number, number, number, number];
  }, [mapStops, busLocation]);

  if (!bounds) {
    return (
      <View style={[s.empty, { height }]}>
        <Ionicons name="map-outline" size={28} color="#94A3B8" />
        <Text style={s.emptyText}>{t('busTracker.stops_not_set')}</Text>
      </View>
    );
  }

  return (
    <View style={[s.wrap, { height }]}>
      <Map style={StyleSheet.absoluteFillObject} mapStyle={OSM_STYLE} logo={false} attribution={false}>
        {following && busLocation ? (
          <Camera
            center={[busLocation.longitude, busLocation.latitude]}
            zoom={15.5}
            easing="ease"
            duration={850}
          />
        ) : (
          <Camera bounds={bounds} easing="ease" duration={650} />
        )}

        {mapStops.length > 1 && (
          <GeoJSONSource id="live-route-source" data={routeGeoJSON}>
            <Layer
              id="live-route-casing"
              type="line"
              paint={{ 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.94 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="live-route-line"
              type="line"
              paint={{ 'line-color': theme.colors.primary, 'line-width': 5, 'line-opacity': 0.95 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}

        {mapStops.map((stop) => {
          const served = stop.status === 'completed' || stop.status === 'skipped';
          const isBoarding = stop.id === boardingStopId;
          return (
            <Marker key={stop.id} id={`live-stop-${stop.id}`} lngLat={[Number(stop.longitude), Number(stop.latitude)]}>
              {isBoarding ? (
                <View style={s.boardingMarker}>
                  <View style={[s.boardingPin, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="person" size={12} color="#FFFFFF" />
                  </View>
                  <Text style={s.boardingLabel}>{t('busTracker.your_stop')}</Text>
                </View>
              ) : (
                <View style={[s.stopDot, served && s.stopDotServed]} />
              )}
            </Marker>
          );
        })}

        {busLocation && (
          <Marker id="live-bus-marker" lngLat={[busLocation.longitude, busLocation.latitude]}>
            <View style={s.busMarkerShell}>
              {isFresh && <View style={[s.busHalo, { backgroundColor: theme.colors.primary }]} />}
              <View
                style={[
                  s.headingArrow,
                  { borderBottomColor: theme.colors.primary },
                  heading != null ? { transform: [{ rotate: `${heading}deg` }] } : null,
                ]}
              />
              <View style={[s.busMarker, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}>
                <Ionicons name="bus" size={17} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        )}
      </Map>

      <View style={s.liveOverlay} pointerEvents="none">
        <View style={s.livePill}>
          <View style={[s.liveDot, { backgroundColor: isFresh ? '#10B981' : '#F59E0B' }]} />
          <Text style={s.livePillText}>
            {isFresh ? t('busTracker.live_movement') : t('busTracker.last_known_position')}
          </Text>
        </View>
        {speed != null && (
          <View style={s.speedPill}>
            <Ionicons name="speedometer-outline" size={13} color="#0F172A" />
            <Text style={s.speedText}>{Math.max(0, Math.round(speed))} km/h</Text>
          </View>
        )}
      </View>

      {busLocation && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('busTracker.recenter_bus')}
          activeOpacity={0.8}
          style={[s.recenterButton, following && { backgroundColor: theme.colors.primary }]}
          onPress={() => setFollowing((value) => !value)}
        >
          <Ionicons
            name={following ? 'navigate' : 'locate-outline'}
            size={18}
            color={following ? '#FFFFFF' : '#0F172A'}
          />
        </TouchableOpacity>
      )}

      <View style={s.followBadge} pointerEvents="none">
        <Ionicons name={following ? 'navigate-circle' : 'map-outline'} size={14} color={following ? theme.colors.primary : '#64748B'} />
        <Text style={[s.followText, following && { color: theme.colors.primary }]}>
          {following ? t('busTracker.following_bus') : t('busTracker.route_overview')}
        </Text>
      </View>
      <Text style={s.attribution}>© OpenStreetMap</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#DCE4EC',
  },
  empty: {
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  emptyText: { fontSize: 13, color: '#64748B', fontWeight: '500', textAlign: 'center' },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#94A3B8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stopDotServed: { backgroundColor: '#059669' },
  boardingMarker: {
    alignItems: 'center',
  },
  boardingPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  boardingLabel: {
    marginTop: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    overflow: 'hidden',
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.95)',
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '800',
  },
  busMarkerShell: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    opacity: 0.18,
  },
  headingArrow: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  busMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  liveOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(15,23,42,0.88)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  livePillText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.65 },
  speedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  speedText: { color: '#0F172A', fontSize: 10, fontWeight: '800' },
  recenterButton: {
    position: 'absolute',
    right: 12,
    bottom: 44,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 6,
  },
  followBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  followText: { color: '#64748B', fontSize: 9, fontWeight: '800' },
  attribution: {
    position: 'absolute',
    bottom: 5,
    right: 58,
    fontSize: 9,
    color: '#64748B',
  },
});
