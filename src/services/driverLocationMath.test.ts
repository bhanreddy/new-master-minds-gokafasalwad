import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner needs the explicit extension.
// @ts-ignore TS5097 -- test-only runtime import, not bundled by Expo.
import { driverLocationIntervalMs } from './driverLocationMath.ts';

test('adaptive interval is fast at or within 500m', () => {
  assert.equal(driverLocationIntervalMs(50), 5000);
  assert.equal(driverLocationIntervalMs(500), 5000);
});

test('adaptive interval is slow on long stretches and conservative without a target', () => {
  assert.equal(driverLocationIntervalMs(501), 20000);
  assert.equal(driverLocationIntervalMs(5000), 20000);
  assert.equal(driverLocationIntervalMs(null), 5000);
});
