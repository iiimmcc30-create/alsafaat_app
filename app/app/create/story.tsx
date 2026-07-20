// SAFAT — Create Story Screen (إنشاء قصة)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { StoryVideoPlayer } from '@/components/feature/StoryVideoPlayer';
import { StoryVideoTrimmer } from '@/components/feature/StoryVideoTrimmer';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  STORY_MAX_DURATION_SEC,
  STORY_MIN_DURATION_SEC,
} from '@/constants/stories';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { alertMessage } from '@/lib/actionSheet';
import { rtlBackIcon } from '@/lib/rtl';
import {
  resolveStoryThumbnailUri,
  requiresStoryVideoTrim,
  storyDurationForKind,
  storyDurationFromAsset,
  validateStoryVideoDuration,
  type StoryMediaKind,
} from '@/lib/storyMedia';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { uploadMediaFromUri } from '@/services/upload';

type ButcherStoryType = 'daily_slaughter' | 'offer' | 'new_stock' | 'update';

type StoryDraft = {
  uri: string;
  kind: StoryMediaKind;
  durationSec: number;
};

type PendingVideoTrim = {
  uri: string;
  durationSec: number;
};

type PublishStage = 'idle' | 'uploading' | 'publishing';

function StoryVideoPreview({ uri }: { uri: string }) {
  return <StoryVideoPlayer uri={uri} style={StyleSheet.absoluteFill} muted loop />;
}

