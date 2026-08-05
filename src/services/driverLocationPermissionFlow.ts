export type DriverLocationPermissionStage = 'foreground' | 'background';

type PermissionState = {
  status: string;
  canAskAgain: boolean;
};

export type DriverLocationPermissionGateway = {
  getForegroundPermissionsAsync: () => Promise<PermissionState>;
  requestForegroundPermissionsAsync: () => Promise<PermissionState>;
  getBackgroundPermissionsAsync: () => Promise<PermissionState>;
  requestBackgroundPermissionsAsync: () => Promise<PermissionState>;
};

type FlowOptions = {
  platform: string;
  requestBackground: boolean;
  location: DriverLocationPermissionGateway;
  disclose: (stage: DriverLocationPermissionStage) => Promise<boolean>;
};

/** Policy-critical permission ordering, kept separate so it can be tested. */
export async function runDriverLocationPermissionFlow({
  platform,
  requestBackground,
  location,
  disclose,
}: FlowOptions): Promise<boolean> {
  if (platform === 'web') return false;

  let foreground = await location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    if (!foreground.canAskAgain) return false;
    if (platform === 'android' && !await disclose('foreground')) return false;
    foreground = await location.requestForegroundPermissionsAsync();
  }
  if (foreground.status !== 'granted') return false;

  if (requestBackground) {
    let background = await location.getBackgroundPermissionsAsync();
    if (background.status !== 'granted' && background.canAskAgain) {
      const accepted = platform !== 'android' || await disclose('background');
      if (accepted) background = await location.requestBackgroundPermissionsAsync();
    }
  }

  // Foreground tracking remains available when background access is declined.
  return true;
}
