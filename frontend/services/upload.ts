// services/upload.ts — رفع صورة عبر presign (Cloudinary أو S3)

import { Platform } from 'react-native';
import { API_BASE } from './api';

type UploadFolder = 'avatars' | 'listings' | 'stories' | 'butchers' | 'posts' | 'temp';

type S3UploadSlot = {
  provider?: 's3';
  uploadUrl: string;
  cdnUrl: string;
};

type CloudinaryUploadSlot = {
  provider: 'cloudinary';
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
};

type LocalUploadSlot = {
  provider: 'local';
  uploadUrl: string;
  folder: UploadFolder;
};

type UploadSlot = S3UploadSlot | CloudinaryUploadSlot | LocalUploadSlot;

function guessMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function fileExtension(mimetype: string): string {
  return mimetype.split('/')[1] || 'jpg';
}

async function uploadToS3(slot: S3UploadSlot, localUri: string, mimetype: string): Promise<string> {
  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();

  const putRes = await fetch(slot.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimetype },
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error('فشل رفع الملف');
  }

  return slot.cdnUrl;
}

async function uploadToCloudinary(
  slot: CloudinaryUploadSlot,
  localUri: string,
  mimetype: string,
): Promise<string> {
  const form = new FormData();
  const ext = fileExtension(mimetype);

  if (Platform.OS === 'web') {
    const blob = await (await fetch(localUri)).blob();
    form.append('file', blob, `upload.${ext}`);
  } else {
    form.append('file', {
      uri: localUri,
      type: mimetype,
      name: `upload.${ext}`,
    } as unknown as Blob);
  }

  form.append('api_key', slot.apiKey);
  form.append('timestamp', String(slot.timestamp));
  form.append('signature', slot.signature);
  form.append('folder', slot.folder);
  form.append('public_id', slot.publicId);

  const res = await fetch(slot.uploadUrl, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.secure_url) {
    throw new Error(json.error?.message || 'فشل رفع الملف إلى Cloudinary');
  }

  return json.secure_url as string;
}

async function uploadToLocal(
  accessToken: string,
  slot: LocalUploadSlot,
  localUri: string,
  mimetype: string,
): Promise<string> {
  const form = new FormData();
  const ext = fileExtension(mimetype);

  if (Platform.OS === 'web') {
    const blob = await (await fetch(localUri)).blob();
    form.append('file', blob, `upload.${ext}`);
  } else {
    form.append('file', {
      uri: localUri,
      type: mimetype,
      name: `upload.${ext}`,
    } as unknown as Blob);
  }

  const url = `${API_BASE}/api/upload/direct?folder=${encodeURIComponent(slot.folder)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data?.url) {
    throw new Error(json.messageAr || json.message || 'فشل رفع الملف محلياً');
  }

  return json.data.url as string;
}

export async function uploadImageFromUri(
  accessToken: string,
  localUri: string,
  folder: UploadFolder,
): Promise<string> {
  const mimetype = guessMime(localUri);

  const presignRes = await fetch(`${API_BASE}/api/upload/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ mimetype, folder, count: 1 }),
  });

  const presignJson = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok || !presignJson.success) {
    throw new Error(
      presignJson.messageAr ||
        presignJson.message ||
        (presignRes.status === 503
          ? 'خدمة رفع الصور غير مُعدّة على السيرفر'
          : 'فشل تجهيز الرفع'),
    );
  }

  const slot = presignJson.data?.urls?.[0] as UploadSlot | undefined;
  if (!slot?.uploadUrl) {
    throw new Error('استجابة الرفع غير صالحة');
  }

  if (slot.provider === 'local') {
    return uploadToLocal(accessToken, slot as LocalUploadSlot, localUri, mimetype);
  }

  if (slot.provider === 'cloudinary' || 'signature' in slot) {
    return uploadToCloudinary(slot as CloudinaryUploadSlot, localUri, mimetype);
  }

  if (!slot.cdnUrl) {
    throw new Error('استجابة الرفع غير صالحة');
  }

  return uploadToS3(slot, localUri, mimetype);
}