export default function CreateStoryScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  const BUTCHER_TYPES: { id: ButcherStoryType; label: string; icon: string; color: string }[] = [
    { id: 'daily_slaughter', label: 'ذبح يومي',   icon: '🔪', color: colors.danger   },
    { id: 'new_stock',       label: 'مخزون جديد', icon: '📦', color: colors.textBrandSuccess  },
    { id: 'offer',           label: 'عرض اليوم',  icon: '🏷️', color: colors.amber    },
    { id: 'update',          label: 'تحديث عام',  icon: '📢', color: colors.textBrandAlt },
  ];

  const router = useRouter();
  const { accessToken, user, activeMode } = useAuth();
  const params = useLocalSearchParams<{ type?: string; mode?: string }>();

  const isButcherMode =
    params.mode === 'butcher' ||
    activeMode === 'BUTCHER' ||
    user?.role === 'BUTCHER';

  const initialType = BUTCHER_TYPES.some((t) => t.id === params.type)
    ? (params.type as ButcherStoryType)
    : 'update';

  const [media, setMedia] = useState<StoryDraft | null>(null);
  const [pendingTrim, setPendingTrim] = useState<PendingVideoTrim | null>(null);
  const [captionAr, setCaptionAr] = useState('');
  const [location, setLocation] = useState('');
  const [storyType, setStoryType] = useState<ButcherStoryType>(initialType);
  const [submitting, setSubmitting] = useState(false);
  const [publishStage, setPublishStage] = useState<PublishStage>('idle');

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح بالوصول إلى الصور والفيديو لنشر قصة');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: Platform.OS === 'ios',
      aspect: [9, 16],
      quality: 0.85,
      videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video' || (asset.mimeType?.startsWith('video/') ?? false);

    if (isVideo) {
      const durationSec = storyDurationFromAsset(asset.duration);
      if (durationSec != null && durationSec < STORY_MIN_DURATION_SEC) {
        Alert.alert('مدة الفيديو', `مدة الفيديو يجب أن تكون ${STORY_MIN_DURATION_SEC} ثوانٍ على الأقل`);
        return;
      }

      if (durationSec == null || requiresStoryVideoTrim(durationSec)) {
        setPendingTrim({
          uri: asset.uri,
          durationSec: durationSec ?? 120,
        });
        return;
      }

      const durationError = validateStoryVideoDuration(durationSec);
      if (durationError) {
        Alert.alert('مدة الفيديو', durationError);
        return;
      }

      setMedia({
        uri: asset.uri,
        kind: 'video',
        durationSec: storyDurationForKind('video', durationSec),
      });
      return;
    }

    setMedia({
      uri: asset.uri,
      kind: 'image',
      durationSec: storyDurationForKind('image', null),
    });
  };

  const openVideoTrimmer = () => {
    if (!media || media.kind !== 'video') return;
    setPendingTrim({ uri: media.uri, durationSec: media.durationSec });
  };

  const handlePublish = async () => {
    if (!accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لنشر قصة');
      return;
    }
    if (!media) {
      Alert.alert('محتوى مطلوب', 'اختر صورة أو فيديو للقصة أولاً');
      return;
    }

    setSubmitting(true);
    setPublishStage('uploading');
    try {
      const thumbnailLocalUri = await resolveStoryThumbnailUri(media);

      let thumbnailUrl: string;
      let mediaUrl: string;
      try {
        if (media.kind === 'video') {
          [thumbnailUrl, mediaUrl] = await Promise.all([
            uploadMediaFromUri(accessToken, thumbnailLocalUri, 'stories', 'image'),
            uploadMediaFromUri(accessToken, media.uri, 'stories', 'video'),
          ]);
        } else {
          thumbnailUrl = await uploadMediaFromUri(accessToken, thumbnailLocalUri, 'stories', 'image');
          mediaUrl = thumbnailUrl;
        }
      } catch {
        if (__DEV__) {
          thumbnailUrl = `https://picsum.photos/seed/${Date.now()}/720/1280`;
          mediaUrl = thumbnailUrl;
        } else {
          throw new Error('تعذّر رفع الملف. تحقق من الاتصال وحاول مجدداً.');
        }
      }

      setPublishStage('publishing');

      const endpoint = isButcherMode ? `${API_BASE}/api/butchers/stories` : `${API_BASE}/api/stories`;
      const shared = {
        thumbnail: thumbnailUrl,
        captionAr: captionAr.trim() || null,
        caption: captionAr.trim() || null,
        duration: media.durationSec,
      };
      const body = isButcherMode
        ? {
            ...shared,
            mediaUrl: media.kind === 'video' ? mediaUrl : null,
            type: storyType,
          }
        : {
            ...shared,
            mediaUrl,
            location: location.trim() || null,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        const msg = json.messageAr || json.message || 'فشل نشر القصة';
        Alert.alert('خطأ', msg);
        return;
      }

      await alertMessage('تم النشر', 'قصتك متاحة الآن لمدة ٢٤ ساعة');
      router.back();
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذّر نشر القصة');
    } finally {
      setSubmitting(false);
      setPublishStage('idle');
    }
  };

  const publishLabel =
    publishStage === 'uploading'
      ? 'جاري الرفع...'
      : publishStage === 'publishing'
        ? 'جاري النشر...'
        : 'نشر';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>قصة جديدة</Text>
          <Pressable
            style={[styles.publishBtn, (!media || submitting) && styles.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={!media || submitting}
          >
            <LinearGradient
              colors={media && !submitting ? gradients.royal : [colors.bgSurface, colors.bgSurface]}
              style={styles.publishBtnInner}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.publishBtnText, !media && { color: colors.textMuted }]}>
                  {publishLabel}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>
            القصة تظهر ٢٤ ساعة — صورة أو فيديو من {STORY_MIN_DURATION_SEC} إلى {STORY_MAX_DURATION_SEC} ثوانٍ
          </Text>

          <Pressable style={styles.imageBox} onPress={pickMedia}>
            {media ? (
              media.kind === 'video' ? (
                <StoryVideoPreview uri={media.uri} />
              ) : (
                <Image source={{ uri: media.uri }} style={styles.preview} contentFit="cover" />
              )
            ) : (
              <View style={styles.imagePlaceholder}>
                <AppIcon name="images-outline" size={40} color={colors.electricBright} />
                <Text style={styles.imagePlaceholderText}>اختر صورة أو فيديو</Text>
                <Text style={styles.imagePlaceholderSub}>
                  نسبة 9:16 — فيديو {STORY_MIN_DURATION_SEC}–{STORY_MAX_DURATION_SEC} ث
                </Text>
              </View>
            )}
            {media && (
              <View style={styles.changePhotoBtn}>
                <AppIcon
                  name={media.kind === 'video' ? 'videocam-outline' : 'images-outline'}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.changePhotoText}>
                  {media.kind === 'video' ? `${media.durationSec} ث` : 'تغيير'}
                </Text>
              </View>
            )}
          </Pressable>

          {media?.kind === 'video' && (
            <Pressable style={styles.trimBtn} onPress={openVideoTrimmer}>
              <AppIcon name="cut-outline" size={18} color={colors.electricBright} />
              <Text style={styles.trimBtnText}>تعديل مقطع الفيديو</Text>
            </Pressable>
          )}

          {isButcherMode && (
            <>
              <Text style={styles.label}>نوع القصة</Text>
              <View style={styles.typeGrid}>
                {BUTCHER_TYPES.map((t) => {
                  const active = storyType === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setStoryType(t.id)}
                      style={[styles.typeChip, active && { borderColor: t.color, backgroundColor: t.color + '22' }]}
                    >
                      <Text style={styles.typeIcon}>{t.icon}</Text>
                      <Text style={[styles.typeLabel, active && { color: t.color }]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.label}>تعليق (اختياري)</Text>
          <TextInput
            style={styles.input}
            value={captionAr}
            onChangeText={setCaptionAr}
            placeholder="اكتب وصفاً قصيراً..."
            placeholderTextColor={colors.textSubtle}
            maxLength={200}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />

          {!isButcherMode && (
            <>
              <Text style={styles.label}>الموقع (اختياري)</Text>
              <TextInput
                style={styles.inputSingle}
                value={location}
                onChangeText={setLocation}
                placeholder="مثال: الرياض"
                placeholderTextColor={colors.textSubtle}
                maxLength={120}
                textAlign="right"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <StoryVideoTrimmer
        visible={pendingTrim != null}
        uri={pendingTrim?.uri ?? ''}
        durationSec={pendingTrim?.durationSec ?? STORY_MAX_DURATION_SEC}
        onCancel={() => setPendingTrim(null)}
        onConfirm={({ uri, durationSec }) => {
          setMedia({ uri, kind: 'video', durationSec });
          setPendingTrim(null);
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  publishBtn: { borderRadius: radius.pill, overflow: 'hidden' },
  publishBtnDisabled: { opacity: 0.7 },
  publishBtnInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    minWidth: 72,
    alignItems: 'center',
  },
  publishBtnText: { ...typography.bodyStrong, color: '#fff' },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  imageBox: {
    height: 360,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: colors.bgSurface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderStyle: 'dashed',
  },
  preview: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  imagePlaceholderText: { ...typography.bodyStrong, color: colors.textPrimary },
  imagePlaceholderSub: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  changePhotoBtn: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  changePhotoText: { ...typography.caption, color: '#fff', fontWeight: '600' },
  trimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
  },
  trimBtnText: { ...typography.caption, color: colors.electricBright, fontWeight: '600' },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'right',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  typeIcon: { fontSize: 14 },
  typeLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  input: {
    minHeight: 90,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputSingle: {
    minHeight: 48,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  });
}
