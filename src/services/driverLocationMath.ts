export const DRIVER_SAMPLING = Object.freeze({
  NEAR_STOP_METERS: 500,
  NEAR_INTERVAL_MS: 5000,
  FAR_INTERVAL_MS: 20000,
});

export function driverLocationIntervalMs(distanceToNextStopMeters: number | null | undefined) {
  if (distanceToNextStopMeters == null || !Number.isFinite(distanceToNextStopMeters)) {
    return DRIVER_SAMPLING.NEAR_INTERVAL_MS;
  }
  return distanceToNextStopMeters <= DRIVER_SAMPLING.NEAR_STOP_METERS
    ? DRIVER_SAMPLING.NEAR_INTERVAL_MS
    : DRIVER_SAMPLING.FAR_INTERVAL_MS;
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

