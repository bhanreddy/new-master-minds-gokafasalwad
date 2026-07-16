import { useEffect, useSyncExternalStore } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  getStaffPortalSession,
  setStaffPortalSession,
  subscribeToStaffPortalSession,
} from '../services/staffPortalSession';

/**
 * When an admin opens a staff member's portal from Manage Staff, the target
 * staffId/viewAsName travel as route params. Real staff members navigating
 * their own portal never carry these params, so `isViewingAsAdmin` is false
 * and every screen keeps using its normal session-derived ("my …") calls.
 */
export function useEffectiveStaffId() {
  const { staffId, viewAsName, viewAsUserId } = useLocalSearchParams<{
    staffId?: string;
    viewAsName?: string;
    viewAsUserId?: string;
  }>();
  const stored = useSyncExternalStore(
    subscribeToStaffPortalSession,
    getStaffPortalSession,
    getStaffPortalSession,
  );

  useEffect(() => {
    if (typeof staffId === 'string' && staffId.length > 0) {
      setStaffPortalSession(staffId, viewAsName, viewAsUserId);
    }
  }, [staffId, viewAsName, viewAsUserId]);

  const effectiveStaffId = typeof staffId === 'string' && staffId.length > 0
    ? staffId
    : stored.staffId;
  const effectiveName = typeof viewAsName === 'string' && viewAsName.length > 0
    ? viewAsName
    : stored.viewAsName;
  const effectiveUserId = typeof viewAsUserId === 'string' && viewAsUserId.length > 0
    ? viewAsUserId
    : stored.userId;
  const isViewingAsAdmin = typeof effectiveStaffId === 'string' && effectiveStaffId.length > 0;

  return {
    staffId: isViewingAsAdmin ? effectiveStaffId : undefined,
    isViewingAsAdmin,
    viewAsName: isViewingAsAdmin ? effectiveName : undefined,
    userId: isViewingAsAdmin ? effectiveUserId : undefined,
  };
}
