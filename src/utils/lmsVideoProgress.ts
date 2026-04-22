import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lms_video_progress_v1';

export type VideoProgress = {
  materialId: string;
  maxWatchedTime: number;
  duration: number;
  completed: boolean;
  viewCounted: boolean;
};

export async function getVideoProgressMap(): Promise<Record<string, VideoProgress>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, VideoProgress>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getVideoProgress(materialId: string): Promise<VideoProgress | null> {
  const map = await getVideoProgressMap();
  return map[materialId] ?? null;
}

export async function upsertVideoProgress(progress: VideoProgress): Promise<void> {
  const map = await getVideoProgressMap();
  map[progress.materialId] = progress;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
