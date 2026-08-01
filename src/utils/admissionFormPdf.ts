import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';
import { SCHOOL_CONFIG, SCHOOL_RECOGNITION_LINE } from '../constants/schoolConfig';
import { BLOOD_GROUPS, RELIGIONS, STUDENT_CATEGORIES, STUDENT_STATUSES } from '../constants/references';
import { loadLogoAsBase64, escapeHtml, printHtmlOnWeb } from './pdfGenerator';
import { getImageDataUri } from './certificatePrint';
import { studentGenderLabel } from '../components/studentFormControls';
import { resolveApiAssetUrl } from './toBase64Uri';

/**
 * Admission form PDF — print-first institutional dossier layout:
 *  • Self-contained HTML (inline <style>, base64 logo).
 *  • Black-ink hierarchy + ruled frames (no solid colour fills) so B&W prints stay sharp.
 *  • Web: printHtmlOnWeb iframe dialog · Native: expo-print / shareAsync.
 * School identity comes from SCHOOL_CONFIG.
 */

export interface AdmissionParent {
  name: string;
  phone?: string;
  occupation?: string;
  relation: string;
}

export interface AdmissionFormData {
  fullName: string;
  dob?: string;
  gender?: string;
  category?: string;
  religion?: string;
  bloodGroup?: string;
  admissionNo: string;
  penNumber?: string;
  rollNumber?: string;
  admissionDate?: string;
  academicYear?: string;
  className?: string;
  sectionName?: string;
  status?: string;
  email?: string;
  phone?: string;
  aadhaarNumber?: string;
  tcNumber?: string;
  previousSchool?: string;
  /** Local URI, remote URL, or data URI for the student photo. */
  photoUri?: string | null;
  parents: AdmissionParent[];
}

type RefItem = { id: number | string; name: string; code?: string };

const labelFor = (list: RefItem[], id: number | string | undefined | null): string | undefined => {
  if (id == null || id === '') return undefined;
  return list.find((x) => String(x.id) === String(id))?.name;
};

const formatDate = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Parse DOB into zero-padded DD / MM / YYYY for digit-box rendering. */
const parseDobParts = (raw?: string | null): { dd: string; mm: string; yyyy: string; age?: number } | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  // Prefer calendar parts from YYYY-MM-DD to avoid UTC timezone day-shift.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }
  if (!year || !month || !day) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const hadBirthday =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hadBirthday) age -= 1;
  return {
    dd: String(day).padStart(2, '0'),
    mm: String(month).padStart(2, '0'),
    yyyy: String(year),
    age: age >= 0 && age < 120 ? age : undefined,
  };
};

const digitCells = (chars: string, length: number) => {
  const padded = chars.replace(/\D/g, '').padEnd(length, ' ').slice(0, length);
  return padded
    .split('')
    .map((ch) =>
      ch === ' '
        ? `<span class="dbox empty-d">·</span>`
        : `<span class="dbox">${escapeHtml(ch)}</span>`
    )
    .join('');
};

const dobDigitBlock = (raw?: string | null) => {
  const parts = parseDobParts(raw);
  const dd = parts?.dd || '  ';
  const mm = parts?.mm || '  ';
  const yyyy = parts?.yyyy || '    ';
  const ageHtml =
    parts?.age != null
      ? `<span class="age-pill">${parts.age} year${parts.age === 1 ? '' : 's'} old</span>`
      : '';
  return `
  <div class="code-block">
    <div class="code-label">Date of Birth ${ageHtml}</div>
    <div class="dob-row">
      <div class="dob-unit">
        <div class="unit-top">Date</div>
        <div class="cluster">${digitCells(dd, 2)}</div>
        <div class="unit-bot">DD</div>
      </div>
      <span class="dob-sep">/</span>
      <div class="dob-unit">
        <div class="unit-top">Month</div>
        <div class="cluster">${digitCells(mm, 2)}</div>
        <div class="unit-bot">MM</div>
      </div>
      <span class="dob-sep">/</span>
      <div class="dob-unit">
        <div class="unit-top">Year</div>
        <div class="cluster">${digitCells(yyyy, 4)}</div>
        <div class="unit-bot">YYYY</div>
      </div>
    </div>
  </div>`;
};

