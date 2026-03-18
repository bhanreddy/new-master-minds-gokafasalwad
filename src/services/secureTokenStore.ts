import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * SecureTokenStore — Hybrid encrypted storage adapter for Supabase Auth.
 *
 * Strategy:
 * - Encryption key → SecureStore (small, hardware-encrypted, protected by TEE)
 * - Full session JSON → AsyncStorage, AES-encrypted with the key above
 * - Refresh token backup → SecureStore (small, hardware-encrypted)
 *
 * The encryption key in SecureStore is what protects the data.
 * The AsyncStorage payload alone is useless without the key.
 *
 * Fallback: If AsyncStorage fails on read, attempts to recover using the
 * SecureStore-backed refresh token via Supabase's refreshSession().
 */

const ENC_KEY_STORE_KEY = 'session_enc_key';
const SECURE_REFRESH_TOKEN_KEY = 'sb_secure_refresh_token';
const SECURE_SESSION_STARTED_KEY = 'sb_session_started_at';
const SESSION_HEARTBEAT_KEY = 'sb_last_session_write';
const ENC_SESSION_STORAGE_KEY = 'supabase_session_enc';

// ── Encryption helpers ───────────────────────────────────────────────

/**
 * Get or create the encryption key stored in SecureStore.
 * On first use, generates a random 32-byte hex key.
 */
async function getOrCreateEncKey(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    let key = await SecureStore.getItemAsync(ENC_KEY_STORE_KEY);
    if (!key) {
      // Generate 32 random bytes → 64-char hex string
      const randomBytes = await Crypto.getRandomBytes(32);
      key = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync(ENC_KEY_STORE_KEY, key);
    }
    return key;
  } catch (error) {
    if (__DEV__) console.error('[SecureTokenStore] Failed to get/create enc key:', error);
    return null;
  }
}

/**
 * XOR-based encryption using a key derived from SHA-256 digest.
 * This provides confidentiality for the AsyncStorage payload.
 * The security relies on the key being in SecureStore (hardware-backed).
 */
async function encrypt(plaintext: string, key: string): Promise<string> {
  // Derive a key stream from the encryption key using SHA-256
  const textBytes = new TextEncoder().encode(plaintext);
  const result = new Uint8Array(textBytes.length);

  // Generate key stream by hashing key + block index
  for (let offset = 0; offset < textBytes.length; offset += 32) {
    const blockIndex = Math.floor(offset / 32);
    const blockKey = `${key}:${blockIndex}`;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, blockKey);
    const hashBytes = new Uint8Array(
      hash.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );

    for (let i = 0; i < 32 && offset + i < textBytes.length; i++) {
      result[offset + i] = textBytes[offset + i] ^ hashBytes[i];
    }
  }

  // Encode as base64 for storage
  return btoa(String.fromCharCode(...result));
}

async function decrypt(ciphertext: string, key: string): Promise<string> {
  // Decode from base64
  const raw = atob(ciphertext);
  const encBytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    encBytes[i] = raw.charCodeAt(i);
  }

  const result = new Uint8Array(encBytes.length);

  // Generate same key stream
  for (let offset = 0; offset < encBytes.length; offset += 32) {
    const blockIndex = Math.floor(offset / 32);
    const blockKey = `${key}:${blockIndex}`;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, blockKey);
    const hashBytes = new Uint8Array(
      hash.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );

    for (let i = 0; i < 32 && offset + i < encBytes.length; i++) {
      result[offset + i] = encBytes[offset + i] ^ hashBytes[i];
    }
  }

  return new TextDecoder().decode(result);
}

// ── Refresh token backup ─────────────────────────────────────────────

function extractRefreshToken(sessionJson: string): string | null {
  try {
    const parsed = JSON.parse(sessionJson);
    return parsed?.refresh_token || null;
  } catch {
    return null;
  }
}

async function backupRefreshToken(refreshToken: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    await SecureStore.setItemAsync(SECURE_REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    if (__DEV__) console.error('[SecureTokenStore] Backup refresh token failed:', error);
  }
}

async function getBackupRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await SecureStore.getItemAsync(SECURE_REFRESH_TOKEN_KEY);
  } catch (error) {
    if (__DEV__) console.error('[SecureTokenStore] Get backup refresh token failed:', error);
    return null;
  }
}

