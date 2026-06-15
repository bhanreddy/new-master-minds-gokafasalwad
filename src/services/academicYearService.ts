import { api } from './apiClient';

// --- Types ---

export interface AcademicYear {
  id: string;
  code: string;
  start_date: string;
  end_date: string;
}

export interface UpgradePreview {
  from_year: AcademicYear;
  to_year: AcademicYear | null;
  upgrade_count: number;
  graduate_count: number;
  total: number;
  max_sort_order: number;
  has_next_year: boolean;
}

export interface UpgradeResult {
  success: boolean;
  upgraded_count: number;
  graduated_count: number;
  new_year: string;
}

// --- Service ---

export const AcademicYearService = {
  /**
   * Get all academic years for this school (for picker)
   */
  getAllYears: async (): Promise<AcademicYear[]> => {
    return api.get<AcademicYear[]>('/academics/academic-years', undefined, { silent: true });
  },

  /**
   * Get the current active academic year for this school
   */
  getCurrentYear: async (): Promise<AcademicYear> => {
    return api.get<AcademicYear>('/admin/academic-year/current', undefined, { silent: true });
  },

  /**
   * Set the active academic year for this school
   */
  setCurrentYear: async (academicYearId: string): Promise<AcademicYear> => {
    return api.post<AcademicYear>('/admin/academic-year/set-current', {
      academic_year_id: academicYearId,
    }, { silent: true });
  },

  /**
   * Dry-run preview: how many students will be promoted vs graduated
   */
  getUpgradePreview: async (): Promise<UpgradePreview> => {
    return api.get<UpgradePreview>('/admin/academic-year/preview', undefined, { silent: true });
  },

  /**
   * Execute the bulk academic year upgrade
   */
  executeUpgrade: async (fromYear: string, toYear: string): Promise<UpgradeResult> => {
    return api.post<UpgradeResult>('/admin/academic-year/upgrade', {
      from_year: fromYear,
      to_year: toYear,
    }, { silent: true });
  },
};
