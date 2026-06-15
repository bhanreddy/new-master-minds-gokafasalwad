import { api } from './apiClient';
import { SCHOOL_ID } from '../constants/school';

export interface SchoolProfile {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  affiliation: string | null;
  logo_url: string | null;
}

export const SchoolService = {
  /** School branding for PDFs and headers — tenant from JWT, not client-supplied id. */
  getProfile: async (): Promise<SchoolProfile> => {
    return api.get<SchoolProfile>(`/schools/${SCHOOL_ID}/profile`, undefined, { silent: true });
  },
};
