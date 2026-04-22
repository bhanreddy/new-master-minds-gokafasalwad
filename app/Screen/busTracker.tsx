import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { api } from '../../src/services/apiClient';
import LogoLoader from '../../src/components/LogoLoader';

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
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data?.trip?.ui_status, data?.trip?.status, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (loading && !data) {
    return (
      <ScreenLayout>
        <StudentHeader title="Bus tracker" />
        <View style={styles.center}>
          <LogoLoader size={56} color="#1D4ED8" />
        </View>
      </ScreenLayout>
    );
  }

  if (!data?.assigned) {
    return (
      <ScreenLayout>
        <StatusBar barStyle="dark-content" />
        <StudentHeader title="Bus tracker" />
        <View style={styles.center}>
          <Ionicons name="bus-outline" size={48} color="#94A3B8" />
          <Text style={styles.title}>No bus assigned</Text>
          <Text style={styles.sub}>Contact your school admin.</Text>
        </View>
      </ScreenLayout>
    );
  }

  const rawTrip = data.trip?.ui_status || data.trip?.status || '';
  const tripUi = tripStatusIsActive(rawTrip) ? 'in_progress' : rawTrip;
  const boarding = data.boarding_stop;
  const boardingOrder = data.boarding_stop_order;
  const stops = data.stops ?? [];
  const until = data.stops_until_boarding;
  const atYourStop =
    tripStatusIsActive(rawTrip) &&
    boardingOrder != null &&
    data.current_stop?.stop_order === boardingOrder;

  return (
    <ScreenLayout>
      <StatusBar barStyle="dark-content" />
      <StudentHeader title={data.route_name ? `Bus · ${data.route_name}` : 'Bus tracker'} />
      <View style={styles.card}>
        <Text style={styles.routeTitle}>{data.route_name}</Text>
        <Text style={styles.boarding}>
          Your stop: <Text style={styles.boardingStrong}>{boarding}</Text>
        </Text>
        <Text style={styles.statusLine}>
          Trip:{' '}
          {tripStatusIsActive(rawTrip)
            ? 'In progress'
            : tripUi === 'completed'
              ? 'Completed'
              : 'Scheduled'}
        </Text>
      </View>

      {atYourStop && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>Bus is at your stop now!</Text>
        </View>
      )}

      {tripStatusIsActive(rawTrip) && data.current_stop && (
        <View style={styles.info}>
          <Text style={styles.infoText}>Bus last reached: {data.current_stop.name}</Text>
          {until != null && (
            <Text
              style={[
                styles.infoText,
                until <= 1 && { color: '#B45309', fontWeight: '700' },
              ]}
            >
              {until} stop(s) until your stop
            </Text>
          )}
        </View>
      )}

      <FlatList
        data={stops}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const reached = item.status === 'completed';
          const isBoarding = boarding && item.name === boarding;
          return (
            <View
              style={[styles.row, isBoarding && styles.rowHighlight]}
            >
              <Ionicons
                name={reached ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={reached ? '#059669' : '#94A3B8'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, isBoarding && styles.rowNameHi]}>
                  {item.name}
                </Text>
                {item.reached_at && (
                  <Text style={styles.rowMeta}>
                    {new Date(item.reached_at).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '700', marginTop: 12, color: '#374151' },
  sub: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  card: {
    margin: 16,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
  },
  routeTitle: { fontSize: 18, fontWeight: '700', color: '#1E3A8A' },
  boarding: { marginTop: 8, fontSize: 15, color: '#374151' },
  boardingStrong: { fontWeight: '700', color: '#1D4ED8' },
  statusLine: { marginTop: 6, fontSize: 14, color: '#64748B' },
  alertBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
  },
  alertText: { fontWeight: '700', color: '#92400E', textAlign: 'center' },
  info: { paddingHorizontal: 16, marginBottom: 8 },
  infoText: { fontSize: 14, color: '#334155' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  rowHighlight: {
    borderColor: '#1D4ED8',
    borderWidth: 2,
    backgroundColor: '#F8FAFC',
  },
  rowName: { fontSize: 15, color: '#111827' },
  rowNameHi: { fontWeight: '700', color: '#1D4ED8' },
  rowMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
