/* eslint-disable import/first -- jest.mock() calls are written above the imports they replace. */
import { Platform } from 'react-native';

jest.mock('../i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('../constants/school', () => ({ SCHOOL_ID: 12 }));
jest.mock('./accountVault', () => ({ listAccounts: jest.fn() }));

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
  enableFingerprintForAccount,
  issueFingerprintTicket,
} from './biometricService';
import { requireFingerprintForVaultAccount } from './fingerprintGate';

/* Handles on the mocks above, for assertions. */
/* eslint-disable @typescript-eslint/no-require-imports */
const LA = require('expo-local-authentication');
const SecureStore = require('expo-secure-store');
const accountVault = require('./accountVault');
/* eslint-enable @typescript-eslint/no-require-imports */

const SCHOOL = 12;

function setPlatform(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

/** Minimal vault-shaped account: only the role is read by the gate. */
function vaultAccount(userId: string, roleCode: string) {
  return { userId, validatedUser: { userId, role: { code: roleCode } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  SecureStore.__store.clear();
  clearFingerprintTickets();
  setPlatform('android');
  LA.hasHardwareAsync.mockResolvedValue(true);
  LA.isEnrolledAsync.mockResolvedValue(true);
  LA.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
  LA.getEnrolledLevelAsync.mockResolvedValue(3);
  LA.authenticateAsync.mockResolvedValue({ success: true });
  accountVault.listAccounts.mockResolvedValue([]);
});

afterAll(() => setPlatform('ios'));

describe('requireFingerprintForVaultAccount', () => {
  it('challenges an opted-in admin account before the switch', async () => {
    accountVault.listAccounts.mockResolvedValue([vaultAccount('admin-1', 'admin')]);
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'admin-1', roleCode: 'admin' });

    await expect(requireFingerprintForVaultAccount('admin-1')).resolves.toEqual({ allowed: true });
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      expect.stringContaining('fp_proof_v1'),
      expect.objectContaining({ requireAuthentication: true })
    );
  });

  it('challenges an opted-in staff account before the switch', async () => {
    accountVault.listAccounts.mockResolvedValue([vaultAccount('staff-1', 'staff')]);
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'staff-1', roleCode: 'staff' });

    await expect(requireFingerprintForVaultAccount('staff-1')).resolves.toEqual({ allowed: true });
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      expect.stringContaining('fp_proof_v1'),
      expect.objectContaining({ requireAuthentication: true })
    );
  });

  it('refuses the switch when the scan is cancelled, e.g. a notification-triggered switch', async () => {
    accountVault.listAccounts.mockResolvedValue([vaultAccount('admin-1', 'admin')]);
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'admin-1', roleCode: 'admin' });
    SecureStore.getItemAsync.mockImplementation(
      async (key: string, options?: { requireAuthentication?: boolean }) => {
        if (options?.requireAuthentication) throw new Error('User canceled authentication');
        return SecureStore.__store.get(key) ?? null;
      }
    );

    const outcome = await requireFingerprintForVaultAccount('admin-1');
    expect(outcome.allowed).toBe(false);
    expect(outcome.reason).toBe('cancelled');
    expect(outcome.message).toBeTruthy();
    // A refused switch must not cost the user their saved login.
    expect(SecureStore.__store.has(buildOptInKey(SCHOOL, 'admin-1'))).toBe(true);
  });

  it('refuses the switch after a lockout and explains why', async () => {
    accountVault.listAccounts.mockResolvedValue([vaultAccount('admin-1', 'admin')]);
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'admin-1', roleCode: 'admin' });
    SecureStore.getItemAsync.mockImplementation(
      async (key: string, options?: { requireAuthentication?: boolean }) => {
        if (options?.requireAuthentication) throw new Error('Biometric locked out');
        return SecureStore.__store.get(key) ?? null;
      }
    );

    await expect(requireFingerprintForVaultAccount('admin-1')).resolves.toMatchObject({
      allowed: false,
      reason: 'lockout',
    });
  });

  it.each(['student', 'parent', 'accountant', 'accounts', 'driver', 'unknown'])(
    'never prompts when switching into a %s account',
    async (roleCode) => {
      accountVault.listAccounts.mockResolvedValue([vaultAccount('other-1', roleCode)]);

      await expect(requireFingerprintForVaultAccount('other-1')).resolves.toEqual({
        allowed: true,
      });
      expect(LA.authenticateAsync).not.toHaveBeenCalled();
    }
  );

  it('purges a stale record and allows the switch when the target role was downgraded', async () => {
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'user-1', roleCode: 'admin' });
    // The vault now reports the account as an accountant.
    accountVault.listAccounts.mockResolvedValue([vaultAccount('user-1', 'accountant')]);

    await expect(requireFingerprintForVaultAccount('user-1')).resolves.toEqual({ allowed: true });
    expect(SecureStore.__store.has(buildOptInKey(SCHOOL, 'user-1'))).toBe(false);
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('reads the role from the vault at switch time, not from a stale caller', async () => {
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'user-1', roleCode: 'admin' });
    accountVault.listAccounts.mockResolvedValue([vaultAccount('user-1', 'admin')]);
    await requireFingerprintForVaultAccount('user-1');
    expect(accountVault.listAccounts).toHaveBeenCalled();
  });

  it('allows an eligible account that never opted in, without prompting', async () => {
    accountVault.listAccounts.mockResolvedValue([vaultAccount('admin-2', 'admin')]);

    await expect(requireFingerprintForVaultAccount('admin-2')).resolves.toEqual({ allowed: true });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('accepts a single-use ticket instead of prompting twice for one tap', async () => {
    accountVault.listAccounts.mockResolvedValue([vaultAccount('admin-1', 'admin')]);
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'admin-1', roleCode: 'admin' });

    issueFingerprintTicket('admin-1');
    await expect(requireFingerprintForVaultAccount('admin-1')).resolves.toEqual({ allowed: true });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();

    // The ticket is spent: the next switch is challenged again.
    await requireFingerprintForVaultAccount('admin-1');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      expect.stringContaining('fp_proof_v1'),
      expect.objectContaining({ requireAuthentication: true })
    );
  });

  it('does not let one account\'s ticket unlock a sibling', async () => {
    accountVault.listAccounts.mockResolvedValue([
      vaultAccount('admin-1', 'admin'),
      vaultAccount('admin-2', 'admin'),
    ]);
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'admin-2', roleCode: 'admin' });

    issueFingerprintTicket('admin-1');
    await requireFingerprintForVaultAccount('admin-2');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      expect.stringContaining('fp_proof_v1'),
      expect.objectContaining({ requireAuthentication: true })
    );
  });

  it('does not interfere on web or Tauri desktop', async () => {
    setPlatform('web');
    await expect(requireFingerprintForVaultAccount('admin-1')).resolves.toEqual({ allowed: true });
    expect(accountVault.listAccounts).not.toHaveBeenCalled();
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('fails closed for an unknown account', async () => {
    accountVault.listAccounts.mockResolvedValue([vaultAccount('admin-1', 'admin')]);
    await expect(requireFingerprintForVaultAccount('not-in-vault')).resolves.toMatchObject({
      allowed: false,
      reason: 'storage_error',
    });
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('fails closed on a vault read error', async () => {
    accountVault.listAccounts.mockRejectedValue(new Error('vault unreadable'));
    await expect(requireFingerprintForVaultAccount('admin-1')).resolves.toMatchObject({
      allowed: false,
      reason: 'storage_error',
    });
  });

  it('refuses the switch when secure storage is unavailable', async () => {
    accountVault.listAccounts.mockResolvedValue([vaultAccount('admin-1', 'admin')]);
    await enableFingerprintForAccount({ schoolId: SCHOOL, userId: 'admin-1', roleCode: 'admin' });
    SecureStore.getItemAsync.mockRejectedValue(new Error('keystore unavailable'));

    await expect(requireFingerprintForVaultAccount('admin-1')).resolves.toMatchObject({
      allowed: false,
      reason: 'storage_error',
    });
  });
});
