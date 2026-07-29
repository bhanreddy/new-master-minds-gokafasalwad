import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner needs the explicit extension.
// @ts-ignore TS5097 -- test-only runtime import, not bundled by Expo.
import {
  interpolateRouteCoordinate,
  isFixFromCurrentTrip,
  simulateLiveCoordinate,
} from './transportLiveSimulation.ts';

const fix = {
  latitude: 17,
  longitude: 78,
  speed: 36,
  heading: 90,
  recorded_at: '2026-07-29T10:00:00.000Z',
};

test('live simulation advances a moving fix in the reported direction', () => {
  const result = simulateLiveCoordinate(fix, Date.parse(fix.recorded_at) + 5_000);
  assert.ok(result.longitude > fix.longitude);
  assert.ok(Math.abs(result.latitude - fix.latitude) < 0.00001);
});

test('live simulation stops projecting after its safe horizon', () => {
  const atHorizon = simulateLiveCoordinate(fix, Date.parse(fix.recorded_at) + 12_000);
  const longAfter = simulateLiveCoordinate(fix, Date.parse(fix.recorded_at) + 120_000);
  assert.deepEqual(longAfter, atHorizon);
});

test('live simulation does not invent movement without a trustworthy heading', () => {
  const result = simulateLiveCoordinate(
    { ...fix, heading: null },
    Date.parse(fix.recorded_at) + 8_000,
  );
  assert.deepEqual(result, { latitude: fix.latitude, longitude: fix.longitude });
});

test('route simulation travels from the first stop to the last stop', () => {
  const stops = [
    { latitude: 17, longitude: 78 },
    { latitude: 18, longitude: 79 },
    { latitude: 19, longitude: 80 },
  ];

  assert.deepEqual(interpolateRouteCoordinate(stops, 0), stops[0]);
  assert.deepEqual(interpolateRouteCoordinate(stops, 1.5), {
    latitude: 18.5,
    longitude: 79.5,
  });
  assert.deepEqual(interpolateRouteCoordinate(stops, 2), stops[2]);
});

test('route simulation bridges stops without coordinates', () => {
  const result = interpolateRouteCoordinate([
    { latitude: 17, longitude: 78 },
    { latitude: null, longitude: null },
    { latitude: 19, longitude: 80 },
  ], 1);

  assert.deepEqual(result, { latitude: 18, longitude: 79 });
});

test('a previous trip location is rejected for a newly started trip', () => {
  assert.equal(
    isFixFromCurrentTrip(
      '2026-07-29T10:00:00.000Z',
      '2026-07-29T10:05:00.000Z',
    ),
    false,
  );
  assert.equal(
    isFixFromCurrentTrip(
      '2026-07-29T10:05:01.000Z',
      '2026-07-29T10:05:00.000Z',
    ),
    true,
  );
});
