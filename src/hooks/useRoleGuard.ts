import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { Role } from '../types/models';

const getRoleHome = (role: string) => {
  switch (role) {
    case 'admin':return '/admin/dashboard';
    case 'principal':return '/admin/dashboard';
    case 'accountant':return '/accounts/dashboard';
    case 'staff':
    case 'teacher':return '/staff/dashboard';
    case 'driver':return '/driver/dashboard';
    default:return '/(tabs)/home';
  }
};

export function useRoleGuard(allowedRoles: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/welcome');
      return;
    }

    const roleCode = typeof user.role === 'object' && user.role !== null ? (user.role as any).code : user.role;

    if (!allowedRoles.includes(roleCode)) {
      // Unauthorized — redirect to their own dashboard
      router.replace(getRoleHome(roleCode));
    }
  }, [user, loading]);
}