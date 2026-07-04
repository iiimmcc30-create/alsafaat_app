// Pick image or PDF for butcher application documents.

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import type { LocalFileUploadParams } from '@/services/butcherApplicationTypes';

export type PickedApplicationFile = LocalFileUploadParams & {
  fileSizeBytes: number;
};

function normalizeMime(mime: string | null | undefined, fileName?: string): string {
  if (mime && mime.length > 0) return mime;
  const lower = (fileName ?? '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function resolveFileSize(uri: string, reported: number | undefined): Promise<number> {
  if (reported && reported > 0) return reported;
  try {
    const blob = await (await fetch(uri)).blob();
    return blob.size;
  } catch {
    return 0;
  }
}

async function pickImage(): Promise<PickedApplicationFile | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('إذن الوصول', 'يرجى السماح بالوصول إلى معرض الصور لرفع المستند');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const fileSizeBytes = await resolveFileSize(asset.uri, asset.fileSize);
  return {
    localUri: asset.uri,
    originalFileName: asset.fileName ?? `image.${asset.uri.split('.').pop() ?? 'jpg'}`,
    mimeType: normalizeMime(asset.mimeType, asset.fileName ?? undefined),
    fileSizeBytes,
  };
}

async function pickPdf(): Promise<PickedApplicationFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const fileSizeBytes = await resolveFileSize(asset.uri, asset.size);
  return {
    localUri: asset.uri,
    originalFileName: asset.name,
    mimeType: normalizeMime(asset.mimeType, asset.name),
    fileSizeBytes,
  };
}

export function pickApplicationDocument(): Promise<PickedApplicationFile | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      pickPdf().then(resolve);
      return;
    }

    Alert.alert('اختر نوع الملف', 'PDF أو صورة (JPG، PNG، WEBP)', [
      { text: 'إلغاء', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'صورة',
        onPress: () => {
          pickImage().then(resolve);
        },
      },
      {
        text: 'ملف PDF',
        onPress: () => {
          pickPdf().then(resolve);
        },
      },
    ]);
  });
}
