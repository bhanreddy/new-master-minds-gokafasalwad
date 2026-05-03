/**
 * roleHelpers.ts — Single source of truth for role identification checks.
 *
 * The "student" role in the database represents the parent/family login
 * that shows the child's data. There is no separate parent account.
 *
 * Gate ALL student/parent-specific persistence code behind isStudentRole()
 * so there are no scattered inline `role === 'student'` comparisons.
 */

/**
 * Check if a role code represents a student/parent account.
 * Student accounts are the parent-facing login used by families.
 */
export function isStudentRole(roleCode: string | null | undefined): boolean {
  return roleCode === 'student' || roleCode === 'students';
}
