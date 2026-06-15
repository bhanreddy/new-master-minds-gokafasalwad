import { api } from './apiClient';

export type ImportPreviewRow = {
  row_number: number;
  full_name: string | null;
  admission_no: string;
  stop_name: string;
  route_name: string | null;
  status: 'valid' | 'invalid' | 'success' | 'failed';
  error_message: string | null;
  warning_message: string | null;
};

export type ImportPreviewSummary = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warning_rows: number;
};

export type ImportPreviewResponse = {
  batch_id: string;
  academic_year_id: string;
  summary: ImportPreviewSummary;
  rows: ImportPreviewRow[];
};

export type ImportCommitResponse = {
  batch_id: string;
  success_rows: number;
  failed_rows: number;
  skipped_rows: number;
};

export type ImportBatchListItem = {
  id: string;
  original_filename: string | null;
  status: 'preview' | 'committed' | 'failed';
  total_rows: number;
  valid_rows: number;
  success_rows: number;
  failed_rows: number;
  created_at: string;
  committed_at: string | null;
  academic_year_code?: string | null;
  uploaded_by_name?: string | null;
};

export const TransportImportService = {
  /** Long-running bulk import — allow up to 3 minutes on slow connections / large files. */
  IMPORT_TIMEOUT_MS: 180_000,

  previewFromFile: async (
    file: File | { uri: string; name: string; type?: string },
    academicYearId?: string,
  ): Promise<ImportPreviewResponse> => {
    const formData = new FormData();

    if (typeof File !== 'undefined' && file instanceof File) {
      formData.append('file', file);
    } else if ('uri' in file) {
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any);
    } else {
      throw new Error('Unsupported file input');
    }

    const query = academicYearId
      ? `/transport/import/preview?academic_year_id=${encodeURIComponent(academicYearId)}`
      : '/transport/import/preview';

    return api.uploadFormData<ImportPreviewResponse>(query, formData, {
      timeoutMs: TransportImportService.IMPORT_TIMEOUT_MS,
    });
  },

  commit: async (batchId: string): Promise<ImportCommitResponse> => {
    return api.post<ImportCommitResponse>(`/transport/import/${batchId}/commit`, undefined, {
      timeoutMs: TransportImportService.IMPORT_TIMEOUT_MS,
    });
  },

  getBatch: async (batchId: string, page = 1, limit = 200) => {
    return api.get<{ batch: ImportBatchListItem; rows: ImportPreviewRow[] }>(
      `/transport/import/${batchId}`,
      { page, limit },
    );
  },

  listBatches: async (page = 1, limit = 20) => {
    return api.get<{ batches: ImportBatchListItem[]; page: number; limit: number }>(
      '/transport/import/batches',
      { page, limit },
    );
  },

  downloadTemplate: async (): Promise<void> => {
    return api.downloadFile('/transport/import/template', 'transport-stop-assignment-template.xlsx');
  },

  downloadFailures: async (batchId: string): Promise<void> => {
    return api.downloadFile(
      `/transport/import/${batchId}/failures/export`,
      `transport-import-failures-${batchId}.xlsx`,
    );
  },
};
