/* eslint-disable import/first -- jest.mock() calls are written above the imports they replace. */
import { Platform } from 'react-native';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import {
  buildOptInKey,
  clearFingerprintTickets,
  consumeFingerprintTicket,
  disableFingerprintForAccount,
  enableFingerprintForAccount,
  getFingerprintCapability,
  getFingerprintOptInState,
  isFingerprintEnabledForAccount,
  isFingerprintPlatformSupported,
  issueFingerprintTicket,
  promptFingerprint,
  verifyFingerprintForAccount,
} from './biometricService';

/* Handles on the mocks above, for assertions. */
/* eslint-disable @typescript-eslint/no-require-imports */
const LA = require('expo-local-authentication');
const SecureStore = require('expo-secure-store');
/* eslint-enable @typescript-eslint/no-require-imports */

const SCHOOL = 12;
const STAFF = { schoolId: SCHOOL, userId: 'user-staff-1', roleCode: 'staff' };
const COPY = { promptMessage: 'Unlock with fingerprint', cancelLabel: 'Use email and password' };

const FORBIDDEN_ROLES = [
  'student',
  'parent',
  'accountant',
  'accounts',
  'driver',
  'unknown-role',
  '',
  null,
  undefined,
];

function setPlatform(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

/** Sensor present, a strong (Class 3) fingerprint enrolled. */
function deviceWithStrongFingerprint() {
  LA.hasHardwareAsync.mockResolvedValue(true);
  LA.isEnrolledAsync.mockResolvedValue(true);
  LA.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
  LA.getEnrolledLevelAsync.mockResolvedValue(3);
}

beforeEach(() => {
  jest.clearAllMocks();
  SecureStore.__store.clear();
  clearFingerprintTickets();
  setPlatform('android');
  deviceWithStrongFingerprint();
  LA.authenticateAsync.mockResolvedValue({ success: true });
});

afterAll(() => setPlatform('ios'));

// ── Platform ─────────────────────────────────────────────────────────────

describe('platform support', () => {
  it('is available on native Android and iOS', () => {
    setPlatform('android');
    expect(isFingerprintPlatformSupported()).toBe(true);
    setPlatform('ios');
    expect(isFingerprintPlatformSupported()).toBe(true);
  });

  it('is unavailable on web and the Tauri desktop wrapper', async () => {
    setPlatform('web');
    expect(isFingerprintPlatformSupported()).toBe(false);

    const capability = await getFingerprintCapability();
    expect(capability).toEqual({
      available: false,
      reason: 'unsupported_platform',
      signature: null,
    });
    // The web bundle must never call into the native module.
    expect(LA.hasHardwareAsync).not.toHaveBeenCalled();
  });

  it('reports no opt-in and refuses to enable on web', async () => {
    setPlatform('web');
    await expect(isFingerprintEnabledForAccount(STAFF)).resolves.toBe(false);
    await expect(enableFingerprintForAccount(STAFF)).resolves.toEqual({
      success: false,
      reason: 'unsupported_platform',
    });
  });
});

// ── Device capability ────────────────────────────────────────────────────

describe('getFingerprintCapability', () => {
  it('rejects a device with no biometric hardware', async () => {
    LA.hasHardwareAsync.mockResolvedValue(false);
    await expect(getFingerprintCapability()).resolves.toMatchObject({
      available: false,
      reason: 'no_hardware',
    });
  });

  it('rejects a device with hardware but nothing enrolled', async () => {
    LA.isEnrolledAsync.mockResolvedValue(false);
    await expect(getFingerprintCapability()).resolves.toMatchObject({
      available: false,
      reason: 'not_enrolled',
    });
  });

  it('rejects a face-only device', async () => {
    LA.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
    await expect(getFingerprintCapability()).resolves.toMatchObject({
      available: false,
      reason: 'no_fingerprint',
    });
  });

  it('rejects hybrid fingerprint/face hardware because the OS prompt cannot select a modality', async () => {
    LA.supportedAuthenticationTypesAsync.mockResolvedValue([1, 2]);
    await expect(getFingerprintCapability()).resolves.toMatchObject({
      available: false,
      reason: 'mixed_biometrics',
    });
  });

  it('rejects a weak (Class 2) enrolled biometric', async () => {
    LA.getEnrolledLevelAsync.mockResolvedValue(2);
    await expect(getFingerprintCapability()).resolves.toMatchObject({
      available: false,
      reason: 'weak_biometric',
    });
  });

  it('rejects a PIN/pattern-only enrolment', async () => {
    LA.getEnrolledLevelAsync.mockResolvedValue(1);
    await expect(getFingerprintCapability()).resolves.toMatchObject({
      available: false,
      reason: 'weak_biometric',
    });
  });

  it('accepts a strong enrolled fingerprint and returns a signature', async () => {
    const capability = await getFingerprintCapability();
    expect(capability.available).toBe(true);
    expect(capability.reason).toBeNull();
    expect(typeof capability.signature).toBe('string');
  });

  it('fails closed when the capability probe throws', async () => {
    LA.hasHardwareAsync.mockRejectedValue(new Error('sensor busy'));
    await expect(getFingerprintCapability()).resolves.toMatchObject({
      available: false,
      reason: 'probe_failed',
    });
  });
});

// ── Enable / disable ─────────────────────────────────────────────────────

describe('enableFingerprintForAccount', () => {
  it('stores an opt-in record for an eligible account on a strong device', async () => {
    await expect(enableFingerprintForAccount(STAFF)).resolves.toEqual({ success: true });
    await expect(isFingerprintEnabledForAccount(STAFF)).resolves.toBe(true);

    const raw = SecureStore.__store.get(buildOptInKey(SCHOOL, STAFF.userId));
    expect(raw).toBeDefined();
    const record = JSON.parse(raw as string);
    expect(record).toMatchObject({ v: 1, schoolId: SCHOOL, userId: STAFF.userId });
  });

  it('stores no password, token, or other session material', async () => {
    await enableFingerprintForAccount(STAFF);
    const record = JSON.parse(SecureStore.__store.get(buildOptInKey(SCHOOL, STAFF.userId))!);
    expect(Object.keys(record).sort()).toEqual(
      ['enabledAt', 'roleCode', 'schoolId', 'signature', 'userId', 'v'].sort()
    );
  });

  it.each(FORBIDDEN_ROLES)('refuses role %p without writing anything', async (roleCode) => {
    const result = await enableFingerprintForAccount({
      schoolId: SCHOOL,
      userId: 'user-x',
      roleCode: roleCode as any,
    });
    expect(result).toEqual({ success: false, reason: 'ineligible_role' });
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('refuses to enable when the device has no strong fingerprint', async () => {
    LA.getEnrolledLevelAsync.mockResolvedValue(2);
    await expect(enableFingerprintForAccount(STAFF)).resolves.toEqual({
      success: false,
      reason: 'weak_biometric',
    });
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('reports a storage error when SecureStore cannot write', async () => {
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));
    await expect(enableFingerprintForAccount(STAFF)).resolves.toEqual({
      success: false,
      reason: 'storage_error',
    });
  });
});

describe('disableFingerprintForAccount', () => {
  it('removes only the target account and leaves siblings untouched', async () => {
    const sibling = { schoolId: SCHOOL, userId: 'user-admin-2', roleCode: 'admin' };
    await enableFingerprintForAccount(STAFF);
    await enableFingerprintForAccount(sibling);

    await disableFingerprintForAccount(SCHOOL, STAFF.userId);

    await expect(isFingerprintEnabledForAccount(STAFF)).resolves.toBe(false);
    await expect(isFingerprintEnabledForAccount(sibling)).resolves.toBe(true);
  });

  it('is a safe no-op for an account that never opted in', async () => {
    await expect(disableFingerprintForAccount(SCHOOL, 'never-enabled')).resolves.toBe(true);
  });

  it('reports SecureStore delete failures so the UI cannot claim success', async () => {
    SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));
    await expect(disableFingerprintForAccount(SCHOOL, STAFF.userId)).resolves.toBe(false);
  });
});

// ── Key isolation ────────────────────────────────────────────────────────

describe('per-account key namespacing', () => {
  it('gives every school/user pair its own key', () => {
    const keys = new Set([
      buildOptInKey(12, 'user-a'),
      buildOptInKey(12, 'user-b'),
      buildOptInKey(99, 'user-a'),
    ]);
    expect(keys.size).toBe(3);
  });

  it('includes both the school id and the user id in the key', () => {
    expect(buildOptInKey(12, 'user-a')).toContain('12');
    expect(buildOptInKey(12, 'user-a')).toContain('user-a');
  });

  it('uses no global biometric key', () => {
    const key = buildOptInKey(12, 'user-a');
    expect(key).not.toBe('biometric_enabled');
    expect(key).not.toBe('biometric_user_id');
    expect(key).not.toContain('refresh');
  });

  it('keeps the same user id separate across schools', async () => {
    const schoolA = { schoolId: 12, userId: 'shared-user', roleCode: 'admin' };
    const schoolB = { schoolId: 99, userId: 'shared-user', roleCode: 'admin' };
    await enableFingerprintForAccount(schoolA);

    await expect(isFingerprintEnabledForAccount(schoolA)).resolves.toBe(true);
    await expect(isFingerprintEnabledForAccount(schoolB)).resolves.toBe(false);
  });

  it('rejects a record whose contents do not match the account being read', async () => {
    await enableFingerprintForAccount(STAFF);
    // Simulate a copied/tampered blob sitting under another account's key.
    SecureStore.__store.set(
      buildOptInKey(SCHOOL, 'user-other'),
      SecureStore.__store.get(buildOptInKey(SCHOOL, STAFF.userId))!
    );
    await expect(
      isFingerprintEnabledForAccount({ schoolId: SCHOOL, userId: 'user-other', roleCode: 'admin' })
    ).resolves.toBe(false);
  });
});

// ── The prompt ───────────────────────────────────────────────────────────

describe('promptFingerprint', () => {
  it('requests strong biometrics with no device-credential fallback', async () => {
    await promptFingerprint({ ...COPY, promptSubtitle: 'Confirm it is you' });

    expect(LA.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Unlock with fingerprint',
      promptSubtitle: 'Confirm it is you',
      cancelLabel: 'Use email and password',
      disableDeviceFallback: true,
      fallbackLabel: '',
      biometricsSecurityLevel: 'strong',
      requireConfirmation: true,
    });
  });

  it('never offers weak biometrics or the device passcode', async () => {
    await promptFingerprint(COPY);
    const options = LA.authenticateAsync.mock.calls[0][0];
    expect(options.biometricsSecurityLevel).not.toBe('weak');
    expect(options.disableDeviceFallback).toBe(true);
    expect(options.fallbackLabel).toBe('');
  });

  it('reports cancellation without throwing', async () => {
    LA.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    await expect(promptFingerprint(COPY)).resolves.toEqual({
      success: false,
      reason: 'cancelled',
    });
  });

  it('reports lockout after too many attempts', async () => {
    LA.authenticateAsync.mockResolvedValue({ success: false, error: 'lockout' });
    await expect(promptFingerprint(COPY)).resolves.toEqual({ success: false, reason: 'lockout' });
  });

  it('reports a generic failure for an unrecognised finger', async () => {
    LA.authenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });
    await expect(promptFingerprint(COPY)).resolves.toEqual({ success: false, reason: 'failed' });
  });

  it('survives the native module throwing', async () => {
    LA.authenticateAsync.mockRejectedValue(new Error('activity destroyed'));
    await expect(promptFingerprint(COPY)).resolves.toEqual({ success: false, reason: 'failed' });
  });

  it('deduplicates concurrent prompts into one native dialog', async () => {
    let release: (value: any) => void = () => {};
    LA.authenticateAsync.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const first = promptFingerprint(COPY);
    const second = promptFingerprint(COPY);
    const third = promptFingerprint(COPY);
    release({ success: true });

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      { success: true },
      { success: true },
      { success: true },
    ]);
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh prompt once the previous one settles', async () => {
    await promptFingerprint(COPY);
    await promptFingerprint(COPY);
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(2);
  });

  it('never shares one account intent with a concurrent sibling intent', async () => {
    let release: (value: any) => void = () => {};
    LA.authenticateAsync.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const first = promptFingerprint(COPY, 'enable:12:user-a');
    await expect(promptFingerprint(COPY, 'enable:12:user-b')).resolves.toEqual({
      success: false,
      reason: 'busy',
    });
    release({ success: true });
    await expect(first).resolves.toEqual({ success: true });
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(1);
  });
});

