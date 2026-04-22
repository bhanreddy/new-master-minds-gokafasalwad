import { api } from './apiClient';

export interface UpiSchoolSettings {
  upi_id: string;
  display_name: string;
}

export const UpiSettingsService = {
  get: (): Promise<UpiSchoolSettings> => api.get<UpiSchoolSettings>('/settings/upi'),

  put: (body: { upi_id: string; display_name: string }): Promise<UpiSchoolSettings & { message?: string }> =>
    api.put<UpiSchoolSettings & { message?: string }>('/settings/upi', body),
};
