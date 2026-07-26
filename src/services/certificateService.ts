import { api } from './apiClient';

export type CertificateTypeCode = 'TC' | 'BONAFIDE';

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
};
