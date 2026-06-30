// Powered by OnSpace.AI
// SAFAT — Privacy Policy (سياسة الخصوصية)

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';

const SECTIONS = [
  {
    title: 'مقدمة',
    content: `تلتزم منصة الصفاة (alsfat.com)، المملوكة لشركة MAD UNIT، بحماية خصوصية مستخدميها. توضّح هذه السياسة كيفية جمع بياناتك الشخصية واستخدامها وحفظها والحفاظ عليها وفق أحكام نظام حماية البيانات الشخصية في المملكة العربية السعودية.`,
  },
  {
    title: 'البيانات التي نجمعها',
    content: `• الاسم ورقم الجوال وعنوان البريد الإلكتروني عند التسجيل.\n• بيانات الحيوانات والإعلانات التي تنشرها.\n• الصور ومقاطع الفيديو التي ترفعها.\n• بيانات الموقع الجغرافي عند استخدام ميزات الخريطة (بإذنك).\n• سجلات الاستخدام والأجهزة لتحسين الخدمة.`,
  },
  {
    title: 'كيف نستخدم بياناتك',
    content: `• تشغيل المنصة وتقديم خدماتها الأساسية.\n• إرسال إشعارات متعلقة بإعلاناتك وعروضك.\n• تحسين تجربة المستخدم وتطوير الميزات.\n• الامتثال للمتطلبات القانونية والتنظيمية في المملكة.\n• منع الاحتيال وحماية أمن المنصة.`,
  },
  {
    title: 'مشاركة البيانات',
    content: `لا نبيع بياناتك الشخصية لأطراف ثالثة. قد نشارك بياناتك مع:\n• مزودي الخدمة التقنية الضروريين لتشغيل المنصة.\n• الجهات الحكومية والقضائية عند الطلب القانوني.\n\nجميع الشركاء ملزمون بسياسات صارمة لحماية البيانات.`,
  },
  {
    title: 'حقوقك',
    content: `يحق لك في أي وقت:\n• الاطلاع على بياناتك الشخصية المحفوظة لدينا.\n• تصحيح أي بيانات غير دقيقة.\n• طلب حذف بياناتك.\n• الاعتراض على معالجة بياناتك لأغراض التسويق.\n\nللتواصل بشأن هذه الحقوق: info@alsfat.com`,
  },
  {
    title: 'حفظ البيانات وأمانها',
    content: `نحفظ بياناتك على خوادم آمنة داخل المملكة العربية السعودية وفق أعلى معايير التشفير. نحتفظ ببياناتك طوال فترة نشاط حسابك، وبعد حذفه لمدة لا تتجاوز ما يقتضيه القانون.`,
  },
  {
    title: 'التعديلات على السياسة',
    content: `يحق لنا تعديل هذه السياسة في أي وقت. سيُبلَّغ المستخدمون بأي تغييرات جوهرية عبر إشعار داخل التطبيق. استمرارك في استخدام المنصة بعد التعديل يُعدّ موافقةً على السياسة المُعدَّلة.`,
  },
];

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>سياسة الخصوصية</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.topBanner}>
          <Ionicons name="shield-checkmark" size={28} color={colors.electricBright} />
          <Text style={styles.bannerTitle}>خصوصيتك تهمّنا</Text>
          <Text style={styles.bannerDate}>آخر تحديث: يناير 2024</Text>
        </View>

        {SECTIONS.map((sec, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <Text style={styles.sectionContent}>{sec.content}</Text>
          </View>
        ))}

        {/* Contact */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>تواصل معنا</Text>
          <Text style={styles.sectionContent}>لأي استفسار حول سياسة الخصوصية:</Text>
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL('mailto:info@alsfat.com')}>
            <Ionicons name="mail-outline" size={18} color={colors.electricBright} />
            <Text style={styles.contactLink}>info@alsfat.com</Text>
          </Pressable>
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL('tel:+966591298136')}>
            <Ionicons name="call-outline" size={18} color={colors.electricBright} />
            <Text style={styles.contactLink}>+966 591 298 136</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>© 2024 MAD UNIT · الصفاة · جميع الحقوق محفوظة</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  scroll: { paddingBottom: 40 },
  topBanner: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    backgroundColor: `${colors.electric}08`,
  },
  bannerTitle: { ...typography.h2, color: colors.textPrimary },
  bannerDate: { ...typography.caption, color: colors.textMuted },
  section: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  sectionTitle: { ...typography.bodyStrong, color: colors.electricBright, marginBottom: spacing.sm, textAlign: 'right' },
  sectionContent: { ...typography.body, color: colors.textSecondary, lineHeight: 26, textAlign: 'right' },
  contactSection: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  contactLink: { ...typography.body, color: colors.electricBright },
  footer: { ...typography.micro, color: colors.textSubtle, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
