// SAFAT — Create Story Screen (إنشاء قصة)

import { Ionicons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
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
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { uploadImageFromUri } from '@/services/upload';

type ButcherStoryType = 'daily_slaughter' | 'offer' | 'new_stock' | 'update';

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

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [captionAr, setCaptionAr] = useState('');
  const [storyType, setStoryType] = useState<ButcherStoryType>(initialType);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح بالوصول إلى الصور لنشر قصة');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handlePublish = async () => {
    if (!accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لنشر قصة');
      return;
    }
    if (!imageUri) {
      Alert.alert('صورة مطلوبة', 'اختر صورة للقصة أولاً');
      return;
    }

    setSubmitting(true);
    try {
      let thumbnailUrl: string;
      try {
        thumbnailUrl = await uploadImageFromUri(accessToken, imageUri, 'stories');
      } catch {
        if (__DEV__) {
          thumbnailUrl = `https://picsum.photos/seed/${Date.now()}/720/1280`;
        } else {
          throw new Error('تعذّر رفع الصورة. تحقق من الاتصال وحاول مجدداً.');
        }
      }

      const endpoint = isButcherMode ? `${API_BASE}/api/butchers/stories` : `${API_BASE}/api/stories`;
      const body = isButcherMode
        ? {
            thumbnail: thumbnailUrl,
            captionAr: captionAr.trim() || null,
            caption: captionAr.trim() || null,
            type: storyType,
          }
        : {
            thumbnail: thumbnailUrl,
            mediaUrl: thumbnailUrl,
            captionAr: captionAr.trim() || null,
            caption: captionAr.trim() || null,
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

      Alert.alert('تم النشر', 'قصتك متاحة الآن لمدة ٢٤ ساعة', [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذّر نشر القصة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>قصة جديدة</Text>
          <Pressable
            style={[styles.publishBtn, (!imageUri || submitting) && styles.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={!imageUri || submitting}
          >
            <LinearGradient
              colors={imageUri && !submitting ? gradients.royal : [colors.bgSurface, colors.bgSurface]}
              style={styles.publishBtnInner}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.publishBtnText, !imageUri && { color: colors.textMuted }]}>
                  نشر
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>القصة تظهر للجميع لمدة ٢٤ ساعة ثم تختفي تلقائياً</Text>

          <Pressable style={styles.imageBox} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={40} color={colors.electricBright} />
                <Text style={styles.imagePlaceholderText}>اختر صورة للقصة</Text>
                <Text style={styles.imagePlaceholderSub}>نسبة 9:16 (عمودية)</Text>
              </View>
            )}
            {imageUri && (
              <View style={styles.changePhotoBtn}>
                <Ionicons name="images-outline" size={16} color="#fff" />
                <Text style={styles.changePhotoText}>تغيير الصورة</Text>
              </View>
            )}
          </Pressable>

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
        </ScrollView>
      </KeyboardAvoidingView>
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
  imagePlaceholderSub: { ...typography.caption, color: colors.textMuted },
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
  });
}
