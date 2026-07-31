import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Role } from '../types/models';

/**
 * SessionPolicyService — Persistent client-session metadata.
 *
 * The client never expires or deletes a remembered login based on elapsed
 * time/day. Role schedules and account status remain server-side authorization
 * rules; a denied request must not destroy recoverable device credentials.
 */

// ─── Configuration ───────────────────────────────────────────────────

const SESSION_ROLE_KEY = 'session_policy_role';
const SESSION_STARTED_KEY = 'session_policy_started_at';

// ─── Storage Helpers ─────────────────────────────────────────────────

async function storeValue(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {}
}

async function getValue(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function removeValue(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {

    // Silent fail
  }
}

// ─── Session Policy Manager ──────────────────────────────────────────

type PolicyLogoutCallback = (reason: string) => void;

class SessionPolicyServiceClass {
  /**
   * Kept for call-site compatibility. Session policy never logs out locally.
   */
  setLogoutCallback(_callback: PolicyLogoutCallback): void {}

  /**
   * Record the start of a new session.
   * Call this immediately after successful login.
   */
  async startSession(role: Role): Promise<void> {
    const now = Date.now().toString();

    await storeValue(SESSION_ROLE_KEY, role);
    await storeValue(SESSION_STARTED_KEY, now);

    if (__DEV__) {
      // Role is persisted for recovery diagnostics and server context only.
    }
  }

  /**
   * Client-side time never invalidates a remembered login.
   */
  async checkSessionExpiry(): Promise<boolean> {
    return true;
  }

  /**
   * Kept for call-site compatibility; there is no client expiry timer.
   */
  startPeriodicCheck(): void {}

  /**
   * Kept for call-site compatibility. Day-based access restrictions are
   * enforced by the backend and never delete the saved device session.
   */
  async enforceDayPolicy(): Promise<void> {
    return;
  }

  /** Kept for call-site compatibility; backend policy is checked per request. */
  scheduleMidnightCheck(): void {}

  /**
   * Stop periodic checks. Call on logout.
   */
  stopPeriodicCheck(): void {
    return;
  }

  /**
   * Clear all session policy data. Call on logout.
   */
  async clearSession(): Promise<void> {
    this.stopPeriodicCheck();
    await removeValue(SESSION_ROLE_KEY);
    await removeValue(SESSION_STARTED_KEY);
    if (__DEV__) { }
  }

  /**
   * Get the stored session role (for checking if policy data exists).
   */
  async getStoredRole(): Promise<string | null> {
    return await getValue(SESSION_ROLE_KEY);
  }

  /**
   * Remembered client sessions have no elapsed-time limit.
   */
  async getRemainingTime(): Promise<number> {
    return Infinity;
  }
}

export const SessionPolicy = new SessionPolicyServiceClass();
