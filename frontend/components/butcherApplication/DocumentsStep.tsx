import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ApplicationDocumentCard,
  type DocumentUploadPhase,
} from '@/components/butcherApplication/ApplicationDocumentCard';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useButcherApplication } from '@/hooks/useButcherApplication';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { toApiError } from '@/services/butcherApplications';
import { pickApplicationDocument } from '@/lib/pickApplicationDocument';
import { validatePickedDocumentFile } from '@/lib/butcherApplicationValidation';
import type {
  ApplicationDetail,
  ApplicationDocument,
  ButcherApplicationDocumentType,
} from '@/services/butcherApplicationTypes';

const REQUIRED_TYPES: ButcherApplicationDocumentType[] = [
  'commercial_license',
  'national_id',
  'municipal_permit',
  'shop_photo',
];

type DocumentsStepProps = {
  applicationId: string;
  application: ApplicationDetail;
  onApplicationUpdated: (app: ApplicationDetail) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
};

function findDocumentForType(
  documents: ApplicationDocument[],
  type: ButcherApplicationDocumentType,
): ApplicationDocument | null {
  const withFile = documents.filter((d) => d.type === type && d.fileKey);
  if (withFile.length === 0) {
    return documents.find((d) => d.type === type) ?? null;
  }
  return withFile.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}

function errorMessage(err: unknown): string {
  const api = toApiError(err);
  if (api) return api.messageAr;
  if (err instanceof Error) return err.message;
  return 'حدث خطأ غير متوقع';
}

export function DocumentsStep({
  applicationId,
  application,
  onApplicationUpdated,
  onBusyChange,
  disabled,
}: DocumentsStepProps) {
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { uploadDocument, replaceDocument, deleteDocument, get } = useButcherApplication();
  const [activeType, setActiveType] = useState<ButcherApplicationDocumentType | null>(null);
  const [phase, setPhase] = useState<DocumentUploadPhase>('idle');
  const [errors, setErrors] = useState<Partial<Record<ButcherApplicationDocumentType, string>>>({});

  const documentsByType = useMemo(() => {
    const map: Partial<Record<ButcherApplicationDocumentType, ApplicationDocument | null>> = {};
    for (const type of REQUIRED_TYPES) {
      map[type] = findDocumentForType(application.documents, type);
    }
    return map;
  }, [application.documents]);

  const setBusy = useCallback(
    (type: ButcherApplicationDocumentType | null, nextPhase: DocumentUploadPhase) => {
      setActiveType(type);
      setPhase(nextPhase);
      onBusyChange?.(nextPhase !== 'idle');
    },
    [onBusyChange],
  );

  const refreshApplication = useCallback(async () => {
    const refreshed = await get(applicationId);
    onApplicationUpdated(refreshed);
    return refreshed;
  }, [applicationId, get, onApplicationUpdated]);

  const pickAndValidate = useCallback(async (type: ButcherApplicationDocumentType) => {
    setErrors((prev) => ({ ...prev, [type]: undefined }));
    setBusy(type, 'picking');
    try {
      const picked = await pickApplicationDocument();
      if (!picked) {
        setBusy(null, 'idle');
        return null;
      }
      const issue = validatePickedDocumentFile(type, picked.mimeType ?? 'image/jpeg', picked.fileSizeBytes);
      if (issue) {
        setErrors((prev) => ({ ...prev, [type]: issue.message }));
        setBusy(null, 'idle');
        return null;
      }
      setBusy(type, 'uploading');
      return picked;
    } catch (err) {
      setErrors((prev) => ({ ...prev, [type]: errorMessage(err) }));
      setBusy(null, 'idle');
      return null;
    }
  }, [setBusy]);

  const handleUpload = useCallback(
    async (type: ButcherApplicationDocumentType) => {
      const picked = await pickAndValidate(type);
      if (!picked) return;
      try {
        await uploadDocument(applicationId, type, picked);
        await refreshApplication();
      } catch (err) {
        setErrors((prev) => ({ ...prev, [type]: errorMessage(err) }));
      } finally {
        setBusy(null, 'idle');
      }
    },
    [applicationId, pickAndValidate, refreshApplication, setBusy, uploadDocument],
  );

  const handleReplace = useCallback(
    async (type: ButcherApplicationDocumentType) => {
      const existing = documentsByType[type];
      if (!existing?.id) return;

      const picked = await pickAndValidate(type);
      if (!picked) return;
      try {
        await replaceDocument(applicationId, existing.id, type, picked);
        await refreshApplication();
      } catch (err) {
        setErrors((prev) => ({ ...prev, [type]: errorMessage(err) }));
      } finally {
        setBusy(null, 'idle');
      }
    },
    [applicationId, documentsByType, pickAndValidate, refreshApplication, replaceDocument, setBusy],
  );

  const handleDelete = useCallback(
    async (type: ButcherApplicationDocumentType) => {
      const existing = documentsByType[type];
      if (!existing?.id) return;

      setErrors((prev) => ({ ...prev, [type]: undefined }));
      setBusy(type, 'deleting');
      try {
        await deleteDocument(applicationId, existing.id);
        await refreshApplication();
      } catch (err) {
        setErrors((prev) => ({ ...prev, [type]: errorMessage(err) }));
      } finally {
        setBusy(null, 'idle');
      }
    },
    [applicationId, deleteDocument, documentsByType, refreshApplication, setBusy],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>المستندات</Text>
      <Text style={styles.sub}>
        ارفع المستندات المطلوبة بصيغة PDF أو صورة. سيتم حفظها مع طلبك تلقائياً بعد الرفع.
      </Text>

      {REQUIRED_TYPES.map((type) => (
        <ApplicationDocumentCard
          key={type}
          type={type}
          document={documentsByType[type] ?? null}
          phase={activeType === type ? phase : 'idle'}
          error={errors[type]}
          disabled={disabled || (activeType !== null && activeType !== type)}
          onUpload={() => handleUpload(type)}
          onReplace={() => handleReplace(type)}
          onDelete={() => handleDelete(type)}
        />
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.md,
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    sub: {
      ...typography.body,
      color: colors.textMuted,
      marginBottom: spacing.sm,
      lineHeight: 22,
    },
  });
}
