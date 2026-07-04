// services/upload.ts — رفع صورة عبر presign (Cloudinary أو S3)

import { Platform } from 'react-native';
import { API_BASE } from './api';

type UploadFolder =
  | 'avatars'
  | 'listings'
  | 'stories'
  | 'butchers'
  | 'posts'
  | 'temp'
  | 'butcher-applications';

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

export type ButcherApplicationFileUploadResult = {
  fileKey: string;
  mimeType: string;
  fileSizeBytes: number;
  originalFileName: string;
};

type PresignSlot = UploadSlot & { fileKey?: string };

function guessMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function fileNameFromUri(uri: string): string {
  const parts = uri.split(/[\\/]/);
  const name = parts[parts.length - 1];
  return name && name.length > 0 ? name : 'document';
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

async function readLocalFileMeta(
  localUri: string,
  mimetype: string,
): Promise<{ blob: Blob; fileSizeBytes: number }> {
  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();
  return { blob, fileSizeBytes: blob.size };
}

async function uploadBlobToSlot(
  slot: UploadSlot,
  accessToken: string,
  localUri: string,
  mimetype: string,
  blob?: Blob,
): Promise<void> {
  if (slot.provider === 'local') {
    await uploadToLocal(accessToken, slot as LocalUploadSlot, localUri, mimetype);
    return;
  }
  if (slot.provider === 'cloudinary' || 'signature' in slot) {
    await uploadToCloudinary(slot as CloudinaryUploadSlot, localUri, mimetype);
    return;
  }
  if (!slot.cdnUrl) {
    throw new Error('استجابة الرفع غير صالحة');
  }
  const body = blob ?? (await (await fetch(localUri)).blob());
  const putRes = await fetch(slot.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimetype },
    body,
  });
  if (!putRes.ok) {
    throw new Error('فشل رفع الملف');
  }
}

/** Presign + upload for butcher-application documents; returns storage fileKey for API registration. */
export async function uploadButcherApplicationFileFromUri(
  accessToken: string,
  localUri: string,
  options: { originalFileName?: string; mimeType?: string } = {},
): Promise<ButcherApplicationFileUploadResult> {
  const mimetype = options.mimeType ?? guessMime(localUri);
  const originalFileName = options.originalFileName ?? fileNameFromUri(localUri);
  const { blob, fileSizeBytes } = await readLocalFileMeta(localUri, mimetype);

  const presignRes = await fetch(`${API_BASE}/api/upload/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ mimetype, folder: 'butcher-applications', count: 1 }),
  });

  const presignJson = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok || !presignJson.success) {
    throw new Error(
      presignJson.messageAr ||
        presignJson.message ||
        (presignRes.status === 503
          ? 'خدمة رفع الملفات غير مُعدّة على السيرفر'
          : 'فشل تجهيز الرفع'),
    );
  }

  const slot = presignJson.data?.urls?.[0] as PresignSlot | undefined;
  if (!slot?.uploadUrl || !slot.fileKey) {
    throw new Error('استجابة الرفع غير صالحة');
  }

  await uploadBlobToSlot(slot, accessToken, localUri, mimetype, blob);

  return {
    fileKey: slot.fileKey,
    mimeType: mimetype,
    fileSizeBytes,
    originalFileName,
  };
}
