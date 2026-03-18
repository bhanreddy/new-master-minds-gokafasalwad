import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { Role } from '../types/models';
import { ValidatedUser } from '../types/auth';

/**
 * useRequireRole
 *
 * A stricter version of useRoleGuard.
 * Instead of redirecting to the user's default dashboard,
 * it redirects them to an explicit "unauthorized" error screen
 * if they try to access a section they don't have permission for.
 */
export function useRequireRole(...allowedRoles: string[]) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/welcome');
      return;
    }

    // Handle user.role being either a string or an object { code: string, name: string }
    const roleCode = typeof user.role === 'object' && user.role !== null ? (user.role as any).code : user.role;

    if (!allowedRoles.includes(roleCode)) {
      // Unauthorized — redirect to the unauthorized screen
      router.replace('/unauthorized' as any);
    }
  }, [user, loading]);
}
