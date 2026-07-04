// Powered by OnSpace.AI
// SAFAT — Edit Profile Screen (تعديل الملف الشخصي)

import { Ionicons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { Country, countries } from '@/services/types';

const GCC_COUNTRIES: { code: Country; ar: string; flag: string }[] = [
  { code: 'SA', ar: 'السعودية', flag: '🇸🇦' },
  { code: 'EG', ar: 'مصر', flag: '🇪🇬' },
];

export default function EditProfileScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { me, updateMe } = useApp();

  const [displayName, setDisplayName] = useState(me.displayName);
  const [arabicName, setArabicName] = useState(me.arabicName);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [country, setCountry] = useState<Country>(me.country);
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [privacySettings, setPrivacySettings] = useState({
    showInSearch: true,
    allowFollow: true,
    showFollowers: false,
  });

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح للتطبيق بالوصول إلى مكتبة الصور');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const togglePrivacy = (key: keyof typeof privacySettings) => {
    setPrivacySettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!displayName.trim() || !arabicName.trim() || !username.trim()) {
      Alert.alert('خطأ', 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setSaving(true);
    const updates: any = { displayName, arabicName, username, bio, country };
    if (avatarUri) updates.avatar = avatarUri;
    const success = await updateMe(updates);
    setSaving(false);
    if (success) {
      router.back();
    } else {
      Alert.alert('خطأ', 'فشل حفظ التغييرات، يرجى المحاولة مجدداً.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>تعديل الملف الشخصي</Text>
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnLoading]}
            onPress={handleSave}
            disabled={saving}
          >
            <LinearGradient
              colors={saving ? [colors.bgSurface, colors.bgSurface] : gradients.royal}
              style={styles.saveBtnInner}
            >
              <Text style={[styles.saveBtnText, saving && { color: colors.textMuted }]}>
                {saving ? 'جاري...' : 'حفظ'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Avatar section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: avatarUri ?? me.avatar }} style={styles.avatar} contentFit="cover" />
              <Pressable style={styles.cameraBtn} onPress={handlePickAvatar}>
                <Ionicons name="camera" size={16} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.avatarHint}>{avatarUri ? '✓ تم اختيار الصورة' : 'اضغط لتغيير الصورة'}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Display name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>الاسم الإنجليزي *</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your display name"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Arabic name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>الاسم العربي *</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={arabicName}
                  onChangeText={setArabicName}
                  placeholder="اسمك بالعربية"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputRtl]}
                  textAlign="right"
                />
              </View>
            </View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>اسم المستخدم *</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={(t) => setUsername(t.replace(/\s/g, '').toLowerCase())}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { flex: 1 }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.fieldHint}>safat.app/@{username}</Text>
            </View>

            {/* Bio */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>السيرة الذاتية</Text>
              <View style={[styles.inputWrap, styles.inputMultiline]}>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="أخبرنا عن نفسك..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputRtl, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  maxLength={160}
                  textAlign="right"
                />
              </View>
              <Text style={styles.charCount}>{bio.length}/160</Text>
            </View>

            {/* Country */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>الدولة</Text>
              <View style={styles.countryRow}>
                {GCC_COUNTRIES.map((c) => (
                  <Pressable
                    key={c.code}
                    onPress={() => setCountry(c.code)}
                    style={[styles.countryChip, country === c.code && styles.countryChipActive]}
                  >
                    <Text style={styles.countryFlag}>{c.flag}</Text>
                    <Text style={[styles.countryLabel, country === c.code && styles.countryLabelActive]}>
                      {c.ar}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Divider */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>إعدادات الخصوصية</Text>
            </View>

            {([
              { key: 'showInSearch' as const, label: 'إظهار الحساب في نتائج البحث' },
              { key: 'allowFollow' as const, label: 'السماح بمتابعتي مباشرة' },
              { key: 'showFollowers' as const, label: 'إظهار عدد المتابعين' },
            ]).map((setting) => (
              <View key={setting.key} style={styles.settingRow}>
                <Text style={styles.settingLabel}>{setting.label}</Text>
                <Pressable
                  onPress={() => togglePrivacy(setting.key)}
                  style={[styles.toggle, privacySettings[setting.key] && styles.toggleOn]}
                >
                  <View style={[styles.toggleThumb, privacySettings[setting.key] && styles.toggleThumbOn]} />
                </Pressable>
              </View>
            ))}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
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
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  saveBtn: { borderRadius: radius.pill, overflow: 'hidden' },
  saveBtnLoading: { opacity: 0.7 },
  saveBtnInner: {
    paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill,
  },
  saveBtnText: { ...typography.bodyStrong, color: '#fff' },
  scroll: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: colors.electric,
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.electric, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bgDeep,
  },
  avatarHint: { ...typography.micro, color: colors.textMuted, marginTop: spacing.sm },
  form: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  inputMultiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  atSign: { ...typography.body, color: colors.textMuted, marginRight: 4 },
  input: {
    flex: 1, ...typography.body, color: colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  inputRtl: { textAlign: 'right' },
  fieldHint: { ...typography.micro, color: colors.textSubtle },
  charCount: { ...typography.micro, color: colors.textSubtle, textAlign: 'left' },
  countryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  countryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  countryChipActive: { borderColor: colors.electric, backgroundColor: `${colors.electric}20` },
  countryFlag: { fontSize: 16 },
  countryLabel: { ...typography.caption, color: colors.textMuted },
  countryLabelActive: { color: colors.textBrandStrong },
  sectionDivider: {
    paddingVertical: spacing.md, marginTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  sectionLabel: { ...typography.micro, color: colors.textMuted, letterSpacing: 0.8 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  settingLabel: { ...typography.body, color: colors.textSecondary, flex: 1 },
  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: colors.bgElevated, justifyContent: 'center',
    paddingHorizontal: 2, borderWidth: 1, borderColor: colors.borderSoft,
  },
  toggleOn: { backgroundColor: colors.electric, borderColor: colors.electric },
  toggleThumb: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.textMuted,
  },
  toggleThumbOn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  });
}
