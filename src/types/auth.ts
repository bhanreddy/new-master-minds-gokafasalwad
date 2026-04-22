import { Session } from '@supabase/supabase-js';

export interface ValidatedUser {
  userId: string;
  schoolId: number;
  displayName: string;
  photoUrl: string | null;
  role: { code: string; name: string };
  accountStatus: string;
  /** staff.id when this login is linked to a staff record (payslips, attendance, etc.) */
  staffId?: string | null;
  has_student_profile?: boolean;
  has_staff_profile?: boolean;
  /** True when admin is logging in with a temporary password that must be changed */
  requiresPasswordChange?: boolean;
}

export interface AuthSession {
  supabaseSession: Session;     // from Supabase
  validatedUser: ValidatedUser; // from backend validation
  tokenExpiresAt: number;       // Unix timestamp
}
