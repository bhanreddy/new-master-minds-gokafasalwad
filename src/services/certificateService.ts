import { supabase } from './supabaseConfig';

export const CertificateService = {
    // Returns next serial string like "TC/2025/042"
    async getNextSerialNo(type: 'TC' | 'BONAFIDE', year: number): Promise<string> {
        const { data, error } = await supabase.rpc('next_certificate_serial', { cert_type: type, cert_year: year });
        if (error) {
            console.error("Error fetching next serial no", error);
            throw error;
        }
        return data; // e.g. "TC/2025/042"
    },

    // Persist issued certificate record
    async saveIssuedCertificate(payload: {
        studentId: string; type: string; serialNo: string;
        issuedAt: string; data: object;
    }) {
        const { error } = await supabase.from('issued_certificates').insert({
            student_id: payload.studentId,
            type: payload.type,
            serial_no: payload.serialNo,
            issued_at: payload.issuedAt,
            data: payload.data
        });
        if (error) {
            console.error("Error saving issued certificate", error);
            throw error;
        }
    },
};
