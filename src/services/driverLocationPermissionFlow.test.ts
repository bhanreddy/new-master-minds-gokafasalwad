import { runDriverLocationPermissionFlow } from './driverLocationPermissionFlow';

const permission = (status: string, canAskAgain = true) => ({ status, canAskAgain });

describe('driver location permission flow', () => {
  it('shows each Android disclosure immediately before its runtime request', async () => {
    const events: string[] = [];
    const granted = permission('granted');
    const result = await runDriverLocationPermissionFlow({
      platform: 'android',
      requestBackground: true,
      disclose: async (stage) => { events.push(`disclose:${stage}`); return true; },
      location: {
        getForegroundPermissionsAsync: async () => permission('undetermined'),
        requestForegroundPermissionsAsync: async () => { events.push('request:foreground'); return granted; },
        getBackgroundPermissionsAsync: async () => permission('undetermined'),
        requestBackgroundPermissionsAsync: async () => { events.push('request:background'); return granted; },
      },
    });

    expect(result).toBe(true);
    expect(events).toEqual([
      'disclose:foreground',
      'request:foreground',
      'disclose:background',
      'request:background',
    ]);
  });

  it('does not request Android permission when the user declines the disclosure', async () => {
    const requestForegroundPermissionsAsync = jest.fn(async () => permission('granted'));
    const result = await runDriverLocationPermissionFlow({
      platform: 'android',
      requestBackground: true,
      disclose: async () => false,
      location: {
        getForegroundPermissionsAsync: async () => permission('undetermined'),
        requestForegroundPermissionsAsync,
        getBackgroundPermissionsAsync: async () => permission('undetermined'),
        requestBackgroundPermissionsAsync: jest.fn(async () => permission('granted')),
      },
    });

    expect(result).toBe(false);
    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('keeps foreground tracking available when background consent is declined', async () => {
    const requestBackgroundPermissionsAsync = jest.fn(async () => permission('granted'));
    const result = await runDriverLocationPermissionFlow({
      platform: 'android',
      requestBackground: true,
      disclose: async (stage) => stage === 'foreground',
      location: {
        getForegroundPermissionsAsync: async () => permission('granted'),
        requestForegroundPermissionsAsync: jest.fn(async () => permission('granted')),
        getBackgroundPermissionsAsync: async () => permission('undetermined'),
        requestBackgroundPermissionsAsync,
      },
    });

    expect(result).toBe(true);
    expect(requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
