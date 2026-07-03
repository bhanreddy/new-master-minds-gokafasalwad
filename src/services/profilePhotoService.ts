import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from './apiClient';

/**
 * Self-service profile picture upload — shared by all five portals
 * (parent / admin / staff / driver / accountant). Talks to
 * PATCH /users/me/photo, which is strictly scoped to the caller's own person
 * (school_id + person_id derived server-side from the JWT).
 *
 * The client best-effort crops to a square and downscales before upload to save
 * bandwidth, but the SERVER is the source of truth: it re-encodes every upload
 * to a square JPEG in the 50–100 KB band, so this pre-processing only needs to
 * be "small enough", not exact.
 */

export interface PhotoUploadResult {
  photo_url: string;
}

/** Client-side pre-compression: square-ish crop + downscale to ~1024px JPEG. */
async function preprocess(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    // If manipulation fails for any reason, fall back to the original URI —
    // the server will still normalise it.
    return uri;
  }
}

/**
 * Upload a picked image URI as the current user's profile picture.
 * @returns the new public photo URL (already cache-busted by the server).
 */
export async function uploadProfilePhoto(uri: string): Promise<string> {
  const processedUri = await preprocess(uri);

  const formData = new FormData();

  if (Platform.OS === 'web') {
    // On web the RN {uri,name,type} shape is NOT a real file part — the browser
    // needs an actual Blob/File. The picked URI is a blob:/data: URL, so fetch
    // it into a Blob and append that.
    const resp = await fetch(processedUri);
    const blob = await resp.blob();
    formData.append('photo', blob, 'avatar.jpg');
  } else {
    // React Native native FormData file part shape (uri kept as-is, incl. file://).
    formData.append('photo', {
      uri: processedUri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as any);
  }

  const res = await api.uploadFormData<PhotoUploadResult>('/users/me/photo', formData, {
    method: 'PATCH',
    timeoutMs: 60000,
  });
  return res.photo_url;
}

/** Remove the current user's profile picture (revert to initials). */
export async function removeProfilePhoto(): Promise<void> {
  await api.delete('/users/me/photo');
}
