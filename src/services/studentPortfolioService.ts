import { api } from './apiClient';

export interface PortfolioClassSection {
  id: string;
  class_name: string;
  section_name: string;
  source: 'substitution' | 'period_1' | 'class_teacher' | 'admin';
  student_count?: number;
}

export interface PortfolioStudentSummary {
  id: string;
  admission_no: string;
  roll_number?: number | null;
  display_name: string;
  photo_url?: string | null;
  dob?: string | null;
  gender?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  class_section_id?: string | null;
  attendance_total: number;
  attendance_present: number;
  attendance_percentage: number;
  result_exam_count: number;
  result_percentage: number;
  complaint_count: number;
  parent_visit_count: number;
}

export interface StudentPortfolioList {
  date: string;
  academic_year: string;
  class_section: PortfolioClassSection | null;
  class_sections?: PortfolioClassSection[];
  students: PortfolioStudentSummary[];
}

export interface PortfolioParent {
  id: string;
  name: string;
  relationship?: string | null;
  occupation?: string | null;
  phone?: string | null;
  email?: string | null;
  is_primary: boolean;
  is_guardian: boolean;
}

export interface PortfolioExam {
  exam_id: string;
  exam_name: string;
  exam_type?: string | null;
  exam_date?: string | null;
  subjects_count: number;
  obtained: number;
  maximum: number;
  percentage: number;
}

export interface StudentPortfolioDetail {
  date: string;
  school: {
    name: string;
    address?: string | null;
    logo_url?: string | null;
  };
  class_section: PortfolioClassSection;
  student: {
    id: string;
    admission_no: string;
    pen_number?: string | null;
    apar_number?: string | null;
    admission_date: string;
    village?: string | null;
    display_name: string;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    photo_url?: string | null;
    dob?: string | null;
    gender?: string | null;
    nationality?: string | null;
    category?: string | null;
    religion?: string | null;
    blood_group?: string | null;
    student_status?: string | null;
    enrollment_id: string;
    roll_number?: number | null;
    class_name: string;
    section_name: string;
    academic_year: string;
    phone?: string | null;
    email?: string | null;
    parents: PortfolioParent[];
  };
  attendance: {
    total_days: number;
    present: number;
    late: number;
    absent: number;
    half_day: number;
    percentage: number;
  };
  results: {
    percentage: number;
    exam_count: number;
    preview: PortfolioExam[];
  };
  counts: {
    complaints: number;
    parent_visits: number;
  };
}

function staffParams(staffId?: string): Record<string, string> | undefined {
  return staffId ? { staff_id: staffId } : undefined;
}

export const StudentPortfolioService = {
  getRoster(staffId?: string): Promise<StudentPortfolioList> {
    return api.get('/staff/student-portfolio', staffParams(staffId), { silent: true });
  },

  getStudent(studentId: string, staffId?: string): Promise<StudentPortfolioDetail> {
    return api.get(
      `/staff/student-portfolio/${studentId}`,
      staffParams(staffId),
      { silent: true }
    );
  },

  /** Admin: school-wide roster (optional class_section_id filter). */
  getAdminRoster(classSectionId?: string | null): Promise<StudentPortfolioList> {
    return api.get(
      '/admin/student-portfolio',
      classSectionId ? { class_section_id: classSectionId } : undefined,
      { silent: true }
    );
  },

  /** Admin: any active student in the school. */
  getAdminStudent(studentId: string): Promise<StudentPortfolioDetail> {
    return api.get(`/admin/student-portfolio/${studentId}`, undefined, { silent: true });
  },
};
