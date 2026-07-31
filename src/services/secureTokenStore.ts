import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Native auth storage.
 *
 * New writes are split into small chunks and stored entirely in SecureStore.
 * SecureStore supplies authenticated encryption through the OS keychain /
 * Android Keystore, so this adapter does not implement cryptography itself and
 * never falls back to plaintext when native secure storage is unavailable.
 *
 * The old XOR payload reader remains only to migrate existing installations.
 * Successfully migrated legacy blobs are immediately removed.
 */

const LEGACY_ENC_KEY_STORE_KEY = 'session_enc_key';
const LEGACY_ENC_STORAGE_PREFIX = 'supabase_session_enc';
const SECURE_REFRESH_TOKEN_KEY = 'sb_secure_refresh_token';
const SECURE_SESSION_STARTED_KEY = 'sb_session_started_at';
const SESSION_HEARTBEAT_KEY = 'sb_last_session_write';

const V2_PREFIX = 'secure_store_v2';
const CHUNK_BYTES = 1_200;
const keyWriteChains = new Map<string, Promise<void>>();
const migrationsInFlight = new Map<string, Promise<string | null>>();

interface ChunkManifest {
  v: 2;
  generation: string;
  count: number;
  digest: string;
}

function enqueueKeyWrite(key: string, operation: () => Promise<void>): Promise<void> {
  const previous = keyWriteChains.get(key) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  keyWriteChains.set(key, current);
  const cleanup = () => {
    if (keyWriteChains.get(key) === current) keyWriteChains.delete(key);
  };
  void current.then(cleanup, cleanup);
  return current;
}

function migrateLegacyValueOnce(key: string): Promise<string | null> {
  const existing = migrationsInFlight.get(key);
  if (existing) return existing;
  const current = migrateLegacyValue(key).finally(() => {
    if (migrationsInFlight.get(key) === current) migrationsInFlight.delete(key);
  });
  migrationsInFlight.set(key, current);
  return current;
}

function safeKey(key: string): string {
  return String(key).replace(/[^A-Za-z0-9._-]/g, '_');
}

function manifestKey(key: string): string {
  return `${V2_PREFIX}_${safeKey(key)}_manifest`;
}

function chunkKey(key: string, generation: string, index: number): string {
  return `${V2_PREFIX}_${safeKey(key)}_${generation}_${index}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function digest(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function parseManifest(raw: string | null): ChunkManifest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChunkManifest;
    if (
      parsed?.v !== 2 ||
      !/^[A-Za-z0-9_-]+$/.test(parsed.generation) ||
      !Number.isInteger(parsed.count) ||
      parsed.count < 1 ||
      parsed.count > 10_000 ||
      !/^[a-f0-9]{64}$/i.test(parsed.digest)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readSecureChunks(key: string): Promise<string | null> {
  const rawManifest = await SecureStore.getItemAsync(manifestKey(key));
  if (!rawManifest) return null;
  const manifest = parseManifest(rawManifest);
  if (!manifest) throw new Error('Invalid secure storage manifest');

  const encodedChunks = await Promise.all(
    Array.from({ length: manifest.count }, (_, index) =>
      SecureStore.getItemAsync(chunkKey(key, manifest.generation, index))
    )
  );
  if (encodedChunks.some((chunk) => chunk === null)) {
    throw new Error('Incomplete secure storage value');
  }

  const byteChunks = encodedChunks.map((chunk) => base64ToBytes(chunk!));
  const total = byteChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of byteChunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  const value = new TextDecoder().decode(bytes);
  if ((await digest(value)) !== manifest.digest) {
    throw new Error('Secure storage integrity check failed');
  }
  return value;
}

async function deleteGeneration(key: string, manifest: ChunkManifest | null): Promise<void> {
  if (!manifest) return;
  await Promise.all(
    Array.from({ length: manifest.count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, manifest.generation, index))
    )
  );
}

async function writeSecureChunks(key: string, value: string): Promise<void> {
  const oldManifest = parseManifest(await SecureStore.getItemAsync(manifestKey(key)));
  const generation = Crypto.randomUUID().replace(/-/g, '');
  const bytes = new TextEncoder().encode(value);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    chunks.push(bytes.slice(offset, offset + CHUNK_BYTES));
  }
  if (chunks.length === 0) chunks.push(new Uint8Array());

  try {
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(
          chunkKey(key, generation, index),
          bytesToBase64(chunk),
          { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
        )
      )
    );

    const manifest: ChunkManifest = {
      v: 2,
      generation,
      count: chunks.length,
      digest: await digest(value),
    };
    // Commit last. Until this succeeds, readers continue using the prior
    // generation and can never observe a half-written value.
    await SecureStore.setItemAsync(manifestKey(key), JSON.stringify(manifest), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    await Promise.all(
      chunks.map((_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, generation, index)).catch(() => undefined)
      )
    );
    throw error;
  }

  await deleteGeneration(key, oldManifest).catch(() => undefined);
}

async function deleteSecureChunks(key: string): Promise<void> {
  const rawManifest = await SecureStore.getItemAsync(manifestKey(key));
  const manifest = parseManifest(rawManifest);
  await deleteGeneration(key, manifest);
  await SecureStore.deleteItemAsync(manifestKey(key));
}

// Legacy reader only. It is deliberately not used for new writes.
async function decryptLegacy(ciphertext: string, key: string): Promise<string> {
  const raw = atob(ciphertext);
  const encBytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) encBytes[i] = raw.charCodeAt(i);

  const result = new Uint8Array(encBytes.length);
  for (let offset = 0; offset < encBytes.length; offset += 32) {
    const blockIndex = Math.floor(offset / 32);
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${key}:${blockIndex}`
    );
    const hashBytes = new Uint8Array(
      hash.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );
    for (let i = 0; i < 32 && offset + i < encBytes.length; i += 1) {
      result[offset + i] = encBytes[offset + i] ^ hashBytes[i];
    }
  }
  return new TextDecoder().decode(result);
}

