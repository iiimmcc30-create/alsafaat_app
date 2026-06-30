// Powered by OnSpace.AI
// SAFAT — Terms & Conditions (الشروط والأحكام)

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';

const TERMS = [
  {
    title: 'القبول بالشروط',
    content: `باستخدامك منصة الصفاة فإنك توافق على الالتزام بهذه الشروط والأحكام. إن كنت لا توافق على أي بند منها، يُرجى عدم استخدام المنصة.`,
  },
  {
    title: 'شروط التسجيل',
    content: `• يجب أن يكون عمرك 18 سنة أو أكثر.\n• يُلزم تقديم معلومات صحيحة ودقيقة عند التسجيل.\n• أنت مسؤول عن سرية كلمة المرور وحماية حسابك.\n• لكل مستخدم حساب واحد فقط.`,
  },
  {
    title: 'قواعد النشر',
    content: `• يُسمح فقط بنشر إعلانات الحيوانات والمعدات الزراعية المتوافقة مع أنظمة المملكة.\n• يُحظر نشر إعلانات مضللة أو صور غير حقيقية.\n• يُحظر نشر أي محتوى مسيء أو مخالف للأنظمة السعودية.\n• تحتفظ المنصة بحق حذف أي إعلان مخالف دون إشعار مسبق.`,
  },
  {
    title: 'المعاملات التجارية',
    content: `المنصة وسيلة للتواصل بين البائعين والمشترين فقط. لا تكون الصفاة طرفاً في أي صفقة بين المستخدمين. أي نزاع تجاري هو مسؤولية الأطراف المتعاقدة مباشرة.`,
  },
  {
    title: 'الرسوم والاشتراكات',
    content: `• بعض الميزات تتطلب اشتراكاً مدفوعاً موضحاً في صفحة باقات الاشتراك.\n• تُحتسب الرسوم وفق الباقة المختارة ولا تُردّ.\n• تُجدَّد الاشتراكات تلقائياً ما لم تُلغَ قبل تاريخ التجديد.`,
  },
  {
    title: 'الملكية الفكرية',
    content: `جميع حقوق الملكية الفكرية للمنصة محفوظة لشركة MAD UNIT. لا يُسمح بنسخ أو توزيع أو استخدام أي محتوى من المنصة تجارياً دون إذن خطي مسبق.`,
  },
  {
    title: 'إخلاء المسؤولية',
    content: `تُقدَّم المنصة "كما هي" دون ضمانات صريحة أو ضمنية. لا تتحمل الصفاة أو MAD UNIT مسؤولية أي خسائر تنتج عن استخدام المنصة أو المعاملات المُبرمة عبرها.`,
  },
  {
    title: 'القانون الواجب التطبيق',
    content: `تخضع هذه الشروط لأنظمة وقوانين المملكة العربية السعودية، وتختص المحاكم السعودية بالفصل في أي نزاع ينشأ عن تطبيقها.`,
  },
];

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>الشروط والأحكام</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.topBanner}>
          <Ionicons name="document-text" size={28} color={colors.gold} />
          <Text style={styles.bannerTitle}>شروط الاستخدام</Text>
          <Text style={styles.bannerDate}>آخر تحديث: يناير 2024</Text>
        </View>

        {TERMS.map((item, i) => (
          <View key={i} style={styles.section}>
            <View style={styles.titleRow}>
              <Text style={styles.sectionNum}>{i + 1}</Text>
              <Text style={styles.sectionTitle}>{item.title}</Text>
            </View>
            <Text style={styles.sectionContent}>{item.content}</Text>
          </View>
        ))}

        {/* Contact */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>للاستفسار</Text>
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
    backgroundColor: `${colors.gold}08`,
  },
  bannerTitle: { ...typography.h2, color: colors.textPrimary },
  bannerDate: { ...typography.caption, color: colors.textMuted },
  section: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, justifyContent: 'flex-end' },
  sectionNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: `${colors.electric}20`,
    lineHeight: 24,
    ...typography.micro,
    textAlign: 'center',
    color: colors.electricBright,
  },
  sectionTitle: { ...typography.bodyStrong, color: colors.gold, textAlign: 'right' },
  sectionContent: { ...typography.body, color: colors.textSecondary, lineHeight: 26, textAlign: 'right' },
  contactSection: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  contactLink: { ...typography.body, color: colors.electricBright },
  footer: { ...typography.micro, color: colors.textSubtle, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
