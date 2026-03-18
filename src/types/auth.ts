import { Session } from '@supabase/supabase-js';

export interface ValidatedUser {
  userId: string;
  schoolId: number;
  displayName: string;
  photoUrl: string | null;
  role: { code: string; name: string };
  accountStatus: string;
  has_student_profile?: boolean;
  has_staff_profile?: boolean;
}

export interface AuthSession {
  supabaseSession: Session;     // from Supabase
  validatedUser: ValidatedUser; // from backend validation
  tokenExpiresAt: number;       // Unix timestamp
}
