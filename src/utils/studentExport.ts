import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { Student, Parent } from '../types/models';

export interface StudentExportMeta {
  schoolName: string;
  /** Human-readable note describing the active filters, e.g. "Class: 10 · Section: A". */
  filterNote?: string;
  /** ISO date (yyyy-mm-dd) used in the file name. */
  dateIso: string;
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function fileSafe(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'students'
  );
}

/** Match Add Student UI labels (Boy / Girl) rather than DB Male / Female. */
function genderLabel(s: Student): string {
  if (s.gender_id === 1) return 'Boy';
  if (s.gender_id === 2) return 'Girl';
  return s.gender_name || '';
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

function refName(
  obj: { name?: string } | string | null | undefined,
  fallbackName?: string | null,
): string {
  if (typeof obj === 'string') return obj;
  return obj?.name || fallbackName || '';
}

function parentByRelation(parents: Parent[] | undefined, relation: string): Parent | undefined {
  if (!parents?.length) return undefined;
  const target = relation.toLowerCase();
  return parents.find((p) => (p.relation || '').toLowerCase() === target);
}

function parentName(parent?: Parent): string {
  if (!parent) return '';
  return [parent.first_name, parent.last_name].filter(Boolean).join(' ');
}

function statusLabel(status?: string): string {
  if (!status) return '';
  if (status === 'graduated') return 'Passed Out';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Columns mirror every field collected on Add Student (except photo & password).
 * Order follows the admission wizard: Personal → Academic → Parents → Details → Contact.
 */
const CSV_HEADERS = [
  // Personal
  'First Name',
  'Middle Name',
  'Last Name',
  'Gender',
  'Date of Birth',
  'Aadhaar Number',
  'Previous School',
  'TC Number',
  'Village',
  // Academic
  'Admission No',
  'APAR Number',
  'PEN Number',
  'Roll Number',
  'Admission Date',
  'Class',
  'Section',
  'Academic Year',
  'Status',
  'Exit Academic Year',
  // Father
  'Father Name',
  'Father Phone',
  'Father Occupation',
  // Mother
  'Mother Name',
  'Mother Phone',
  'Mother Occupation',
  // Guardian (when present)
  'Guardian Name',
  'Guardian Phone',
  'Guardian Occupation',
  // Additional details
  'Category',
  'Religion',
  'Blood Group',
  // Contact & login identity (password never exported)
  'Phone',
  'Email',
];

export function buildStudentCsv(students: Student[], meta: StudentExportMeta): string {
  const lines: string[] = [
    escapeCsv(meta.schoolName),
    'Student Directory',
    ...(meta.filterNote ? [`Filters,${escapeCsv(meta.filterNote)}`] : []),
    `Exported,${escapeCsv(new Date().toLocaleString('en-IN'))}`,
    `Total students,${students.length}`,
    '',
    CSV_HEADERS.map(escapeCsv).join(','),
  ];

  for (const s of students) {
    const e = s.current_enrollment;
    const father = parentByRelation(s.parents, 'Father');
    const mother = parentByRelation(s.parents, 'Mother');
    const guardian = parentByRelation(s.parents, 'Guardian');

    lines.push(
      [
        s.first_name || '',
        s.middle_name || '',
        s.last_name || '',
        genderLabel(s),
        s.dob || '',
        s.aadhaar_number || '',
        yesNo(s.previous_school),
        s.tc_number || '',
        s.village || '',
        s.admission_no ?? '',
        s.apar_number || '',
        s.pen_number || '',
        e?.roll_number || '',
        s.admission_date || '',
        e?.class_name || e?.class_code || '',
        e?.section_name || '',
        e?.academic_year || '',
        statusLabel(s.status),
        s.exit_academic_year || '',
        parentName(father),
        father?.phone || '',
        father?.occupation || '',
        parentName(mother),
        mother?.phone || '',
        mother?.occupation || '',
        parentName(guardian),
        guardian?.phone || '',
        guardian?.occupation || '',
        refName(s.category, s.category_name),
        refName(s.religion, s.religion_name),
        refName(s.blood_group, s.blood_group_name),
        s.phone || '',
        s.email || '',
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  return lines.join('\n');
}

export function getStudentCsvFileName(meta: StudentExportMeta): string {
  const suffix = meta.filterNote ? `_${fileSafe(meta.filterNote)}` : '';
  return `students${suffix}_${meta.dateIso}.csv`;
}

async function shareCsvWeb(csv: string, fileName: string): Promise<void> {
  // Prepend a UTF-8 BOM so Excel renders non-ASCII names correctly.
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function shareCsvNative(csv: string, fileName: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, `\ufeff${csv}`, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      dialogTitle: 'Export student list',
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });
    return;
  }
  throw new Error('Sharing is not available on this device.');
}

/** Build the CSV and hand it to the platform's download/share flow. Returns the file name. */
export async function exportStudentCsv(
  students: Student[],
  meta: StudentExportMeta,
): Promise<string> {
  const csv = buildStudentCsv(students, meta);
  const fileName = getStudentCsvFileName(meta);
  if (Platform.OS === 'web') {
    await shareCsvWeb(csv, fileName);
  } else {
    await shareCsvNative(csv, fileName);
  }
  return fileName;
}
