import { api } from './apiClient';

export interface SchoolSettings {
    school_name: string;
    school_address: string;
    school_phone: string;
    school_email: string;
    school_website: string;
    school_logo_url: string;
    school_tagline: string;
    school_affiliation: string;
    school_principal: string;
    /** Optional — e.g. "D.E.O. Vikarabad" for bonafide recognition line */
    school_recognition?: string;
    /** Optional — e.g. "E" / "T" / "English" / "Telugu" for (E/M) / (T/M) suffix */
    school_medium?: string;
    /** Optional — e.g. "State" / "CBSE" */
    school_board?: string;
}

export const SchoolSettingsService = {
    /**
     * Get school settings (name, address, phone, etc.)
     */
    getSettings: async (): Promise<SchoolSettings> => {
        return api.get<SchoolSettings>('/school-settings');
    },
};
