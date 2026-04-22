import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, Linking, Platform,
} from 'react-native';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { api } from '../../src/services/apiClient';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import LogoLoader from '../../src/components/LogoLoader';

const PINK = '#EC4899';
const PINK_DARK = '#BE185D';
const PINK_GRADIENT: [string, string] = ['#EC4899', '#BE185D'];

interface StudentInfo {
  student_id: string;
  student_name: string;
  admission_no: string | null;
  class_name: string | null;
  section_name: string | null;
  parent_phone: string | null;
}

interface StopInfo {
  stop_id: string;
  stop_name: string;
  stop_order: number;
  students: StudentInfo[];
}

interface RouteInfo {
  id: string;
  name: string;
  direction: string;
  stops: StopInfo[];
}

export default function DriverStudents() {
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStudents = useCallback(async () => {
    try {
      const data = await api.get<any>('/transport/driver/my-students');
      setRoutes(data.routes || []);
    } catch (e: any) {
      alertCompat('Error', e?.message || 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const onRefresh = () => { setRefreshing(true); fetchStudents(); };

  const currentRoute = routes[selectedRouteIdx] || null;

  // Flatten students for stats
  const allStudents = currentRoute?.stops?.flatMap((s) => s.students) || [];
  const totalStudents = allStudents.length;
  const totalStops = currentRoute?.stops?.length || 0;
  const stopsWithStudents = currentRoute?.stops?.filter((s) => s.students.length > 0).length || 0;

  const callPhone = (phone: string | null) => {
    if (!phone) {
      alertCompat('No Phone', 'Parent phone number not available.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <ScreenLayout>
        <StudentHeader title="Passenger Roster" menuUserType="driver" />
        <View style={s.center}><LogoLoader size={60} color={PINK} /></View>
      </ScreenLayout>
    );
  }

  /* ─── Empty State ─── */
  if (routes.length === 0) {
    return (
      <ScreenLayout>
        <StatusBar barStyle="dark-content" />
        <StudentHeader title="Passenger Roster" menuUserType="driver" />
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Ionicons name="people-outline" size={48} color="#CBD5E1" />
          </View>
          <Text style={s.emptyTitle}>No Students Assigned</Text>
          <Text style={s.emptySub}>
            Students will appear here once they are assigned to your route.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <StatusBar barStyle="light-content" />
      <StudentHeader title="Passenger Roster" menuUserType="driver" />

      <FlatList
        data={currentRoute?.stops || []}
        keyExtractor={(item) => item.stop_id}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor="transparent" colors={['transparent']}
            progressBackgroundColor="transparent" />
        }
        ListHeaderComponent={
          <>
            {refreshing && (
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 16 }}>
                <LogoLoader size={30} />
              </View>
            )}

            {/* ═══════ Hero Card ═══════ */}
            <Animated.View entering={FadeInDown.delay(80).duration(500)} style={s.heroWrap}>
              <LinearGradient colors={PINK_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
                <View style={[s.heroDecor, { top: -30, right: -30, width: 120, height: 120 }]} />
                <View style={[s.heroDecor, { bottom: -15, left: -15, width: 60, height: 60 }]} />

                <View style={s.heroRow}>
                  <View style={s.heroStatBox}>
                    <Text style={s.heroStatNum}>{totalStudents}</Text>
                    <Text style={s.heroStatLabel}>Students</Text>
                  </View>
                  <View style={s.heroStatDivider} />
                  <View style={s.heroStatBox}>
                    <Text style={s.heroStatNum}>{totalStops}</Text>
                    <Text style={s.heroStatLabel}>Stops</Text>
                  </View>
                  <View style={s.heroStatDivider} />
                  <View style={s.heroStatBox}>
                    <Text style={s.heroStatNum}>{stopsWithStudents}</Text>
                    <Text style={s.heroStatLabel}>Active Stops</Text>
                  </View>
                </View>

                <View style={s.heroDivider} />

                <View style={s.heroBottom}>
                  <View style={s.heroRoutePill}>
                    <Ionicons name="navigate" size={12} color="#FFF" />
                    <Text style={s.heroRouteText}>
                      {currentRoute?.name} · {currentRoute?.direction}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* ═══════ Route Selector ═══════ */}
            {routes.length > 1 && (
              <Animated.View entering={FadeInDown.delay(120).duration(400)}>
                <View style={s.secHeader}>
                  <View style={s.secIconBox}>
                    <Ionicons name="map" size={14} color={PINK} />
                  </View>
                  <Text style={s.secTitle}>Select Route</Text>
                </View>
                <FlatList
                  horizontal
                  data={routes}
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(r) => r.id}
                  style={{ marginBottom: 16 }}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[s.routeChip, selectedRouteIdx === index && s.routeChipActive]}
                      onPress={() => setSelectedRouteIdx(index)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="navigate-outline" size={14}
                        color={selectedRouteIdx === index ? '#FFF' : PINK} />
                      <Text style={[s.routeChipText, selectedRouteIdx === index && { color: '#FFF' }]}>
                        {item.name}
                      </Text>
                      <Text style={[s.routeChipDir, selectedRouteIdx === index && { color: 'rgba(255,255,255,0.7)' }]}>
                        {item.direction}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </Animated.View>
            )}

            {/* ═══════ Section Header ═══════ */}
            <Animated.View entering={FadeInDown.delay(160).duration(400)}>
              <View style={s.secHeader}>
                <View style={[s.secIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="people" size={14} color="#10B981" />
                </View>
                <Text style={s.secTitle}>Students by Stop</Text>
              </View>
            </Animated.View>
          </>
        }
        renderItem={({ item: stop, index }) => {
          const students = stop.students || [];
          if (students.length === 0) return null;

          return (
            <Animated.View
              entering={FadeInUp.delay(200 + index * 60).duration(400)}
              style={s.stopSection}
            >
              {/* Stop Header */}
              <View style={s.stopHeader}>
                <View style={s.stopOrderBadge}>
                  <Text style={s.stopOrderText}>{stop.stop_order}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stopName}>{stop.stop_name}</Text>
                  <Text style={s.stopMeta}>
                    {students.length} student{students.length > 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={s.stopCountPill}>
                  <Ionicons name="people" size={12} color={PINK} />
                  <Text style={s.stopCountText}>{students.length}</Text>
                </View>
              </View>

              {/* Student List */}
              {students.map((stu, sIdx) => (
                <View
                  key={stu.student_id || `${stop.stop_id}-${sIdx}`}
                  style={[s.studentCard, sIdx === students.length - 1 && { marginBottom: 0 }]}
                >
                  {/* Avatar */}
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>
                      {(stu.student_name || '?')[0]?.toUpperCase()}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={s.studentInfo}>
                    <Text style={s.studentName} numberOfLines={1}>
                      {stu.student_name || 'Unknown'}
                    </Text>
                    <View style={s.studentMetaRow}>
                      {stu.admission_no && (
                        <View style={s.metaChip}>
                          <Ionicons name="id-card-outline" size={10} color="#64748B" />
                          <Text style={s.metaText}>{stu.admission_no}</Text>
                        </View>
                      )}
                      {stu.class_name && (
                        <View style={s.metaChip}>
                          <Ionicons name="school-outline" size={10} color="#64748B" />
                          <Text style={s.metaText}>
                            {stu.class_name}{stu.section_name ? ` - ${stu.section_name}` : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Call Button */}
                  <TouchableOpacity
                    style={[s.callBtn, !stu.parent_phone && { opacity: 0.3 }]}
                    onPress={() => callPhone(stu.parent_phone)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call" size={16} color="#10B981" />
                  </TouchableOpacity>
                </View>
              ))}
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="people-outline" size={40} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No students on this route</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </ScreenLayout>
  );
}

/* ════════════════════════════ STYLES ════════════════════════════ */
const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  scroll: { padding: 20 },

  /* Hero */
  heroWrap: {
    borderRadius: 24, overflow: 'hidden', marginBottom: 20,
    shadowColor: PINK, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  hero: { padding: 22, overflow: 'hidden' },
  heroDecor: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  heroStatBox: { alignItems: 'center', flex: 1 },
  heroStatNum: { fontSize: 28, fontWeight: '900', color: '#FFF' },
  heroStatLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2, letterSpacing: 0.3 },
  heroStatDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 14 },
  heroBottom: { flexDirection: 'row', justifyContent: 'center' },
  heroRoutePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 12,
  },
  heroRouteText: { color: '#FFF', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

  /* Empty */
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#64748B', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', maxWidth: 260, marginTop: 4 },

  /* Sections */
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  secIconBox: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#FDF2F8',
    justifyContent: 'center', alignItems: 'center',
  },
  secTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },

  /* Route selector */
  routeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FDF2F8', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, marginRight: 10, borderWidth: 1.5, borderColor: 'transparent',
  },
  routeChipActive: { backgroundColor: PINK, borderColor: PINK_DARK },
  routeChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  routeChipDir: { fontSize: 11, color: '#94A3B8', fontWeight: '500', textTransform: 'capitalize' },

  /* Stop Section */
  stopSection: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  stopHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  stopOrderBadge: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#FDF2F8',
    justifyContent: 'center', alignItems: 'center',
  },
  stopOrderText: { fontSize: 14, fontWeight: '800', color: PINK },
  stopName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  stopMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 1 },
  stopCountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FDF2F8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  stopCountText: { fontSize: 12, fontWeight: '700', color: PINK },

  /* Student Card */
  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, marginBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F8FAFC',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#7C3AED' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  studentMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F8FAFC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  metaText: { fontSize: 10, fontWeight: '600', color: '#64748B' },

  /* Call Button */
  callBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center',
  },
});