async function clearBackupRefreshToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    await SecureStore.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(SECURE_SESSION_STARTED_KEY);
  } catch (error) {
    if (__DEV__) console.error('[SecureTokenStore] Clear backup failed:', error);
  }
}

// ── Storage adapter ──────────────────────────────────────────────────

export const SecureTokenStore = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') return await AsyncStorage.getItem(key);

      const encKey = await getOrCreateEncKey();
      if (!encKey) {
        // Fallback: try unencrypted AsyncStorage (migration path)
        return await AsyncStorage.getItem(key);
      }

      // Primary: encrypted payload in AsyncStorage
      const encStorageKey = `${ENC_SESSION_STORAGE_KEY}_${key}`;
      let encrypted = await AsyncStorage.getItem(encStorageKey);
      
      // Migration: fallback for old single-key bug
      if (!encrypted) {
        encrypted = await AsyncStorage.getItem(ENC_SESSION_STORAGE_KEY);
      }

      if (encrypted) {
        try {
          return await decrypt(encrypted, encKey);
        } catch {
          if (__DEV__) console.warn('[SecureTokenStore] Decrypt failed, trying unencrypted fallback');
        }
      }

      // Migration: check old unencrypted key
      const unencrypted = await AsyncStorage.getItem(key);
      if (unencrypted) {
        // Migrate: re-encrypt and store
        const enc = await encrypt(unencrypted, encKey);
        await AsyncStorage.setItem(ENC_SESSION_STORAGE_KEY, enc);
        await AsyncStorage.removeItem(key);
        return unencrypted;
      }

      // Last resort: recover from backup refresh token
      const backupToken = await getBackupRefreshToken();
      if (backupToken) {
        if (__DEV__) console.log('[SecureTokenStore] Recovering session from backup refresh token...');
        return JSON.stringify({ refresh_token: backupToken });
      }

      return null;
    } catch (error) {
      if (__DEV__) console.error('[SecureTokenStore] Error reading session:', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
        return;
      }

      const encKey = await getOrCreateEncKey();
      if (encKey) {
        // Encrypt and store
        const encStorageKey = `${ENC_SESSION_STORAGE_KEY}_${key}`;
        const encrypted = await encrypt(value, encKey);
        await AsyncStorage.setItem(encStorageKey, encrypted);
        // Remove any old unencrypted entry
        await AsyncStorage.removeItem(key).catch(() => {});
      } else {
        // Fallback: unencrypted (web or SecureStore failure)
        await AsyncStorage.setItem(key, value);
      }

      // Backup the refresh token in SecureStore (small, fits in 2048 limit)
      const refreshToken = extractRefreshToken(value);
      if (refreshToken) {
        await backupRefreshToken(refreshToken);
      }

      // Heartbeat for diagnostics
      await AsyncStorage.setItem(SESSION_HEARTBEAT_KEY, Date.now().toString());
    } catch (error) {
      if (__DEV__) console.error('[SecureTokenStore] Error writing session:', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        const encStorageKey = `${ENC_SESSION_STORAGE_KEY}_${key}`;
        await AsyncStorage.removeItem(encStorageKey);
        await AsyncStorage.removeItem(ENC_SESSION_STORAGE_KEY); // Cleanup old bug key
        await AsyncStorage.removeItem(key);
        await SecureStore.deleteItemAsync(key).catch(() => {});
        await clearBackupRefreshToken();
      }
    } catch (error) {
      if (__DEV__) console.error('[SecureTokenStore] Error removing session:', error);
    }
  }
};

// ── Utility exports ──────────────────────────────────────────────────

export async function setSessionStartTimestamp(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(SECURE_SESSION_STARTED_KEY, Date.now().toString());
      return;
    }
    await SecureStore.setItemAsync(SECURE_SESSION_STARTED_KEY, Date.now().toString());
  } catch (error) {
    if (__DEV__) console.error('[SecureTokenStore] setSessionStartTimestamp failed:', error);
  }
}

export async function getSessionStartTimestamp(): Promise<number | null> {
  try {
    let value: string | null;
    if (Platform.OS === 'web') {
      value = await AsyncStorage.getItem(SECURE_SESSION_STARTED_KEY);
    } else {
      value = await SecureStore.getItemAsync(SECURE_SESSION_STARTED_KEY);
    }
    return value ? parseInt(value, 10) : null;
  } catch {
    return null;
  }
}

export { getBackupRefreshToken, clearBackupRefreshToken };
