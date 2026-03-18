import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseConfig';
import { AuthService, clearAuthState } from '../services/authService';
import { AuthSession, ValidatedUser } from '../types/auth';
import { SCHOOL_ID } from '../constants/school';

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
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const backoffDelay = useRef(1000); // Start at 1s
  const justSignedIn = useRef(false); // Guard against TOKEN_REFRESHED race after sign-in

  const user = session?.validatedUser || null;
  const role = user?.role?.code || null;
  const isStudent = role === 'student';
  const schoolId = user ? SCHOOL_ID : null;

  // Core refresh logic invoked internally or explicitly
  const handleRefresh = async (currentRole: string | null) => {
    try {
      const newSession = await AuthService.refreshSession();
      if (newSession) {
        setSession(newSession);
        backoffDelay.current = 1000; // Reset on success
      } else {
        // Refresh failed (either Supabase rejected it or Backend API rejected it)
        if (currentRole === 'student') {
          // Exponential backoff retry for students
          const nextDelay = backoffDelay.current * 2;
          backoffDelay.current = Math.min(nextDelay, 60000); // Cap at 60s
          console.warn(`[useAuth] Student refresh failed. Retrying in ${backoffDelay.current}ms...`);
          setTimeout(() => handleRefresh('student'), backoffDelay.current);
        } else {
          // Other roles: clear session
          await clearAuthState();
          setSession(null);
        }
      }
    } catch {
      if (currentRole === 'student') {
        const nextDelay = backoffDelay.current * 2;
        backoffDelay.current = Math.min(nextDelay, 60000);
        setTimeout(() => handleRefresh('student'), backoffDelay.current);
      } else {
        await clearAuthState();
        setSession(null);
      }
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // Race against a timeout to prevent the app from being stuck
      // on the splash screen if backend/Supabase is unreachable.
      const AUTH_INIT_TIMEOUT = 10000; // 10 seconds
      let storedSession: AuthSession | null = null;
      try {
        storedSession = await Promise.race([
          AuthService.getSession(),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Auth init timeout')), AUTH_INIT_TIMEOUT)
          ),
        ]);
      } catch (e) {
        if (__DEV__) console.warn('[useAuth] Auth initialization timed out or failed:', e);
        storedSession = null;
      }

      if (storedSession) {
        setSession(storedSession);
      } else {
        setSession(null);
      }
      setLoading(false);

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
          // Silently trigger a refresh loop to push new tokens to the backend & update SecureStore
          // We must grab the 'role' dynamically here to handle backoff properly.
          setSession((prev) => {
            handleRefresh(prev?.validatedUser?.role?.code || null);
            return prev;
          });
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    initializeAuth();
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
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await AuthService.signOut();
    setSession(null);
    setLoading(false);
  };

  const refreshSession = async () => {
    await handleRefresh(role);
  };

  return (
    <AuthContext.Provider value={{ session, loading, user, role, isStudent, schoolId, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}