// ── The gate ─────────────────────────────────────────────────────────────

describe('verifyFingerprintForAccount', () => {
  it('prompts and succeeds for an opted-in eligible account', async () => {
    await enableFingerprintForAccount(STAFF);
    await expect(verifyFingerprintForAccount(STAFF, COPY)).resolves.toEqual({ success: true });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      expect.stringContaining('fp_proof_v1'),
      expect.objectContaining({ requireAuthentication: true })
    );
  });

  it.each(['admin', 'principal', 'teacher', 'staff'])(
    'works for the eligible role %s',
    async (roleCode) => {
      const account = { schoolId: SCHOOL, userId: `user-${roleCode}`, roleCode };
      await enableFingerprintForAccount(account);
      await expect(verifyFingerprintForAccount(account, COPY)).resolves.toEqual({ success: true });
    }
  );

  it.each(FORBIDDEN_ROLES)('never prompts for forbidden role %p', async (roleCode) => {
    const result = await verifyFingerprintForAccount(
      { schoolId: SCHOOL, userId: 'user-forbidden', roleCode: roleCode as any },
      COPY
    );
    expect(result).toEqual({ success: false, reason: 'ineligible_role' });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('does not prompt for an eligible account that never opted in', async () => {
    await expect(verifyFingerprintForAccount(STAFF, COPY)).resolves.toEqual({
      success: false,
      reason: 'not_enabled',
    });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('deletes the opt-in record when the role is downgraded', async () => {
    await enableFingerprintForAccount(STAFF);
    expect(SecureStore.__store.has(buildOptInKey(SCHOOL, STAFF.userId))).toBe(true);

    const downgraded = { ...STAFF, roleCode: 'accountant' };
    await expect(verifyFingerprintForAccount(downgraded, COPY)).resolves.toEqual({
      success: false,
      reason: 'ineligible_role',
    });

    expect(SecureStore.__store.has(buildOptInKey(SCHOOL, STAFF.userId))).toBe(false);
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('fails closed and clears the record when the enrolled biometrics change', async () => {
    await enableFingerprintForAccount(STAFF);
    // The OS invalidates the biometryCurrentSet/Keystore proof.
    const proofKey = [...SecureStore.__store.keys()].find((key) =>
      key.startsWith('fp_proof_v1')
    );
    SecureStore.__store.delete(proofKey);

    await expect(verifyFingerprintForAccount(STAFF, COPY)).resolves.toEqual({
      success: false,
      reason: 'enrollment_changed',
    });
    expect(SecureStore.__store.has(buildOptInKey(SCHOOL, STAFF.userId))).toBe(false);
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('fails closed when the device drops to a weak biometric', async () => {
    await enableFingerprintForAccount(STAFF);
    LA.getEnrolledLevelAsync.mockResolvedValue(2);

    await expect(verifyFingerprintForAccount(STAFF, COPY)).resolves.toEqual({
      success: false,
      reason: 'weak_biometric',
    });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('fails closed when SecureStore is unavailable', async () => {
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));
    await expect(verifyFingerprintForAccount(STAFF, COPY)).resolves.toEqual({
      success: false,
      reason: 'storage_error',
    });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('keeps the opt-in record after a cancelled scan so the user can retry', async () => {
    await enableFingerprintForAccount(STAFF);
    SecureStore.getItemAsync.mockImplementation(
      async (key: string, options?: { requireAuthentication?: boolean }) => {
        if (options?.requireAuthentication) throw new Error('User canceled authentication');
        return SecureStore.__store.get(key) ?? null;
      }
    );

    await expect(verifyFingerprintForAccount(STAFF, COPY)).resolves.toEqual({
      success: false,
      reason: 'cancelled',
    });
    await expect(isFingerprintEnabledForAccount(STAFF)).resolves.toBe(true);
  });

  it('keeps the opt-in record after a lockout', async () => {
    await enableFingerprintForAccount(STAFF);
    SecureStore.getItemAsync.mockImplementation(
      async (key: string, options?: { requireAuthentication?: boolean }) => {
        if (options?.requireAuthentication) throw new Error('Biometric locked out');
        return SecureStore.__store.get(key) ?? null;
      }
    );

    await expect(verifyFingerprintForAccount(STAFF, COPY)).resolves.toEqual({
      success: false,
      reason: 'lockout',
    });
    await expect(isFingerprintEnabledForAccount(STAFF)).resolves.toBe(true);
  });
});

describe('isFingerprintEnabledForAccount', () => {
  it('cleans up a stale record when the account is no longer eligible', async () => {
    await enableFingerprintForAccount(STAFF);
    await expect(
      isFingerprintEnabledForAccount({ ...STAFF, roleCode: 'driver' })
    ).resolves.toBe(false);
    expect(SecureStore.__store.has(buildOptInKey(SCHOOL, STAFF.userId))).toBe(false);
  });

  it('treats a corrupt record as not opted in', async () => {
    SecureStore.__store.set(buildOptInKey(SCHOOL, STAFF.userId), 'not-json');
    await expect(isFingerprintEnabledForAccount(STAFF)).resolves.toBe(false);
    await expect(getFingerprintOptInState(STAFF)).resolves.toBe('unknown');
  });

  it('treats parseable schema-invalid metadata as unknown, never off', async () => {
    SecureStore.__store.set(
      buildOptInKey(SCHOOL, STAFF.userId),
      JSON.stringify({ v: 1, schoolId: SCHOOL, userId: STAFF.userId })
    );
    await expect(getFingerprintOptInState(STAFF)).resolves.toBe('unknown');
  });
});

// ── Unlock tickets ───────────────────────────────────────────────────────

describe('unlock tickets', () => {
  it('is single use and scoped to one account', () => {
    issueFingerprintTicket('user-a');
    expect(consumeFingerprintTicket('user-b')).toBe(false);
    expect(consumeFingerprintTicket('user-a')).toBe(true);
    expect(consumeFingerprintTicket('user-a')).toBe(false);
  });

  it('expires so it cannot authorize a much later switch', () => {
    jest.useFakeTimers();
    try {
      issueFingerprintTicket('user-a');
      jest.advanceTimersByTime(60_000);
      expect(consumeFingerprintTicket('user-a')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('is dropped wholesale on sign-out', () => {
    issueFingerprintTicket('user-a');
    clearFingerprintTickets();
    expect(consumeFingerprintTicket('user-a')).toBe(false);
  });
});
