export interface School {
  id: number;
  name: string;
  code: string;
  address: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SchoolHealth {
  school_id: number;
  student_count: number;
  staff_count: number;
  user_count: number;
  last_activity: string | null;
  defaults_seeded: boolean;
  first_admin_exists: boolean;
}
