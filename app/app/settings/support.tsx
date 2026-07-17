import { SettingsMenuScreen, type SettingsMenuItem } from '@/components/ui/SettingsMenuScreen';

const ITEMS: SettingsMenuItem[] = [
  {
    icon: 'email-outline',
    label: 'تواصل معنا',
    subtitle: 'راسلنا عبر البريد أو واتساب',
    route: '/info/contact',
  },
  {
    icon: 'alert-circle-outline',
    label: 'الإبلاغ عن مشكلة',
    subtitle: 'أبلغنا عن خطأ أو محتوى مخالف',
    route: '/info/contact',
  },
  {
    icon: 'ticket-outline',
    label: 'تذاكر الدعم',
    subtitle: 'متابعة طلبات الدعم الفني',
    route: '/info/contact',
  },
];

export default function SupportScreen() {
  return (
    <SettingsMenuScreen
      title="الدعم والمساعدة"
      description="فريق سرح جاهز لمساعدتك والإجابة عن استفساراتك."
      heroIcon="lifebuoy"
      items={ITEMS}
    />
  );
}
