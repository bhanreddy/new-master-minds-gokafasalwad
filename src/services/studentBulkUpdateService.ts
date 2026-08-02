import { api } from './apiClient';

export type StudentBulkUpdateOption = {
  id: number;
  name: string;
};

export type StudentBulkUpdateField = {
  key: string;
  label: string;
  template_header: string;
  input_type: 'text' | 'date' | 'aadhaar' | 'phone' | 'boolean' | 'reference' | 'pen';
  nullable: boolean;
  example: string;
  rule: string;
  options: StudentBulkUpdateOption[];
};

export type StudentBulkUpdatePreviewRow = {
  row_number: number;
  admission_no: string;
  raw_value: string | null;
  current_value: string | null;
  new_value: string | null;
  status: 'valid' | 'invalid' | 'unchanged' | 'success' | 'failed';
  error_message: string | null;
};

export type StudentBulkUpdateSummary = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  unchanged_rows: number;
};

export type StudentBulkUpdatePreview = {
  batch_id: string;
  field: StudentBulkUpdateField;
  summary: StudentBulkUpdateSummary;
  rows: StudentBulkUpdatePreviewRow[];
  preview_truncated: boolean;
};

export type StudentBulkUpdateCommit = {
  batch_id: string;
  field_key: string;
  field_label: string;
  success_rows: number;
  invalid_rows: number;
  unchanged_rows: number;
  already_committed: boolean;
};

export type StudentBulkUpdateFile = File | {
  uri: string;
  name: string;
  type?: string | null;
};

function appendWorkbook(formData: FormData, file: StudentBulkUpdateFile) {
  if (typeof File !== 'undefined' && file instanceof File) {
    formData.append('file', file);
    return;
  }
  if ('uri' in file) {
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as any);
    return;
  }
  throw new Error('Unsupported file input.');
}

export const StudentBulkUpdateService = {
  TIMEOUT_MS: 180_000,

  listFields: async (): Promise<StudentBulkUpdateField[]> => {
    const response = await api.get<{ fields: StudentBulkUpdateField[] }>('/students/bulk-update/fields');
    return response.fields || [];
  },

  preview: async (
    file: StudentBulkUpdateFile,
    fieldKey: string,
    clearBlank: boolean,
  ): Promise<StudentBulkUpdatePreview> => {
    const formData = new FormData();
    appendWorkbook(formData, file);
    const query = `/students/bulk-update/preview?field=${encodeURIComponent(fieldKey)}&clear_blank=${clearBlank}`;
    return api.uploadFormData<StudentBulkUpdatePreview>(query, formData, {
      timeoutMs: StudentBulkUpdateService.TIMEOUT_MS,
    });
  },

  commit: async (batchId: string): Promise<StudentBulkUpdateCommit> => {
    return api.post<StudentBulkUpdateCommit>(
      `/students/bulk-update/${encodeURIComponent(batchId)}/commit`,
      undefined,
      { timeoutMs: StudentBulkUpdateService.TIMEOUT_MS },
    );
  },

  downloadTemplate: async (field: StudentBulkUpdateField): Promise<void> => {
    await api.downloadFile(
      `/students/bulk-update/template?field=${encodeURIComponent(field.key)}`,
      `student-${field.key}-update-template.xlsx`,
    );
  },

  downloadErrors: async (batchId: string): Promise<void> => {
    await api.downloadFile(
      `/students/bulk-update/${encodeURIComponent(batchId)}/errors`,
      `student-bulk-update-errors-${batchId}.xlsx`,
    );
  },
};