async function migrateLegacyValue(key: string): Promise<string | null> {
  const perKeyLegacy = `${LEGACY_ENC_STORAGE_PREFIX}_${key}`;
  let encrypted = await AsyncStorage.getItem(perKeyLegacy);
  let encryptedStorageKey = perKeyLegacy;

  // A historic bug used one global key for auth_session only.
  if (!encrypted && key === 'auth_session') {
    encrypted = await AsyncStorage.getItem(LEGACY_ENC_STORAGE_PREFIX);
    encryptedStorageKey = LEGACY_ENC_STORAGE_PREFIX;
  }

  let value: string | null = null;
  if (encrypted) {
    const legacyKey = await SecureStore.getItemAsync(LEGACY_ENC_KEY_STORE_KEY);
    if (!legacyKey) throw new Error('Legacy encrypted value has no secure key');
    value = await decryptLegacy(encrypted, legacyKey);
  } else {
    // Migrate the prior plaintext fallback only if it can first be committed
    // to SecureStore. It is never returned directly on a secure-store failure.
    value = await AsyncStorage.getItem(key);
  }

  if (value === null) return null;
  await enqueueKeyWrite(key, () => writeSecureChunks(key, value));
  await AsyncStorage.multiRemove([key, perKeyLegacy, encryptedStorageKey]);
  return value;
}

function extractRefreshToken(sessionJson: string): string | null {
  try {
    const parsed = JSON.parse(sessionJson);
    // Supabase's own storage payload keeps refresh_token at the top level,
    // while SchoolIMS wraps it in AuthSession.supabaseSession. Back up both
    // shapes so a valid login always has an independent Keystore recovery key.
    return parsed?.refresh_token ?? parsed?.supabaseSession?.refresh_token ?? null;
  } catch {
    return null;
  }
}

async function backupRefreshToken(refreshToken: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(SECURE_REFRESH_TOKEN_KEY, refreshToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function getBackupRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await SecureStore.getItemAsync(SECURE_REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function clearBackupRefreshToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(SECURE_SESSION_STARTED_KEY),
  ]);
}

export const SecureTokenStore = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') return await AsyncStorage.getItem(key);
      const current = await readSecureChunks(key);
      return current ?? (await migrateLegacyValueOnce(key));
    } catch (error) {
      if (__DEV__) console.error('[SecureTokenStore] Secure read failed:', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
        return;
      }

      await enqueueKeyWrite(key, async () => {
        await writeSecureChunks(key, value);
        await AsyncStorage.multiRemove([
          key,
          `${LEGACY_ENC_STORAGE_PREFIX}_${key}`,
          ...(key === 'auth_session' ? [LEGACY_ENC_STORAGE_PREFIX] : []),
        ]);

        const refreshToken = extractRefreshToken(value);
        if (refreshToken) await backupRefreshToken(refreshToken);
        await AsyncStorage.setItem(SESSION_HEARTBEAT_KEY, Date.now().toString());
      });
    } catch (error) {
      if (__DEV__) console.error('[SecureTokenStore] Secure write failed:', error);
      throw error;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
        return;
      }

      await enqueueKeyWrite(key, async () => {
        const existing = await readSecureChunks(key).catch(() => null);
        await deleteSecureChunks(key);
        await AsyncStorage.multiRemove([
          key,
          `${LEGACY_ENC_STORAGE_PREFIX}_${key}`,
          ...(key === 'auth_session' ? [LEGACY_ENC_STORAGE_PREFIX] : []),
        ]);
        if (key === 'auth_session' || (existing && extractRefreshToken(existing))) {
          await clearBackupRefreshToken();
        }
      });
    } catch (error) {
      if (__DEV__) console.error('[SecureTokenStore] Secure delete failed:', error);
      throw error;
    }
  },
};

export async function setSessionStartTimestamp(): Promise<void> {
  const value = Date.now().toString();
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(SECURE_SESSION_STARTED_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(SECURE_SESSION_STARTED_KEY, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getSessionStartTimestamp(): Promise<number | null> {
  try {
    const value =
      Platform.OS === 'web'
        ? await AsyncStorage.getItem(SECURE_SESSION_STARTED_KEY)
        : await SecureStore.getItemAsync(SECURE_SESSION_STARTED_KEY);
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export { clearBackupRefreshToken, getBackupRefreshToken };
