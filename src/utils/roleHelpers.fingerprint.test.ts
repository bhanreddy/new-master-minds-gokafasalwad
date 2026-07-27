import {
  FINGERPRINT_ELIGIBLE_ROLE_CODES,
  STAFF_PORTAL_ROLE_CODES,
  isFingerprintEligibleRole,
  isStaffPortalRole,
} from './roleHelpers';

describe('isFingerprintEligibleRole', () => {
  const ELIGIBLE = ['staff', 'teacher', 'admin', 'principal'];
  const FORBIDDEN = ['student', 'parent', 'accountant', 'accounts', 'driver'];

  it('allows exactly the four higher-authority staff/admin roles', () => {
    expect([...FINGERPRINT_ELIGIBLE_ROLE_CODES].sort()).toEqual([...ELIGIBLE].sort());
    ELIGIBLE.forEach((role) => {
      expect(isFingerprintEligibleRole(role)).toBe(true);
    });
  });

  it('forbids every non-staff/admin role', () => {
    FORBIDDEN.forEach((role) => {
      expect(isFingerprintEligibleRole(role)).toBe(false);
    });
  });

  it('fails closed for unknown, empty, and missing roles', () => {
    [undefined, null, '', ' ', 'Admin', 'ADMIN', 'superadmin', 'guest'].forEach((role) => {
      expect(isFingerprintEligibleRole(role as any)).toBe(false);
    });
  });

  it('spans both portals, since principals use admin and teachers use staff', () => {
    // Every staff-portal role is eligible…
    STAFF_PORTAL_ROLE_CODES.forEach((role) => {
      expect(isFingerprintEligibleRole(role)).toBe(true);
    });
    // …and admin is eligible without being a /staff route role.
    expect(isStaffPortalRole('admin')).toBe(false);
    expect(isFingerprintEligibleRole('admin')).toBe(true);
  });

  it('excludes driver, which is a staff-created login but not a portal authority', () => {
    expect(isFingerprintEligibleRole('driver')).toBe(false);
  });
});
