/* eslint-disable import/first, @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';

jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  let sequence = 0;
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`),
    digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
      nodeCrypto.createHash('sha256').update(value).digest('hex')
    ),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    __store: store,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      multiRemove: jest.fn(async (keys: string[]) => {
        keys.forEach((key) => store.delete(key));
      }),
    },
  };
});

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import { SecureTokenStore } from './secureTokenStore';

const AsyncStorage = require('@react-native-async-storage/async-storage');
const SecureStore = require('expo-secure-store');

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.__store.clear();
  SecureStore.__store.clear();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
});

describe('SecureTokenStore native storage', () => {
  it('round-trips large values entirely through OS secure storage', async () => {
    const value = JSON.stringify({ token: 'sensitive', padding: 'x'.repeat(8_000) });

    await SecureTokenStore.setItem('auth_session', value);

    await expect(SecureTokenStore.getItem('auth_session')).resolves.toBe(value);
    expect(AsyncStorage.__store.get('auth_session')).toBeUndefined();
    expect([...SecureStore.__store.keys()]).toEqual(
      expect.arrayContaining([expect.stringContaining('secure_store_v2_auth_session_manifest')])
    );
    expect([...AsyncStorage.__store.values()]).not.toContain(value);
  });

  it('fails closed instead of writing plaintext when SecureStore fails', async () => {
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));

    await expect(
      SecureTokenStore.setItem('auth_session', '{"refresh_token":"secret"}')
    ).rejects.toThrow('keystore unavailable');
    expect(AsyncStorage.__store.get('auth_session')).toBeUndefined();
  });

  it('migrates a legacy plaintext fallback before returning it', async () => {
    AsyncStorage.__store.set('auth_session', '{"legacy":true}');

    await expect(SecureTokenStore.getItem('auth_session')).resolves.toBe('{"legacy":true}');
    expect(AsyncStorage.__store.has('auth_session')).toBe(false);
    expect([...SecureStore.__store.keys()]).toEqual(
      expect.arrayContaining([expect.stringContaining('secure_store_v2_auth_session_manifest')])
    );
  });

  it('rejects an incomplete chunk set rather than returning partial session data', async () => {
    await SecureTokenStore.setItem('auth_session', 'x'.repeat(4_000));
    const chunk = [...SecureStore.__store.keys()].find((key) =>
      key.includes('secure_store_v2_auth_session_')
      && !key.endsWith('_manifest')
    );
    expect(chunk).toBeDefined();
    SecureStore.__store.delete(chunk!);

    await expect(SecureTokenStore.getItem('auth_session')).resolves.toBeNull();
  });

  it('serializes concurrent writes so the last requested value wins atomically', async () => {
    const first = SecureTokenStore.setItem('auth_session', 'first');
    const second = SecureTokenStore.setItem('auth_session', 'second');

    await Promise.all([first, second]);
    await expect(SecureTokenStore.getItem('auth_session')).resolves.toBe('second');
  });

  it('backs up the nested AuthSession refresh token independently', async () => {
    await SecureTokenStore.setItem(
      'auth_session',
      JSON.stringify({
        supabaseSession: { refresh_token: 'nested-refresh-token' },
        validatedUser: { userId: 'user-1' },
      })
    );

    expect(SecureStore.__store.get('sb_secure_refresh_token')).toBe(
      'nested-refresh-token'
    );
  });
});
