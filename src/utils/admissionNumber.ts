export type AdmissionNumberType = 'dummy' | 'permanent' | 'custom' | 'empty';

const DUMMY_ADMISSION_RE = /^Dummy(\d+)$/i;
const PERMANENT_ADMISSION_RE = /^\d+$/;

/**
 * Classify the two generated admission-number formats without misclassifying
 * legacy/custom values such as ADM2024001.
 */
export function detectAdmissionNumberType(value?: string | null): AdmissionNumberType {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 'empty';
  if (DUMMY_ADMISSION_RE.test(normalized)) return 'dummy';
  if (PERMANENT_ADMISSION_RE.test(normalized)) return 'permanent';
  return 'custom';
}

export function admissionNumberTypeLabel(type: AdmissionNumberType): string {
  switch (type) {
    case 'dummy':
      return 'Temporary / Dummy';
    case 'permanent':
      return 'Permanent / Numeric';
    case 'custom':
      return 'Custom format';
    default:
      return 'Not selected';
  }
}

