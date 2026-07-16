export interface StaffPortalSession {
  staffId?: string;
  viewAsName?: string;
  userId?: string;
}

const EMPTY_SESSION: StaffPortalSession = {};
let currentSession: StaffPortalSession = EMPTY_SESSION;
const listeners = new Set<() => void>();

export function getStaffPortalSession(): StaffPortalSession {
  return currentSession;
}

export function subscribeToStaffPortalSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setStaffPortalSession(staffId: string, viewAsName?: string, userId?: string): void {
  const normalizedId = String(staffId || '').trim();
  if (!normalizedId) {
    clearStaffPortalSession();
    return;
  }

  const normalizedName = viewAsName?.trim() || undefined;
  const normalizedUserId = userId?.trim() || currentSession.userId;
  if (
    currentSession.staffId === normalizedId
    && currentSession.viewAsName === normalizedName
    && currentSession.userId === normalizedUserId
  ) return;

  currentSession = { staffId: normalizedId, viewAsName: normalizedName, userId: normalizedUserId };
  listeners.forEach((listener) => listener());
}

export function clearStaffPortalSession(): void {
  if (!currentSession.staffId) return;
  currentSession = EMPTY_SESSION;
  listeners.forEach((listener) => listener());
}
