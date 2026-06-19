import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../services/supabaseConfig';
import { AuthService, clearAuthState } from '../services/authService';
import { AuthSession, ValidatedUser } from '../types/auth';
import { SCHOOL_ID } from '../constants/school';
import { registerLogoutCallback } from '../services/apiClient';
import { isStudentRole } from '../utils/roleHelpers';
import { getBackupRefreshToken, clearBackupRefreshToken } from '../services/secureTokenStore';
import { SessionPolicy } from '../services/sessionPolicyService';

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  user: ValidatedUser | null;
  role: string | null;
  isStudent: boolean;
  schoolId: number | null;

  signIn: typeof AuthService.signIn;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  authChecked: boolean;
  isAppLocked?: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  user: null,
  role: null,
  isStudent: false,
  schoolId: null,

  signIn: async () => ({ error: 'Not initialized' }),
  signOut: async () => {},
  refreshSession: async () => {},
  authChecked: false,
  isAppLocked: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const backoffDelay = useRef(1000); // Start at 1s
  const justSignedIn = useRef(false); // Guard against TOKEN_REFRESHED race after sign-in
  const sessionRef = useRef<AuthSession | null>(null);
  sessionRef.current = session;

  const user = session?.validatedUser || null;
  const role = user?.role?.code || null;
  const isStudent = isStudentRole(role);
  const schoolId = user ? SCHOOL_ID : null;

  const signOut = async () => {
    console.log('[AUTH_OUT]', 'manual_logout', new Date().toISOString());
    setLoading(true);
    await AuthService.signOut();
    // Clear student backup keys on explicit sign-out
    await clearBackupRefreshToken();
    setSession(null);

    setLoading(false);
  };

  // Core refresh logic invoked internally or explicitly.
  // Layer A fix: ALL roles now use exponential backoff on refresh failure
  // instead of immediately clearing session. Only confirmed fatal errors
  // (invalid_grant, user_not_found) trigger session clear.
  const handleRefresh = async (currentRole: string | null) => {
    try {
      const newSession = await AuthService.refreshSession();
      if (newSession) {
        setSession(newSession);
        backoffDelay.current = 1000; // Reset on success
      } else {
        // Refresh returned null — could be transient or fatal.
        // AuthService.refreshSession already differentiates: it only returns
        // null after clearing auth state for fatal errors OR on transient
        // failures where no prior session exists.
        // For student role: always retry with backoff regardless.
        if (isStudentRole(currentRole)) {
          const nextDelay = backoffDelay.current * 2;
          backoffDelay.current = Math.min(nextDelay, 60000); // Cap at 60s
          console.warn(`[useAuth] Student refresh failed. Retrying in ${backoffDelay.current}ms...`);
          setTimeout(() => handleRefresh('student'), backoffDelay.current);
        } else {
          // Non-student roles: retry with backoff up to 3 attempts, then clear.
          // This fixes the "immediate logout on transient 401" bug.
          if (backoffDelay.current <= 4000) {
            const nextDelay = backoffDelay.current * 2;
            backoffDelay.current = nextDelay;
            console.warn(`[useAuth] Non-student refresh failed. Retrying in ${backoffDelay.current}ms...`);
            setTimeout(() => handleRefresh(currentRole), backoffDelay.current);
          } else {
            // Retries exhausted for non-student — clear session
            await clearAuthState();
            setSession(null);
            backoffDelay.current = 1000; // Reset for next login
          }
        }
      }
    } catch {
      if (isStudentRole(currentRole)) {
        const nextDelay = backoffDelay.current * 2;
        backoffDelay.current = Math.min(nextDelay, 60000);
        setTimeout(() => handleRefresh('student'), backoffDelay.current);
      } else {
        if (backoffDelay.current <= 4000) {
          const nextDelay = backoffDelay.current * 2;
          backoffDelay.current = nextDelay;
          setTimeout(() => handleRefresh(currentRole), backoffDelay.current);
        } else {
          await clearAuthState();
          setSession(null);
          backoffDelay.current = 1000;
        }
      }
    }
  };

  useEffect(() => {
    // Register the API client's logout callback so 401 Unauthorized triggers logout
    registerLogoutCallback(signOut);

    // ── Layer A: AppState listener for Supabase auto-refresh ──
    // CRITICAL FIX: Without this, when Android kills the app process and the
    // user reopens, the Supabase SDK's internal setInterval-based auto-refresh
    // is dead. Calling startAutoRefresh() on 'active' re-arms it.
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        supabase.auth.startAutoRefresh();
      } else if (nextState === 'background' || nextState === 'inactive') {
        supabase.auth.stopAutoRefresh();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    // Start auto-refresh immediately (app is active on mount)
    supabase.auth.startAutoRefresh();

    const initializeAuth = async () => {
      // ── Layer A: Improved cold-start session restoration ──
      // Instead of racing getSession() against a 10-second timeout (which
      // forces a login screen when the backend is slow), we do a two-phase
      // approach:
      //   Phase 1: Read stored session from local storage (fast, no network)
      //   Phase 2: Validate/refresh in background (no timeout pressure)
      let storedSession: AuthSession | null = null;
      try {
        // Phase 1: Fast local read — getSession() reads from SecureTokenStore.
        // If the token is NOT expired, this returns immediately with no network call.
        // If the token IS expired, it triggers refreshSession() which needs network.
        // We give it a generous timeout but DO NOT log out on timeout.
        const AUTH_INIT_TIMEOUT = 15000; // 15 seconds (generous for Render cold start)
        storedSession = await Promise.race([
          AuthService.getSession(),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), AUTH_INIT_TIMEOUT)
          ),
        ]);
        
        if (storedSession) {
          setSession(storedSession);
          // Re-seed the role into SessionPolicy on cold start so the student
          // 401-suppression guard is active immediately, before any refresh.
          const restoredRole = storedSession.validatedUser?.role?.code;
          if (restoredRole && !(await SessionPolicy.getStoredRole())) {
            await SessionPolicy.startSession(restoredRole as any);
          }
        } else {
          // ── Layer B: Student silent restore from SecureStore backup ──
          // If getSession() returned null (storage cleared or timeout),
          // attempt to recover using the backup refresh token in SecureStore.
          // This only helps if a prior session existed — the backup refresh
          // token is written by SecureTokenStore.setItem() on every session write.
          const backupToken = await getBackupRefreshToken();
          if (backupToken) {
            if (__DEV__) console.log('[useAuth] Attempting silent restore from backup refresh token...');
            try {
              const { data, error } = await supabase.auth.refreshSession({
                refresh_token: backupToken,
              });
              if (!error && data.session) {
                if (__DEV__) console.log('[useAuth] Silent restore succeeded');
                // Re-validate with backend (non-blocking — if it fails, we still have the supabase session)
                const restoredSession = await AuthService.refreshSession();
                if (restoredSession) {
                  setSession(restoredSession);
                } else {
                  // Supabase session is valid but backend validation failed — use supabase session data
                  // This keeps the user logged in while backend may be waking up
                  if (__DEV__) console.warn('[useAuth] Silent restore: backend validation pending, using cached session');
                }
              } else {
                if (__DEV__) console.log('[useAuth] Silent restore failed — token invalid, routing to login');
                await clearBackupRefreshToken();
                setSession(null);
              }
            } catch (restoreErr) {
              if (__DEV__) console.error('[useAuth] Silent restore error:', restoreErr);
              setSession(null);
            }
          } else {
            setSession(null);
          }
        }
      } catch (e) {
        console.error('[AUTH_BOOT_FAIL]', e);
        if (__DEV__) console.warn('[useAuth] Auth initialization failed:', e);
        // Don't force logout on init failure — try backup restore for student
        const backupToken = await getBackupRefreshToken();
        if (backupToken) {
          try {
            const { data, error } = await supabase.auth.refreshSession({
              refresh_token: backupToken,
            });
            if (!error && data.session) {
              const restoredSession = await AuthService.refreshSession();
              if (restoredSession) setSession(restoredSession);
            }
          } catch {
            // Silent — will fall through to login screen
          }
        }
        setSession(null);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }

      // 4. Subscribe to auth state changes from Supabase directly
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === 'SIGNED_OUT') {
          // Always clear on explicit sign out — this is deliberate.
          // Student offline persistence applies to TOKEN_REFRESH
          // failures only, handled in handleRefresh().
          await clearAuthState();
          setSession(null);
        } else if (event === 'TOKEN_REFRESHED') {
          // Skip if we just signed in — Supabase fires TOKEN_REFRESHED
          // immediately after sign-in which races with the sign-in flow
          if (justSignedIn.current) {
            if (__DEV__) console.log('[useAuth] Skipping TOKEN_REFRESHED — just signed in');
            return;
          }
          // Do not run async work inside setState — use ref for latest role
          const roleCode = sessionRef.current?.validatedUser?.role?.code || null;
          void handleRefresh(roleCode);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    initializeAuth();

    return () => {
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    // Set guard — suppress TOKEN_REFRESHED for 5 seconds after sign-in
    justSignedIn.current = true;
    setTimeout(() => { justSignedIn.current = false; }, 5000);
    try {
      const result = await AuthService.signIn(email, pass);
      if (result.session) {
        setSession(result.session);
        // Record the role so the role-based session policy + the student
        // 401-suppression guard in apiClient/sessionManager work. Without this
        // the policy layer stays empty and parents (student role) get evicted
        // on the first transient 401.
        const roleCode = result.session.validatedUser?.role?.code;
        if (roleCode) {
          await SessionPolicy.startSession(roleCode as any);
        }
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    await handleRefresh(role);
  };

  return (
    <AuthContext.Provider value={{ session, loading, authChecked, isAppLocked: false, user, role, isStudent, schoolId, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}