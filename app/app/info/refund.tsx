// Powered by OnSpace.AI
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon, rtlDirection, rtlRow } from '@/lib/rtl';

const REFUND_SECTIONS = [
  {
    title: 'نطاق سياسة الاسترداد',
    content: `تنطبق هذه السياسة على جميع الاشتراكات والمدفوعات التي تتم عبر منصة سرح. نحن نسعى دائماً لضمان رضا مستخدمينا، وندرك أن قد تنشأ حالات تستدعي إعادة النظر في المدفوعات.`,
  },
  {
    title: 'حالات الاسترداد المقبولة',
    content: `• في حال وجود خطأ تقني أدى إلى خصم مزدوج.\n• في حال عدم تفعيل الخدمة المدفوعة خلال 24 ساعة من الدفع.\n• في حال الإلغاء خلال 48 ساعة من الاشتراك الأول وعدم استخدام أي مزايا مدفوعة.\n• في حال إيقاف الخدمة من قِبل المنصة خلال مدة الاشتراك الفعلية.`,
  },
  {
    title: 'حالات عدم القبول',
    content: `• طلبات الاسترداد بعد مرور أكثر من 7 أيام من تاريخ الدفع.\n• الاشتراكات التي استُخدمت مزاياها بالكامل أو جزئياً.\n• في حال إغلاق الحساب طوعياً من قِبل المستخدم.\n• الإعلانات والمنشورات المنشورة ضمن الباقة المدفوعة.`,
  },
  {
    title: 'إجراءات طلب الاسترداد',
    content: `١. تواصل مع فريق الدعم عبر صفحة "تواصل معنا".\n٢. أرسل رقم الطلب أو معرّف الدفع مع وصف المشكلة.\n٣. سيتم مراجعة طلبك خلال 3-5 أيام عمل.\n٤. في حال القبول، يُعاد المبلغ خلال 7-14 يوم عمل إلى وسيلة الدفع الأصلية.`,
  },
  {
    title: 'الجزئي مقابل الكامل',
    content: `قد يُقدَّم استرداد جزئي في حال استخدام جزء من الخدمة. يُحتسب ذلك بناءً على الأيام المتبقية من الاشتراك وفق الصيغة التالية: (المبلغ المدفوع ÷ عدد أيام الاشتراك) × عدد الأيام غير المستخدمة.`,
  },
  {
    title: 'العملات والرسوم',
    content: `جميع المبالغ المستردة بالعملة الأصلية للدفع. لا تتحمل المنصة أي رسوم تحويل أو رسوم بنكية تنشأ عن عملية الاسترداد، وهي تقع على عاتق المستخدم.`,
  },
  {
    title: 'التواصل',
    content: `للاستفسار أو تقديم طلب استرداد:\n📧 support@safat.app\nأو عبر صفحة تواصل معنا داخل التطبيق.`,
  },
];

export default function RefundScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles((theme) => createStyles(theme.colors));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, rtlRow]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>سياسة الاسترداد</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, rtlDirection]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          آخر تحديث: يوليو ٢٠٢٥ · هذه السياسة جزء من شروط وأحكام منصة سرح وتنظّم حالات استرداد المبالغ المدفوعة.
        </Text>

        {REFUND_SECTIONS.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>سرح · جميع الحقوق محفوظة</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDeep },
    header: {
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    backBtn: { width: 36, alignItems: 'center' },
    headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1, textAlign: 'center' },
    scroll: { flex: 1 },
    content: { padding: spacing.xl, gap: spacing.lg },
    intro: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
    section: { gap: spacing.xs },
    sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary },
    sectionBody: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
    footer: { alignItems: 'center', marginTop: spacing.xl },
    footerText: { ...typography.micro, color: colors.textSubtle },
  });
}
