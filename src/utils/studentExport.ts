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

function fullName(s: Student): string {
  return (
    s.display_name ||
    [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ') ||
    '—'
  );
}

/** Pick the primary parent, falling back to the first listed. */
function primaryParent(parents?: Parent[]): Parent | undefined {
  if (!parents || parents.length === 0) return undefined;
  return parents.find((p) => p.is_primary) ?? parents[0];
}

const CSV_HEADERS = [
  'Admission No',
  'Name',
  'Class',
  'Section',
  'Roll Number',
  'Status',
  'Date of Birth',
  'Phone',
  'Email',
  'Parent Name',
  'Relation',
  'Parent Phone',
  'PEN Number',
  'Admission Date',
  'Category',
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
    const parent = primaryParent(s.parents);
    const parentName = parent
      ? [parent.first_name, parent.last_name].filter(Boolean).join(' ')
      : '';
    lines.push(
      [
        s.admission_no ?? '',
        fullName(s),
        e?.class_name || e?.class_code || '',
        e?.section_name || '',
        e?.roll_number || '',
        s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : '',
        s.dob || '',
        s.phone || '',
        s.email || '',
        parentName,
        parent?.relation || '',
        parent?.phone || '',
        s.pen_number || '',
        s.admission_date || '',
        s.category?.name || '',
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
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
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
  await FileSystem.writeAsStringAsync(path, `﻿${csv}`, {
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
