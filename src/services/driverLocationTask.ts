/** Phase E adaptive, offline-safe driver GPS pipeline. */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from './apiClient';
import { distanceMeters, driverLocationIntervalMs, DRIVER_SAMPLING } from './driverLocationMath';

export const DRIVER_LOCATION_TASK = 'driver-bus-location-task';
const TRACKED_BUS_KEY = 'driver_tracking_bus_id';
const NEXT_STOP_KEY = 'driver_tracking_next_stop';
const SAMPLING_INTERVAL_KEY = 'driver_tracking_sampling_interval';
const QUEUE_PREFIX = 'driver_location_queue:';
const MAX_QUEUED_FIXES = 1000;
const MAX_CLIENT_AGE_MS = 6 * 60 * 60 * 1000;

export interface DriverStopTarget { latitude: number; longitude: number }
export interface QueuedDriverFix {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
  recorded_at: string;
  is_mocked: boolean;
}

let queueOperation: Promise<unknown> = Promise.resolve();
const serializeQueue = <T,>(operation: () => Promise<T>): Promise<T> => {
  const next = queueOperation.then(operation, operation);
  queueOperation = next.catch(() => undefined);
  return next;
};

const queueKey = (busId: string) => `${QUEUE_PREFIX}${busId}`;

function toQueuedFix(loc: Location.LocationObject): QueuedDriverFix {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    speed: loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed * 3.6 : 0,
    heading: Number.isFinite(loc.coords.heading) ? loc.coords.heading : null,
    recorded_at: new Date(loc.timestamp).toISOString(),
    is_mocked: loc.mocked === true,
  };
}

async function readQueue(busId: string): Promise<QueuedDriverFix[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(busId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function enqueueBusLocations(busId: string, locations: Location.LocationObject[]) {
  if (!locations.length) return;
  await serializeQueue(async () => {
    const cutoff = Date.now() - MAX_CLIENT_AGE_MS;
    const merged = [...await readQueue(busId), ...locations.map(toQueuedFix)]
      .filter((fix) => Date.parse(fix.recorded_at) >= cutoff);
    const byTimestamp = new Map(merged.map((fix) => [fix.recorded_at, fix]));
    const bounded = [...byTimestamp.values()]
      .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at))
      .slice(-MAX_QUEUED_FIXES);
    await AsyncStorage.setItem(queueKey(busId), JSON.stringify(bounded));
  });
}

/** Delete only after a successful response; retries remain idempotent server-side. */
export async function flushQueuedBusLocations(busId: string): Promise<number> {
  return serializeQueue(async () => {
    const fixes = await readQueue(busId);
    if (!fixes.length) return 0;
    const network = await NetInfo.fetch();
    if (network.isConnected === false || network.isInternetReachable === false) return 0;
    await api.post(`/transport/buses/${busId}/locations/batch`, { fixes }, { silent: true });
    await AsyncStorage.removeItem(queueKey(busId));
    return fixes.length;
  });
}

export async function postBusLocation(busId: string, loc: Location.LocationObject) {
  await enqueueBusLocations(busId, [loc]);
  try { await flushQueuedBusLocations(busId); } catch { /* keep queue for retry */ }
}

export async function setDriverNextStopTarget(target: DriverStopTarget | null) {
  if (!target) return AsyncStorage.removeItem(NEXT_STOP_KEY);
  await AsyncStorage.setItem(NEXT_STOP_KEY, JSON.stringify(target));
}

async function readNextStopTarget(): Promise<DriverStopTarget | null> {
  try {
    const raw = await AsyncStorage.getItem(NEXT_STOP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function locationOptions(intervalMs: number): Location.LocationTaskOptions {
  const near = intervalMs === DRIVER_SAMPLING.NEAR_INTERVAL_MS;
  return {
    accuracy: near ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: intervalMs,
    distanceInterval: near ? 10 : 50,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Trip in progress',
      notificationBody: 'Sharing bus location with parents',
      killServiceOnDestroy: true,
    },
  };
}

async function applySamplingInterval(intervalMs: number) {
  const current = Number(await AsyncStorage.getItem(SAMPLING_INTERVAL_KEY));
  if (current === intervalMs && await isDriverLocationTaskRunning()) return;
  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, locationOptions(intervalMs));
  await AsyncStorage.setItem(SAMPLING_INTERVAL_KEY, String(intervalMs));
}

/** Called while the dashboard is foregrounded, where Android permits option changes. */
export async function adaptDriverLocationSampling(loc: Location.LocationObject): Promise<number> {
  const target = await readNextStopTarget();
  const distance = target
    ? distanceMeters(loc.coords.latitude, loc.coords.longitude, target.latitude, target.longitude)
    : null;
  const interval = driverLocationIntervalMs(distance);
  await applySamplingInterval(interval);
  return interval;
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations?.length) return;
    const busId = await AsyncStorage.getItem(TRACKED_BUS_KEY);
    if (!busId) return;
    await enqueueBusLocations(busId, locations);
    try { await flushQueuedBusLocations(busId); } catch { /* retained offline */ }
  });
}

export async function isDriverLocationTaskRunning(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try { return await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK); }
  catch { return false; }
}

export async function startDriverLocationUpdates(busId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await AsyncStorage.setItem(TRACKED_BUS_KEY, busId);
  try { await Location.requestBackgroundPermissionsAsync(); } catch { /* best effort */ }
  if (!await isDriverLocationTaskRunning()) {
    // Start conservatively at 5s; the first dashboard fix chooses 5s/20s.
    await applySamplingInterval(DRIVER_SAMPLING.NEAR_INTERVAL_MS);
  }
  try { await flushQueuedBusLocations(busId); } catch { /* retained offline */ }
}

export async function stopDriverLocationUpdates(): Promise<void> {
  if (Platform.OS === 'web') return;
  const busId = await AsyncStorage.getItem(TRACKED_BUS_KEY);
  if (busId) {
    try { await flushQueuedBusLocations(busId); } catch { /* next trip retries */ }
  }
  await AsyncStorage.multiRemove([TRACKED_BUS_KEY, NEXT_STOP_KEY, SAMPLING_INTERVAL_KEY]).catch(() => {});
  if (await isDriverLocationTaskRunning()) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => {});
  }
}

