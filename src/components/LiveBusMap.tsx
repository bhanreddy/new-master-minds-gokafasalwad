/**
 * LiveBusMap — the map body of the parent/student live-tracking card.
 *
 * Pure presentational: fed entirely by the backend `/transport/my-bus/live`
 * payload (no direct DB access). Rendered only while the card is expanded, so
 * the MapLibre surface and OSM tile fetches cost nothing when collapsed.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  boardingStopId?: string | null;
  height?: number;
};

const PAD = 0.004;

export default function LiveBusMap({ stops, busLocation, boardingStopId, height = 260 }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();

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
        <Camera bounds={bounds} />

        {mapStops.length > 1 && (
          <GeoJSONSource id="live-route-source" data={routeGeoJSON}>
            <Layer
              id="live-route-line"
              type="line"
              paint={{ 'line-color': theme.colors.primary, 'line-width': 4, 'line-opacity': 0.85 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}

        {mapStops.map((stop) => {
          const served = stop.status === 'completed' || stop.status === 'skipped';
          const isBoarding = stop.id === boardingStopId;
          return (
            <Marker key={stop.id} id={`live-stop-${stop.id}`} lngLat={[Number(stop.longitude), Number(stop.latitude)]}>
              <View
                style={[
                  s.stopDot,
                  served && s.stopDotServed,
                  isBoarding && [s.stopDotBoarding, { backgroundColor: theme.colors.primary }],
                ]}
              />
            </Marker>
          );
        })}

        {busLocation && (
          <Marker id="live-bus-marker" lngLat={[busLocation.longitude, busLocation.latitude]}>
            <View style={[s.busMarker, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}>
              <Ionicons name="bus" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}
      </Map>
      <Text style={s.attribution}>© OpenStreetMap</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
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
  stopDotBoarding: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  busMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    fontSize: 9,
    color: '#64748B',
  },
});
