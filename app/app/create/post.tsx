// Powered by OnSpace.AI
// SAFAT — Create Post Screen (إنشاء منشور - نظام X)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';

const POST_TYPES = [
  { id: 'text', icon: 'document-text-outline', label: 'نص', iconLib: 'ionicons' },
  { id: 'image', icon: 'image-outline', label: 'صورة', iconLib: 'ionicons' },
  { id: 'poll', icon: 'bar-chart-outline', label: 'استطلاع', iconLib: 'ionicons' },
  { id: 'listing', icon: 'pricetag-outline', label: 'إعلان', iconLib: 'ionicons' },
];

const SUGGESTED_HASHTAGS = [
  '#إبل', '#خيول', '#أغنام', '#صقور', '#مزاد', '#سروح', '#سوق_الخليج', '#ماشية',
];

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = !!editId;
  const { me, addPost, updatePost } = useApp();
  const { accessToken } = useAuth();

  const [content, setContent] = useState('');
  const [arabicContent, setArabicContent] = useState('');
  const [selectedType, setSelectedType] = useState('text');
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPost, setLoadingPost] = useState(!!editId);

  useEffect(() => {
    if (!editId || !accessToken) return;
    let active = true;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/posts/${editId}`);
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.success && json.data) {
          setArabicContent(json.data.arabicContent ?? '');
          setContent(json.data.content ?? '');
        } else {
          Alert.alert('خطأ', 'تعذر تحميل المنشور');
          router.back();
        }
      } catch {
        if (active) {
          Alert.alert('خطأ', 'تعذر تحميل المنشور');
          router.back();
        }
      } finally {
        if (active) setLoadingPost(false);
      }
    })();
    return () => { active = false; };
  }, [editId, accessToken, router]);

  const MAX_CHARS = 280;
  const remaining = MAX_CHARS - (arabicContent.length + content.length);
  const canPost = (arabicContent.trim() || content.trim()) && remaining >= 0;

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const insertHashtag = (tag: string) => {
    const separator = arabicContent.endsWith(' ') || arabicContent.length === 0 ? '' : ' ';
    setArabicContent((prev) => prev + separator + tag + ' ');
    toggleHashtag(tag);
  };

  const handlePost = async () => {
    if (!canPost) return;
    setSubmitting(true);
    const payload = {
      content: content.trim() || arabicContent.trim(),
      arabicContent: arabicContent.trim() || content.trim(),
    };
    const success = isEditing && editId
      ? await updatePost(editId, payload)
      : await addPost(payload);
    setSubmitting(false);

    if (success) {
      router.back();
    } else {
      Alert.alert('خطأ', isEditing ? 'فشل تحديث المنشور.' : 'فشل نشر المنشور. يرجى المحاولة لاحقاً.');
    }
  };

  if (loadingPost) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ ...typography.body, color: colors.textMuted }}>جاري التحميل...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 12}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.cancelBtn} hitSlop={8}>
            <Text style={styles.cancelText}>إلغاء</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? 'تعديل المنشور' : 'منشور جديد'}</Text>
          <Pressable
            style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!canPost || submitting}
          >
            <LinearGradient
              colors={canPost ? gradients.royal : [colors.bgSurface, colors.bgSurface]}
              style={styles.postBtnInner}
            >
              <Text style={[styles.postBtnText, !canPost && { color: colors.textMuted }]}>
                {submitting ? '...' : isEditing ? 'حفظ' : 'نشر'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Post type selector */}
        <View style={styles.typeRow}>
          {POST_TYPES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setSelectedType(t.id)}
              style={[styles.typeChip, selectedType === t.id && styles.typeChipActive]}
            >
              <AppIcon
                name={t.icon}
                size={14}
                color={selectedType === t.id ? colors.electricBright : colors.textMuted}
              />
              <Text style={[styles.typeLabel, selectedType === t.id && styles.typeLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Compose area */}
          <View style={styles.composeRow}>
            <Image source={{ uri: me.avatar }} style={styles.avatar} contentFit="cover" />
            <View style={styles.composeFields}>
              {/* Arabic (main) */}
              <TextInput
                value={arabicContent}
                onChangeText={setArabicContent}
                placeholder="ماذا يدور في ذهنك؟ 🐪"
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, styles.textInputAr]}
                multiline
                maxLength={MAX_CHARS}
                textAlign="right"
                autoFocus
              />
              {/* English (optional) */}
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Add English translation (optional)"
                placeholderTextColor={colors.textSubtle}
                style={[styles.textInput, styles.textInputEn]}
                multiline
                maxLength={MAX_CHARS}
              />
            </View>
          </View>

          {/* Audience */}
          <Pressable style={styles.audienceRow}>
            <AppIcon name="earth" size={14} color={colors.electricBright} />
            <Text style={styles.audienceText}>الجميع يمكنهم الرد</Text>
            <AppIcon name="chevron-down" size={14} color={colors.electricBright} />
          </Pressable>

          {/* Hashtag suggestions */}
          <View style={styles.hashtagSection}>
            <Text style={styles.hashtagTitle}>الوسوم الشائعة</Text>
            <View style={styles.hashtagRow}>
              {SUGGESTED_HASHTAGS.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => insertHashtag(tag)}
                  style={[
                    styles.hashtagChip,
                    selectedHashtags.includes(tag) && styles.hashtagChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.hashtagText,
                      selectedHashtags.includes(tag) && styles.hashtagTextActive,
                    ]}
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Preview */}
          {(arabicContent || content) && (
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>معاينة</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Image source={{ uri: me.avatar }} style={styles.previewAvatar} contentFit="cover" />
                  <View>
                    <Text style={styles.previewName}>{me.arabicName}</Text>
                    <Text style={styles.previewHandle}>@{me.username} · الآن</Text>
                  </View>
                </View>
                {arabicContent ? (
                  <Text style={styles.previewText}>{arabicContent}</Text>
                ) : null}
                {content ? (
                  <Text style={styles.previewSubText}>{content}</Text>
                ) : null}
              </View>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>

        {/* Bottom toolbar — lifted above system nav / keyboard */}
        <View
          style={[
            styles.toolbar,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
          ]}
        >
          <View style={styles.toolbarLeft}>
            {[
              { icon: 'image-outline', label: 'صورة' },
              { icon: 'location-outline', label: 'موقع' },
              { icon: 'at-outline', label: 'إشارة' },
              { icon: 'link-outline', label: 'رابط' },
            ].map((tool) => (
              <Pressable key={tool.icon} style={styles.toolBtn} hitSlop={8}>
                <AppIcon name={tool.icon} size={20} color={colors.electricBright} />
              </Pressable>
            ))}
          </View>
          <View style={styles.charCountWrap}>
            <View style={[
              styles.charRing,
              remaining < 20 && { borderColor: colors.amber },
              remaining < 0 && { borderColor: colors.rose },
            ]}>
              <Text style={[
                styles.charCountText,
                remaining < 20 && { color: colors.amber },
                remaining < 0 && { color: colors.rose },
              ]}>
                {remaining}
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  cancelBtn: { paddingHorizontal: 4 },
  cancelText: { ...typography.body, color: colors.textSecondary },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  postBtn: { borderRadius: radius.pill, overflow: 'hidden' },
  postBtnDisabled: { opacity: 0.5 },
  postBtnInner: {
    paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill,
  },
  postBtnText: { ...typography.bodyStrong, color: '#fff' },
  typeRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  typeChipActive: { borderColor: colors.electric, backgroundColor: `${colors.electric}15` },
  typeLabel: { ...typography.micro, color: colors.textMuted },
  typeLabelActive: { color: colors.textBrandStrong },
  scroll: { paddingBottom: 20 },
  composeRow: {
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: colors.borderMid,
    marginTop: 4,
  },
  composeFields: { flex: 1, gap: spacing.sm },
  textInput: {
    ...typography.body, color: colors.textPrimary,
    minHeight: 60, maxHeight: 200,
    paddingTop: 0,
  },
  textInputAr: { textAlign: 'right', fontSize: 17, lineHeight: 26 },
  textInputEn: { textAlign: 'left', fontSize: 14, color: colors.textSecondary },
  audienceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    paddingVertical: 8, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.electric,
    alignSelf: 'flex-end',
    backgroundColor: `${colors.electric}10`,
  },
  audienceText: { ...typography.caption, color: colors.textBrandStrong },
  hashtagSection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  hashtagTitle: { ...typography.micro, color: colors.textMuted, marginBottom: spacing.sm },
  hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hashtagChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  hashtagChipActive: { backgroundColor: `${colors.electric}20`, borderColor: colors.electric },
  hashtagText: { ...typography.caption, color: colors.textMuted },
  hashtagTextActive: { color: colors.textBrandStrong },
  previewSection: { padding: spacing.lg, gap: spacing.sm },
  previewLabel: { ...typography.micro, color: colors.textMuted },
  previewCard: {
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewAvatar: { width: 32, height: 32, borderRadius: 16 },
  previewName: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  previewHandle: { ...typography.micro, color: colors.textMuted },
  previewText: { ...typography.body, color: colors.textPrimary, textAlign: 'right', lineHeight: 24 },
  previewSubText: { ...typography.caption, color: colors.textSecondary },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
    backgroundColor: colors.bgDeep,
    minHeight: 56,
  },
  toolbarLeft: { flexDirection: 'row', gap: spacing.sm },
  toolBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  charCountWrap: { alignItems: 'center', justifyContent: 'center' },
  charRing: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: colors.electric,
    alignItems: 'center', justifyContent: 'center',
  },
  charCountText: { fontSize: 10, fontWeight: '700', color: colors.textBrandAlt },
  });
}
