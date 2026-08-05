import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import DriverLocationDisclosure, {
  DriverLocationDisclosureStage,
} from '../components/DriverLocationDisclosure';
import { runDriverLocationPermissionFlow } from '../services/driverLocationPermissionFlow';

type PermissionOptions = {
  requestBackground?: boolean;
};

type PendingDisclosure = {
  stage: DriverLocationDisclosureStage;
  resolve: (accepted: boolean) => void;
};

/**
 * Owns the policy-sensitive order of Android location permission requests:
 * app disclosure -> affirmative action -> Android runtime permission.
 */
export function useDriverLocationPermission() {
  const pendingRef = useRef<PendingDisclosure | null>(null);
  const requestInFlightRef = useRef<Promise<boolean> | null>(null);
  const [stage, setStage] = useState<DriverLocationDisclosureStage | null>(null);

  const showDisclosure = useCallback((nextStage: DriverLocationDisclosureStage) => {
    return new Promise<boolean>((resolve) => {
      pendingRef.current?.resolve(false);
      pendingRef.current = { stage: nextStage, resolve };
      setStage(nextStage);
    });
  }, []);

  const settleDisclosure = useCallback((accepted: boolean) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setStage(null);
    pending?.resolve(accepted);
  }, []);

  useEffect(() => () => {
    pendingRef.current?.resolve(false);
    pendingRef.current = null;
  }, []);

  const requestPermissions = useCallback(async ({
    requestBackground = true,
  }: PermissionOptions = {}): Promise<boolean> => {
    if (requestInFlightRef.current) return requestInFlightRef.current;
    const request = runDriverLocationPermissionFlow({
      platform: Platform.OS,
      requestBackground,
      location: Location,
      disclose: showDisclosure,
    });
    requestInFlightRef.current = request;
    try {
      return await request;
    } finally {
      if (requestInFlightRef.current === request) requestInFlightRef.current = null;
    }
  }, [showDisclosure]);

  const disclosureModal = (
    <DriverLocationDisclosure
      visible={stage !== null}
      stage={stage ?? 'foreground'}
      onContinue={() => settleDisclosure(true)}
      onCancel={() => settleDisclosure(false)}
    />
  );

  return { requestPermissions, disclosureModal };
}
