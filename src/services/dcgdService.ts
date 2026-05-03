import { api } from './apiClient';

export type DcgdProgram = {
  id: number;
  name: string;
  description: string;
  icon: string;
  display_order: number;
  is_active: boolean;
};

export type DcgdStudentProfile = {
  name: string | null;
  photo_url: string | null;
  admission_no: string | null;
  roll_number: number | null;
  class_section_label: string | null;
};

export type DcgdPagePayload = {
  visible: boolean;
  settings: {
    page_title: string;
    subtitle: string;
    updated_at?: string;
  } | null;
  programs: DcgdProgram[];
  profile: DcgdStudentProfile | null;
};

/** Student DCGD payload from SchoolIMS API (backed by Nexsyrus DCGD microservice data in Postgres). */
export async function fetchStudentDcgdPage(): Promise<DcgdPagePayload | null> {
  try {
    return await api.get<DcgdPagePayload>('/dcgd', undefined, { silent: true });
  } catch {
    return null;
  }
}

export type DcgdContentItem = {
  id: number;
  title: string;
  link_url: string | null;
  pdf_url: string | null;
  image_url: string | null;
  content_body: string | null;
  display_order: number;
};

export type DcgdProgramContentPayload = {
  program: {
    id: number;
    name: string;
    description: string;
    icon: string;
  };
  content: DcgdContentItem[];
};

/** Fetch content for a specific program. */
export async function fetchProgramContent(
  programId: number,
): Promise<DcgdProgramContentPayload | null> {
  try {
    return await api.get<DcgdProgramContentPayload>(
      `/dcgd/programs/${programId}/content`,
      undefined,
      { silent: true },
    );
  } catch {
    return null;
  }
}