const aadhaarDigitBlock = (raw?: string | null) => {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 12);
  const g1 = digits.slice(0, 4);
  const g2 = digits.slice(4, 8);
  const g3 = digits.slice(8, 12);
  return `
  <div class="code-block">
    <div class="code-label">Aadhaar Number</div>
    <div class="aadhaar-row">
      <div class="cluster">${digitCells(g1, 4)}</div>
      <span class="aadhaar-dot">•</span>
      <div class="cluster">${digitCells(g2, 4)}</div>
      <span class="aadhaar-dot">•</span>
      <div class="cluster">${digitCells(g3, 4)}</div>
    </div>
  </div>`;
};

/**
 * Resolve the raw add-student screen state (IDs + reference lists) into a clean,
 * display-ready AdmissionFormData. Shared by the admin and accounts screens.
 */
export function buildAdmissionFormData(input: {
  formData: any;
  father?: { first_name?: string; last_name?: string; phone?: string; occupation?: string };
  mother?: { first_name?: string; last_name?: string; phone?: string; occupation?: string };
  guardian?: { first_name?: string; last_name?: string; phone?: string; occupation?: string; relation?: string };
  classes?: RefItem[];
  sections?: RefItem[];
  academicYears?: Array<{ id: string; code?: string; name?: string }>;
  photoUri?: string | null;
}): AdmissionFormData {
  const { formData, father, mother, guardian, classes = [], sections = [], academicYears = [], photoUri } = input;

  const fullName = [formData.first_name, formData.middle_name, formData.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Student';

  const parents: AdmissionParent[] = [];
  const pName = (p?: { first_name?: string; last_name?: string }) =>
    [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
  if (father && pName(father)) {
    parents.push({ name: pName(father), phone: father.phone, occupation: father.occupation, relation: 'Father' });
  }
  if (mother && pName(mother)) {
    parents.push({ name: pName(mother), phone: mother.phone, occupation: mother.occupation, relation: 'Mother' });
  }
  if (guardian && pName(guardian)) {
    parents.push({
      name: pName(guardian),
      phone: guardian.phone,
      occupation: guardian.occupation,
      relation: guardian.relation || 'Guardian',
    });
  }

  const academicYear =
    academicYears.find((y) => String(y.id) === String(formData.academic_year_id))?.code ||
    academicYears.find((y) => String(y.id) === String(formData.academic_year_id))?.name;

  const previousSchool =
    formData.previous_school === true ? 'Yes'
      : formData.previous_school === false ? 'No'
        : undefined;

  return {
    fullName,
    // Keep ISO/raw DOB so the print form can render DD/MM/YYYY digit boxes.
    dob: formData.dob || undefined,
    gender: studentGenderLabel(formData.gender_id),
    category: labelFor(STUDENT_CATEGORIES, formData.category_id),
    religion: labelFor(RELIGIONS, formData.religion_id),
    bloodGroup: labelFor(BLOOD_GROUPS, formData.blood_group_id),
    admissionNo: formData.admission_no || '—',
    penNumber: formData.pen_number?.trim() || undefined,
    rollNumber: formData.roll_number != null && formData.roll_number !== '' ? String(formData.roll_number) : undefined,
    admissionDate: formatDate(formData.admission_date),
    academicYear,
    className: labelFor(classes, formData.class_id),
    sectionName: labelFor(sections, formData.section_id),
    status: labelFor(STUDENT_STATUSES, formData.status_id),
    email: formData.email?.trim() || undefined,
    phone: formData.phone?.trim() || undefined,
    // Keep raw digits (display formatting happens in the digit-box renderer).
    aadhaarNumber: String(formData.aadhaar_number || '').replace(/\D/g, '').slice(0, 12) || undefined,
    tcNumber: previousSchool === 'Yes' ? (formData.tc_number?.trim() || undefined) : undefined,
    previousSchool,
    photoUri: photoUri || undefined,
    parents,
  };
}

// ─── HTML builder ────────────────────────────────────────────────────────────
// Print-first architecture: black ink, ruled frames, typographic hierarchy.
// Colour fills are avoided so B&W prints stay sharp and legible.

const INK = '#111111';
const MUTED = '#555555';
const FAINT = '#8A8A8A';
const RULE = '#1A1A1A';
const RULE_SOFT = '#C8C8C8';
const PAPER = '#FFFFFF';

const val = (v?: string | null) =>
  v ? escapeHtml(v) : '<span class="empty">—</span>';

const cell = (label: string, value?: string | null) => `
  <div class="cell">
    <div class="cell-k">${escapeHtml(label)}</div>
    <div class="cell-v">${val(value)}</div>
  </div>`;

const metaChip = (label: string, value?: string | null) => `
  <div class="meta-chip">
    <span class="meta-k">${escapeHtml(label)}</span>
    <span class="meta-v">${val(value)}</span>
  </div>`;

const parentRow = (p: AdmissionParent) => `
  <tr>
    <td class="p-rel">${escapeHtml(p.relation)}</td>
    <td class="p-name">${escapeHtml(p.name)}</td>
    <td>${p.phone ? escapeHtml(p.phone) : '—'}</td>
    <td>${p.occupation ? escapeHtml(p.occupation) : '—'}</td>
  </tr>`;

const sectionHead = (num: string, title: string) => `
  <div class="sec-head">
    <span class="sec-num">${escapeHtml(num)}</span>
    <span class="sec-title">${escapeHtml(title)}</span>
    <span class="sec-rule"></span>
  </div>`;

export async function buildAdmissionFormHtml(data: AdmissionFormData): Promise<string> {
  const logoBase64 = await loadLogoAsBase64(SCHOOL_CONFIG.logo);
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" class="logo" alt="" />`
    : `<div class="logo-fallback">${escapeHtml(SCHOOL_CONFIG.name.slice(0, 2).toUpperCase())}</div>`;
  const watermarkHtml = logoBase64
    ? `<img src="${logoBase64}" class="watermark" alt="" />`
    : '';

  const photoSource = data.photoUri
    ? (data.photoUri.startsWith('data:') || data.photoUri.startsWith('file:') || data.photoUri.startsWith('blob:')
      ? data.photoUri
      : resolveApiAssetUrl(data.photoUri) || data.photoUri)
    : null;
  const photoDataUri = photoSource ? await getImageDataUri(photoSource) : null;
  const photoHtml = photoDataUri
    ? `<img src="${photoDataUri}" class="photo-img" alt="Student photo" />`
    : `<div class="photo-empty"><span>Passport<br/>Photo</span></div>`;

  const schoolMetaLine = [
    SCHOOL_CONFIG.contact ? `Tel ${SCHOOL_CONFIG.contact}` : '',
    SCHOOL_CONFIG.email || '',
    SCHOOL_CONFIG.schoolCode && SCHOOL_CONFIG.schoolCode !== 'NA' ? `Code ${SCHOOL_CONFIG.schoolCode}` : '',
    SCHOOL_CONFIG.cbseAffiliationNo && SCHOOL_CONFIG.cbseAffiliationNo !== 'NA'
      ? `Aff. ${SCHOOL_CONFIG.cbseAffiliationNo}` : '',
  ].filter(Boolean).join('  ·  ');

  const parentsHtml = data.parents.length
    ? data.parents.map(parentRow).join('')
    : `<tr><td colspan="4" class="empty-row">No parent / guardian details recorded</td></tr>`;

  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const classLine = [data.className, data.sectionName].filter(Boolean).join(' — ') || '—';

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @page { margin: 5mm 6mm; size: A4 portrait; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: ${PAPER};
          height: auto;
        }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif;
          color: ${INK};
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .sheet {
          position: relative;
          width: 100%;
          max-width: 794px;
          margin: 0 auto;
          padding: 10px 12px 8px;
          background: ${PAPER};
          border: 1.5px double ${RULE};
          page-break-after: avoid;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .watermark {
          position: absolute;
          top: 52%;
          left: 50%;
          width: 280px;
          transform: translate(-50%, -50%);
          opacity: 0.03;
          z-index: 0;
          pointer-events: none;
        }
        .content { position: relative; z-index: 1; }

        /* ── Letterhead ── */
        .letterhead {
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 10px;
          align-items: center;
          padding-bottom: 6px;
        }
        .logo {
          width: 52px; height: 52px;
          object-fit: contain;
          border: 1px solid ${RULE};
          padding: 2px;
          background: ${PAPER};
        }
        .logo-fallback {
          width: 52px; height: 52px;
          border: 1px solid ${RULE};
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px; letter-spacing: 0.5px;
        }
        .school-block { min-width: 0; }
        .school-name {
          font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.15px;
          line-height: 1.1;
          color: ${INK};
        }
        .school-tag {
          margin-top: 1px;
          font-size: 9px;
          font-style: italic;
          letter-spacing: 0.3px;
          color: ${MUTED};
        }
        .school-addr, .school-meta {
          margin-top: 1px;
          font-size: 8.5px;
          line-height: 1.3;
          color: ${MUTED};
        }
        .seal-mark { text-align: right; align-self: start; padding-top: 2px; }
        .seal-mark .doc-label {
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: ${FAINT};
        }
        .seal-mark .doc-code {
          margin-top: 2px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.4px;
          color: ${INK};
          font-variant-numeric: tabular-nums;
        }

        .double-rule {
          border-top: 2px solid ${RULE};
          border-bottom: 0.6px solid ${RULE};
          height: 3.5px;
        }

        .doc-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 7px 0 8px;
        }
        .doc-title .line { flex: 1; height: 1px; background: ${RULE}; }
        .doc-title h1 {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          white-space: nowrap;
          color: ${INK};
        }

        /* ── Identity dossier ── */
        .dossier {
          display: grid;
          grid-template-columns: 1fr 96px;
          gap: 10px;
          margin-bottom: 8px;
          padding: 7px 8px 6px;
          border: 1px solid ${RULE};
        }
        .dossier-name {
          font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.05;
          color: ${INK};
        }
        .dossier-sub {
          margin-top: 2px;
          font-size: 9px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: ${MUTED};
          font-weight: 600;
        }
        .meta-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          margin-top: 6px;
          border-top: 1px solid ${RULE};
        }
        .meta-chip {
          padding: 5px 8px 1px 0;
          border-right: 1px solid ${RULE_SOFT};
        }
        .meta-chip:nth-child(3n) { border-right: none; padding-right: 0; }
        .meta-chip:nth-child(n+4) {
          border-top: 1px solid ${RULE_SOFT};
          padding-top: 5px;
        }
        .meta-k {
          display: block;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: ${FAINT};
        }
        .meta-v {
          display: block;
          margin-top: 1px;
          font-size: 11px;
          font-weight: 700;
          color: ${INK};
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
        }

        .photo-frame {
          border: 1px solid ${RULE};
          height: 112px;
          display: flex;
          flex-direction: column;
          background: ${PAPER};
        }
        .photo-cap {
          border-bottom: 1px solid ${RULE};
          text-align: center;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          padding: 2px;
          color: ${INK};
        }
        .photo-body {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .photo-img { width: 100%; height: 100%; object-fit: cover; }
        .photo-empty {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          font-size: 8px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: ${FAINT}; line-height: 1.3;
          background: repeating-linear-gradient(-45deg, ${PAPER}, ${PAPER} 5px, #F4F4F4 5px, #F4F4F4 6px);
        }

        /* ── Sections ── */
        .section { margin-bottom: 7px; }
        .sec-head {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 4px;
        }
        .sec-num {
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: 1px;
          color: ${INK};
          border: 1px solid ${RULE};
          min-width: 22px;
          text-align: center;
          padding: 1px 4px;
          font-variant-numeric: tabular-nums;
        }
        .sec-title {
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: ${INK};
          white-space: nowrap;
        }
        .sec-rule { flex: 1; height: 1px; background: ${RULE}; }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid ${RULE};
        }
        .grid-2 { grid-template-columns: repeat(2, 1fr); }
        .cell {
          padding: 4px 7px 4px;
          border-right: 1px solid ${RULE_SOFT};
          border-bottom: 1px solid ${RULE_SOFT};
        }
        .grid .cell:nth-child(3n) { border-right: none; }
        .grid-2 .cell:nth-child(2n) { border-right: none; }
        .grid .cell:nth-last-child(-n+3) { border-bottom: none; }
        .grid-2 .cell:nth-last-child(-n+2) { border-bottom: none; }
        .cell-k {
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          color: ${FAINT};
        }
        .cell-v {
          margin-top: 1px;
          font-size: 11px;
          font-weight: 600;
          color: ${INK};
          line-height: 1.2;
          word-break: break-word;
        }
        .empty { color: ${FAINT}; font-weight: 500; }

        /* ── Digit boxes: DOB + Aadhaar side by side ── */
        .code-panel {
          margin-top: 5px;
          border: 1px solid ${RULE};
          padding: 6px 8px 5px;
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 10px;
          align-items: end;
        }
        .code-block { min-width: 0; }
        .code-block + .code-block {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
          border-left: 1px solid ${RULE_SOFT};
          padding-left: 10px;
        }
        .code-label {
          font-size: 7.5px;
          font-weight: 800;
          letter-spacing: 0.9px;
          text-transform: uppercase;
          color: ${FAINT};
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dob-row, .aadhaar-row {
          display: flex;
          align-items: flex-end;
          flex-wrap: nowrap;
          gap: 4px;
        }
        .dob-unit {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .unit-top {
          font-size: 7.5px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: ${INK};
        }
        .unit-bot {
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.6px;
          color: ${FAINT};
        }
        .dob-sep {
          font-size: 13px;
          font-weight: 300;
          color: ${FAINT};
          padding-bottom: 12px;
          line-height: 1;
        }
        .aadhaar-dot {
          font-size: 11px;
          color: ${FAINT};
          padding-bottom: 4px;
          line-height: 1;
        }
        .cluster {
          display: inline-flex;
          gap: 2px;
          padding: 3px 3px;
          border: 1px solid ${RULE};
          background: #F2F2F2;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .dbox {
          width: 16px;
          height: 19px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${RULE};
          background: ${PAPER};
          font-size: 11px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: ${INK};
          line-height: 1;
        }
        .dbox.empty-d { color: ${RULE_SOFT}; font-weight: 500; }
        .age-pill {
          border: 1px solid ${RULE};
          padding: 1px 6px;
          font-size: 8px;
          font-weight: 700;
          color: ${INK};
          background: ${PAPER};
          white-space: nowrap;
          text-transform: none;
          letter-spacing: 0;
        }

        /* ── Parents table ── */
        table.parents {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
          border: 1px solid ${RULE};
        }
        table.parents th {
          text-align: left;
          font-size: 7.5px;
          font-weight: 800;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: ${INK};
          padding: 4px 7px;
          border-bottom: 1px solid ${RULE};
          border-right: 1px solid ${RULE_SOFT};
          background: ${PAPER};
        }
        table.parents th:last-child,
        table.parents td:last-child { border-right: none; }
        table.parents td {
          padding: 4px 7px;
          border-bottom: 1px solid ${RULE_SOFT};
          border-right: 1px solid ${RULE_SOFT};
          color: ${INK};
          vertical-align: top;
        }
        table.parents tr:last-child td { border-bottom: none; }
        table.parents td.p-rel { font-weight: 800; width: 90px; }
        table.parents td.p-name { font-weight: 600; }
        table.parents td.empty-row {
          text-align: center;
          color: ${FAINT};
          font-style: italic;
          padding: 6px 7px;
        }

        /* ── Declaration ── */
        .declaration {
          border: 1px solid ${RULE};
          padding: 6px 8px;
        }
        .declaration .d-label {
          font-size: 7.5px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: ${INK};
          margin-bottom: 2px;
        }
        .declaration .d-text {
          font-size: 9px;
          line-height: 1.35;
          color: ${MUTED};
        }
        .declaration .d-text strong { color: ${INK}; font-weight: 700; }

        /* ── Signatures ── */
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-top: 14px;
        }
        .sign { text-align: center; }
        .sign-space { height: 18px; }
        .sign-line {
          border-top: 1.25px solid ${INK};
          padding-top: 3px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: ${INK};
        }
        .sign-hint {
          margin-top: 1px;
          font-size: 7.5px;
          color: ${FAINT};
        }

        /* ── Footer ── */
        .footer {
          margin-top: 8px;
          padding-top: 5px;
          border-top: 1px solid ${RULE};
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
          font-size: 7.5px;
          color: ${FAINT};
        }
        .footer .left { flex: 1; }
        .footer .right { white-space: nowrap; font-variant-numeric: tabular-nums; }
      </style>
    </head>
    <body>
      <div class="sheet">
        ${watermarkHtml}
        <div class="content">
          <header class="letterhead">
            ${logoHtml}
            <div class="school-block">
              <div class="school-name">${escapeHtml(SCHOOL_CONFIG.name)}</div>
              ${SCHOOL_CONFIG.tagline ? `<div class="school-tag">${escapeHtml(SCHOOL_CONFIG.tagline)}</div>` : ''}
              ${SCHOOL_CONFIG.address ? `<div class="school-addr">${escapeHtml(SCHOOL_CONFIG.address)}${SCHOOL_RECOGNITION_LINE ? `  ·  ${escapeHtml(SCHOOL_RECOGNITION_LINE)}` : ''}</div>` : ''}
              ${schoolMetaLine ? `<div class="school-meta">${escapeHtml(schoolMetaLine)}</div>` : ''}
            </div>
            <div class="seal-mark">
              <div class="doc-label">Official Record</div>
              <div class="doc-code">ADM / ${escapeHtml(data.admissionNo)}</div>
            </div>
          </header>

          <div class="double-rule"></div>

          <div class="doc-title">
            <span class="line"></span>
            <h1>Student Admission Form</h1>
            <span class="line"></span>
          </div>

          <section class="dossier" aria-label="Student identity">
            <div>
              <div class="dossier-name">${escapeHtml(data.fullName)}</div>
              <div class="dossier-sub">Class ${escapeHtml(classLine)}${data.status ? `  ·  ${escapeHtml(data.status)}` : ''}</div>
              <div class="meta-row">
                ${metaChip('Admission No', data.admissionNo)}
                ${metaChip('Academic Year', data.academicYear)}
                ${metaChip('Admission Date', data.admissionDate)}
                ${metaChip('Class', data.className)}
                ${metaChip('Section', data.sectionName)}
                ${metaChip('Roll No', data.rollNumber)}
              </div>
            </div>
            <div class="photo-frame">
              <div class="photo-cap">Photo</div>
              <div class="photo-body">${photoHtml}</div>
            </div>
          </section>

          <section class="section">
            ${sectionHead('01', 'Personal Particulars')}
            <div class="grid">
              ${cell('Gender', data.gender)}
              ${cell('Category', data.category)}
              ${cell('Religion', data.religion)}
              ${cell('Blood Group', data.bloodGroup)}
              ${cell('PEN Number', data.penNumber)}
              ${cell('Status', data.status)}
              ${cell('Previous School', data.previousSchool)}
              ${cell('TC Number', data.tcNumber)}
              ${cell('Phone', data.phone)}
              ${cell('Email', data.email)}
              ${cell('Roll No', data.rollNumber)}
              ${cell('Academic Year', data.academicYear)}
            </div>
            <div class="code-panel">
              ${dobDigitBlock(data.dob)}
              ${aadhaarDigitBlock(data.aadhaarNumber)}
            </div>
          </section>

          <section class="section">
            ${sectionHead('02', 'Parent / Guardian')}
            <table class="parents">
              <thead>
                <tr>
                  <th style="width:90px">Relation</th>
                  <th>Name</th>
                  <th style="width:120px">Phone</th>
                  <th style="width:140px">Occupation</th>
                </tr>
              </thead>
              <tbody>${parentsHtml}</tbody>
            </table>
          </section>

          <section class="section">
            ${sectionHead('03', 'Declaration &amp; Attestation')}
            <div class="declaration">
              <div class="d-text">
                <strong>Declaration.</strong>
                I hereby declare that the information furnished above is true and correct to the best of my knowledge.
                I agree to abide by the rules and regulations of <strong>${escapeHtml(SCHOOL_CONFIG.name)}</strong>.
              </div>
            </div>
          </section>

          <div class="signatures">
            <div class="sign">
              <div class="sign-space"></div>
              <div class="sign-line">Parent / Guardian</div>
              <div class="sign-hint">Signature &amp; Date</div>
            </div>
            <div class="sign">
              <div class="sign-space"></div>
              <div class="sign-line">Office Use</div>
              <div class="sign-hint">Verified By</div>
            </div>
            <div class="sign">
              <div class="sign-space"></div>
              <div class="sign-line">Principal</div>
              <div class="sign-hint">Signature &amp; Seal</div>
            </div>
          </div>

          <footer class="footer">
            <div class="left">Computer-generated admission record · ${escapeHtml(data.fullName)} · Adm. ${escapeHtml(data.admissionNo)}</div>
            <div class="right">${escapeHtml(generatedAt)}</div>
          </footer>
        </div>
      </div>
    </body>
  </html>`;
}

/** Open the platform print dialog (user can Print or choose Save as PDF as the destination). */
export async function printAdmissionForm(data: AdmissionFormData): Promise<void> {
  const html = await buildAdmissionFormHtml(data);
  if (Platform.OS === 'web') {
    await printHtmlOnWeb(html);
    return;
  }
  await Print.printAsync({ html });
}

/** Generate a PDF file and hand it to the share/save sheet (native); on web, open the print→Save as PDF dialog. */
export async function saveAdmissionFormPdf(data: AdmissionFormData): Promise<void> {
  const html = await buildAdmissionFormHtml(data);
  if (Platform.OS === 'web') {
    await printHtmlOnWeb(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}
