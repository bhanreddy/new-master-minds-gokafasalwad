import { api } from './apiClient';

export type CertificateTypeCode = 'TC' | 'BONAFIDE';

export type IssuedCertificateRecord = {
  id: string;
  student_id: string;
  type: CertificateTypeCode;
  serial_no: string;
  issued_at: string;
  created_at: string;
  admission_no?: string | null;
  student_name?: string | null;
  /** Snapshot used to re-render the certificate (school copy). */
  data?: {
    studentData?: Record<string, unknown>;
    tcFields?: Record<string, unknown>;
  } | null;
};

/**
 * Certificate serials + issue records are best-effort until the backend
 * `/api/v1/certificates` routes are deployed. Use silent requests so a missing
 * route (404) does not interrupt Print / Download PDF with a global Error dialog.
 */
export const CertificateService = {
  /** Returns next serial string like "TC/2025/042" from the Express API. */
  async getNextSerialNo(type: CertificateTypeCode, year: number): Promise<string> {
    const data = await api.get<{ serial_no: string }>(
      '/certificates/next-serial',
      { type, year },
      { silent: true },
    );
    return data.serial_no;
  },

  /** Persist issued certificate record via the Express API. */
  async saveIssuedCertificate(payload: {
    studentId: string;
    type: string;
    serialNo: string;
    issuedAt: string;
    data: object;
  }) {
    await api.post(
      '/certificates',
      {
        student_id: payload.studentId,
        type: payload.type,
        serial_no: payload.serialNo,
        issued_at: payload.issuedAt,
        data: payload.data,
      },
      { silent: true },
    );
  },

  /** List previously issued certificates (newest first). Includes snapshot `data`. */
  async listIssuedCertificates(params?: {
    limit?: number;
    offset?: number;
    type?: CertificateTypeCode;
    studentId?: string;
  }): Promise<IssuedCertificateRecord[]> {
    const rows = await api.get<IssuedCertificateRecord[]>(
      '/certificates',
      {
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
        type: params?.type,
        student_id: params?.studentId,
      },
      { silent: true },
    );
    return Array.isArray(rows) ? rows : [];
  },
};
