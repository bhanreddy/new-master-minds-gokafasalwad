import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** Stored student photos must never exceed 100 KiB. */
export const STUDENT_PHOTO_MAX_BYTES = 100 * 1024;

// Leave a little room below the hard limit for encoder differences between
// platforms. Multipart framing is not part of the image's stored byte size.
const CLIENT_TARGET_BYTES = 96 * 1024;

export interface PreparedStudentPhoto {
  uri: string;
  sizeBytes: number;
  width: number;
  height: number;
  quality: number;
}

async function uriSizeBytes(uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok && !uri.startsWith('blob:') && !uri.startsWith('data:')) {
      throw new Error('Could not read the selected photo.');
    }
    return (await response.blob()).size;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || typeof info.size !== 'number') {
    throw new Error('Could not measure the selected photo.');
  }
  return info.size;
}

function nextDimension(current: number, actualBytes: number): number {
  const ratio = Math.sqrt(CLIENT_TARGET_BYTES / Math.max(actualBytes, 1));
  const scale = Math.max(0.55, Math.min(0.84, ratio * 0.96));
  return Math.max(128, Math.floor((current * scale) / 8) * 8);
}

async function encode(
  uri: string,
  width: number,
  quality: number,
): Promise<PreparedStudentPhoto> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  return {
    uri: result.uri,
    sizeBytes: await uriSizeBytes(result.uri),
    width: result.width,
    height: result.height,
    quality,
  };
}

/**
 * Convert a picked camera/gallery image into a JPEG no larger than 100 KiB.
 *
 * The adaptive loop normally finishes in two or three encodes. Tiny fallback
 * dimensions make the ceiling deterministic for unusually noisy photographs.
 * The backend repeats validation and normalisation before storage, so a client
 * that cannot decode a platform-specific source format can still upload the
 * original for server-side conversion.
 */
export async function prepareStudentPhoto(uri: string): Promise<PreparedStudentPhoto> {
  if (!uri?.trim()) throw new Error('No student photo was selected.');

  let width = 720;
  let quality = 0.82;
  let smallest: PreparedStudentPhoto | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = await encode(uri, width, quality);
    if (!smallest || candidate.sizeBytes < smallest.sizeBytes) smallest = candidate;
    if (candidate.sizeBytes <= CLIENT_TARGET_BYTES) return candidate;

    width = nextDimension(width, candidate.sizeBytes);
    quality = Math.max(0.2, Number((quality - 0.09).toFixed(2)));
  }

  for (const fallback of [
    { width: 128, quality: 0.18 },
    { width: 96, quality: 0.12 },
    { width: 64, quality: 0.06 },
  ]) {
    const candidate = await encode(uri, fallback.width, fallback.quality);
    if (!smallest || candidate.sizeBytes < smallest.sizeBytes) smallest = candidate;
    if (candidate.sizeBytes <= STUDENT_PHOTO_MAX_BYTES) return candidate;
  }

  throw new Error(
    `Could not reduce the selected photo below 100 KB${smallest ? ` (smallest was ${Math.ceil(smallest.sizeBytes / 1024)} KB)` : ''}.`,
  );
}

