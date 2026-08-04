import { Platform } from 'react-native';
import { api } from './apiClient';

export interface WebsiteGalleryItem {
  id: string;
  image_url: string;
  alt_text: string;
  caption: string | null;
  category: string;
  display_order: number;
  created_at: string;
}

export interface WebsiteGalleryUpload {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  category?: string;
  caption?: string;
  altText?: string;
}

async function appendImage(formData: FormData, upload: WebsiteGalleryUpload) {
  if (Platform.OS === 'web') {
    const response = await fetch(upload.uri);
    const blob = await response.blob();
    formData.append('image', blob, upload.fileName || 'gallery-photo.jpg');
    return;
  }

  formData.append('image', {
    uri: upload.uri,
    name: upload.fileName || 'gallery-photo.jpg',
    type: upload.mimeType || 'image/jpeg',
  } as any);
}

export const WebsiteGalleryService = {
  async list(): Promise<WebsiteGalleryItem[]> {
    const result = await api.get<{ items: WebsiteGalleryItem[] }>('/admin/website-gallery', undefined, {
      silent: true,
    });
    return result.items;
  },

  async upload(upload: WebsiteGalleryUpload): Promise<WebsiteGalleryItem> {
    const formData = new FormData();
    await appendImage(formData, upload);
    if (upload.category?.trim()) formData.append('category', upload.category.trim());
    if (upload.caption?.trim()) formData.append('caption', upload.caption.trim());
    if (upload.altText?.trim()) formData.append('alt_text', upload.altText.trim());

    const result = await api.uploadFormData<{ item: WebsiteGalleryItem }>(
      '/admin/website-gallery',
      formData,
      { method: 'POST', timeoutMs: 90000, silent: true },
    );
    return result.item;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/admin/website-gallery/${encodeURIComponent(id)}`, { silent: true });
  },
};
