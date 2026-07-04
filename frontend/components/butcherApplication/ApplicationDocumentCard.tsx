import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  formatApplicationDateTime,
} from '@/lib/butcherApplicationLabels';
import { maxBytesLabelForDocumentType } from '@/lib/butcherApplicationValidation';
import { rtlRow } from '@/lib/rtl';
import type {
  ApplicationDocument,
  ButcherApplicationDocumentType,
} from '@/services/butcherApplicationTypes';

const DOC_ICONS: Record<
  ButcherApplicationDocumentType,
  keyof typeof Ionicons.glyphMap
> = {
  commercial_license: 'document-text-outline',
  national_id: 'card-outline',
  municipal_permit: 'ribbon-outline',
  shop_photo: 'camera-outline',
  other: 'attach-outline',
};

export type DocumentUploadPhase = 'idle' | 'picking' | 'uploading' | 'deleting';

type ApplicationDocumentCardProps = {
  type: ButcherApplicationDocumentType;
  document: ApplicationDocument | null;
  phase: DocumentUploadPhase;
  error?: string | null;
  disabled?: boolean;
  onUpload: () => void;
  onReplace: () => void;
  onDelete: () => void;
};

export function ApplicationDocumentCard({
  type,
  document,
  phase,
  error,
  disabled,
  onUpload,
  onReplace,
  onDelete,
}: ApplicationDocumentCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const statusAccentColors: Record<ApplicationDocument['status'], string> = {
    UPLOADED: colors.glow,
    APPROVED: colors.success,
    REJECTED: colors.danger,
  };
  const statusTextColors: Record<ApplicationDocument['status'], string> = {
    UPLOADED: colors.textBrand,
    APPROVED: colors.textBrandSuccess,
    REJECTED: colors.danger,
  };
  const busy = phase !== 'idle';
  const hasFile = Boolean(document?.fileKey);
  const icon = DOC_ICONS[type];
  const maxLabel = maxBytesLabelForDocumentType(type);

  const confirmDelete = () => {
    Alert.alert('حذف المستند', `هل تريد حذف ${DOCUMENT_TYPE_LABELS[type]}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: onDelete },
    ]);
  };

  const progressLabel =
    phase === 'picking'
      ? 'جاري اختيار الملف...'
      : phase === 'uploading'
        ? 'جاري الرفع والتسجيل...'
        : phase === 'deleting'
          ? 'جاري الحذف...'
          : null;

  return (
    <View style={[styles.card, error ? styles.cardError : null]}>
      <View style={rtlRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color={colors.glow} />
        </View>
        <View style={styles.main}>
          <Text style={styles.title}>{DOCUMENT_TYPE_LABELS[type]}</Text>
          <Text style={styles.hint}>PDF · JPG · PNG · WEBP — الحد {maxLabel}</Text>
        </View>
        {hasFile && document ? (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusAccentColors[document.status]}22` },
            ]}
          >
            <Text style={[styles.statusText, { color: statusTextColors[document.status] }]}>
              {DOCUMENT_STATUS_LABELS[document.status]}
            </Text>
          </View>
        ) : null}
      </View>

      {hasFile && document ? (
        <View style={styles.meta}>
          {document.originalFileName ? (
            <Text style={styles.metaText} numberOfLines={1}>
              {document.originalFileName}
            </Text>
          ) : null}
          <Text style={styles.metaText}>
            تاريخ الرفع: {formatApplicationDateTime(document.createdAt)}
          </Text>
          {document.status === 'REJECTED' && document.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>ملاحظات المراجع</Text>
              <Text style={styles.notesText}>{document.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.empty}>لم يُرفع هذا المستند بعد</Text>
      )}

      {busy && progressLabel ? (
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={colors.glow} />
          <Text style={styles.progressText}>{progressLabel}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        {!hasFile ? (
          <PrimaryButton
            title="رفع المستند"
            onPress={onUpload}
            disabled={disabled || busy}
            small
            style={styles.actionBtn}
          />
        ) : (
          <>
            <PrimaryButton
              title="استبدال"
              variant="outline"
              onPress={onReplace}
              disabled={disabled || busy}
              small
              style={styles.actionBtn}
            />
            <PrimaryButton
              title="حذف"
              variant="ghost"
              onPress={confirmDelete}
              disabled={disabled || busy}
              small
              style={styles.actionBtn}
            />
          </>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.lg,
      gap: spacing.md,
    },
    cardError: {
      borderColor: colors.danger,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.bgGlass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    main: {
      flex: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    title: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
    },
    hint: {
      ...typography.micro,
      color: colors.textMuted,
      fontWeight: '500',
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    statusText: {
      ...typography.micro,
      fontWeight: '700',
    },
    meta: {
      gap: spacing.xs,
      paddingTop: spacing.xs,
    },
    metaText: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    empty: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'right',
    },
    notesBox: {
      marginTop: spacing.sm,
      backgroundColor: 'rgba(244, 63, 94, 0.1)',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'rgba(244, 63, 94, 0.25)',
      padding: spacing.md,
      gap: spacing.xs,
    },
    notesTitle: {
      ...typography.caption,
      color: colors.danger,
      fontWeight: '700',
    },
    notesText: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    progressRow: {
      ...rtlRow,
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressText: {
      ...typography.caption,
      color: colors.textBrand,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    actionBtn: {
      flexGrow: 1,
      minWidth: 120,
    },
  });
}
