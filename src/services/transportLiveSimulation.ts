export type LiveCoordinate = {
  latitude: number;
  longitude: number;
};

export type LiveFix = LiveCoordinate & {
  speed: number | null;
  heading: number | null;
  recorded_at: string;
};

type RouteCoordinate = {
  latitude?: number | null;
  longitude?: number | null;
};

const EARTH_RADIUS_METERS = 6_371_000;

export const LIVE_SIMULATION = Object.freeze({
  MAX_HORIZON_SECONDS: 12,
  MAX_SPEED_KMH: 90,
  MIN_MOVING_SPEED_KMH: 2,
  MAX_PROJECTED_DISTANCE_METERS: 250,
});

export function isFixFromCurrentTrip(
  fixRecordedAt: string | null | undefined,
  tripStartedAt: string | null | undefined,
) {
  if (!tripStartedAt) return true;
  if (!fixRecordedAt) return false;
  const fixMs = Date.parse(fixRecordedAt);
  const tripMs = Date.parse(tripStartedAt);
  return Number.isFinite(fixMs) && Number.isFinite(tripMs) && fixMs >= tripMs;
}

/**
 * Advances a fresh GPS fix a short distance using its reported speed/heading.
 *
 * Driver updates are intentionally lightweight and can be several seconds
 * apart. This bounded dead-reckoning keeps the marker moving between fixes
 * without pretending to know more than the driver's phone reported. The
 * projection stops after 12 seconds and is corrected by the next real fix.
 */
export function simulateLiveCoordinate(
  fix: LiveFix,
  nowMs: number,
): LiveCoordinate {
  const speedKmh = Number(fix.speed);
  const heading = Number(fix.heading);
  const recordedMs = Date.parse(fix.recorded_at);

  if (
    fix.speed == null
    || fix.heading == null
    || !Number.isFinite(recordedMs)
    || !Number.isFinite(speedKmh)
    || !Number.isFinite(heading)
    || speedKmh < LIVE_SIMULATION.MIN_MOVING_SPEED_KMH
    || heading < 0
    || heading >= 360
  ) {
    return { latitude: fix.latitude, longitude: fix.longitude };
  }

  const ageSeconds = Math.max(0, (nowMs - recordedMs) / 1000);
  const horizonSeconds = Math.min(ageSeconds, LIVE_SIMULATION.MAX_HORIZON_SECONDS);
  const metersPerSecond = Math.min(speedKmh, LIVE_SIMULATION.MAX_SPEED_KMH) / 3.6;
  const distanceMeters = Math.min(
    metersPerSecond * horizonSeconds,
    LIVE_SIMULATION.MAX_PROJECTED_DISTANCE_METERS,
  );

  if (distanceMeters <= 0) {
    return { latitude: fix.latitude, longitude: fix.longitude };
  }

  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = (heading * Math.PI) / 180;
  const latitude = (fix.latitude * Math.PI) / 180;
  const longitude = (fix.longitude * Math.PI) / 180;

  const projectedLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance)
    + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const projectedLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(projectedLatitude),
  );

  return {
    latitude: (projectedLatitude * 180) / Math.PI,
    longitude: ((((projectedLongitude * 180) / Math.PI) + 540) % 360) - 180,
  };
}

/**
 * Interpolates a marker from the first route stop to the final route stop.
 * Missing coordinates are skipped while preserving their place in the
 * journey, so the timeline and map still advance together.
 */
export function interpolateRouteCoordinate(
  stops: RouteCoordinate[],
  progress: number,
): LiveCoordinate | null {
  const located = stops
    .map((stop, index) => ({ ...stop, index }))
    .filter(
      (stop): stop is RouteCoordinate & LiveCoordinate & { index: number } =>
        stop.latitude != null
        && stop.longitude != null
        && Number.isFinite(Number(stop.latitude))
        && Number.isFinite(Number(stop.longitude)),
    )
    .map((stop) => ({
      index: stop.index,
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
    }));

  if (located.length === 0) return null;
  if (located.length === 1) {
    return { latitude: located[0].latitude, longitude: located[0].longitude };
  }

  const routeEnd = Math.max(0, stops.length - 1);
  const clamped = Math.max(0, Math.min(routeEnd, progress));
  const previous = [...located].reverse().find((stop) => stop.index <= clamped) || located[0];
  const next = located.find((stop) => stop.index >= clamped) || located[located.length - 1];

  if (previous.index === next.index) {
    return { latitude: previous.latitude, longitude: previous.longitude };
  }

  const segmentProgress = (clamped - previous.index) / (next.index - previous.index);
  return {
    latitude: previous.latitude + (next.latitude - previous.latitude) * segmentProgress,
    longitude: previous.longitude + (next.longitude - previous.longitude) * segmentProgress,
  };
}
