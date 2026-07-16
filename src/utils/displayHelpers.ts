export const safeName = (first?: string | null, last?: string | null, fallback = 'Unknown User') => {
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name || fallback;
};

export const safeField = (value: unknown, fallback = 'N/A'): string => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    const nested = o.name ?? o.label;
    if (nested !== undefined && nested !== null && nested !== '') {
      return typeof nested === 'object' ? safeField(nested, fallback) : String(nested);
    }
    return fallback;
  }
  return String(value);
};

/** Full name for API rows (SchoolIMS uses snake_case + display_name). */
export function personListDisplayName(row: Record<string, unknown>): string {
  const display = row.display_name ?? row.name;
  if (typeof display === 'string' && display.trim()) return display.trim();
  const first = row.first_name ?? row.firstName;
  const last = row.last_name ?? row.lastName;
  return safeName(
    typeof first === 'string' ? first : undefined,
    typeof last === 'string' ? last : undefined
  );
}

export function studentEnrollmentSubtitle(enrollment: unknown): string {
  if (!enrollment || typeof enrollment !== 'object') {
    return `Class: N/A - N/A • Roll: N/A`;
  }
  const e = enrollment as Record<string, unknown>;
  const classLabel = safeField(
    e.class_name ?? e.class_code ?? (e.class as Record<string, unknown> | undefined)?.name ?? e.class_id
  );
  const section = safeField(e.section_name ?? e.section);
  const roll = safeField(e.roll_number ?? e.roll_no ?? e.roll);
  return `Class: ${classLabel} - ${section} • Roll: ${roll}`;
}

export function staffRoleCodeLine(row: Record<string, unknown>): string {
  const role = safeField(
    row.designation ?? row.designation_name ?? row.role ?? row.role_name ?? row.user_type,
    'Staff'
  );
  const staffCode = safeField(row.staff_code ?? row.staffCode);
  return `${role} • ${staffCode}`;
}

/** Lowercase string for client-side search across common name/admission fields. */
export function manageUsersSearchHaystack(row: Record<string, unknown>, kind: 'student' | 'staff'): string {
  const parts = [
    personListDisplayName(row),
    row.email,
    kind === 'student' ? row.admission_no ?? row.admissionNo : row.staff_code,
    row.phone,
  ];
  return parts
    .filter((p) => p != null && String(p).length > 0)
    .map((p) => String(p).toLowerCase())
    .join(' ');
}
