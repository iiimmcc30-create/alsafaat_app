import { SettingsMenuScreen, type SettingsMenuItem } from '@/components/ui/SettingsMenuScreen';

const ITEMS: SettingsMenuItem[] = [
  {
    icon: 'information-outline',
    label: 'من نحن',
    subtitle: 'تعرّف على منصة سرح ورسالتها',
    route: '/info/about',
  },
  {
    icon: 'file-document-outline',
    label: 'الشروط والأحكام',
    subtitle: 'شروط استخدام المنصة',
    route: '/info/terms',
  },
  {
    icon: 'lock-outline',
    label: 'سياسة الخصوصية',
    subtitle: 'كيف نحمي بياناتك',
    route: '/info/privacy',
  },
  {
    icon: 'receipt-outline',
    label: 'سياسة الاسترداد',
    subtitle: 'شروط وإجراءات استرداد المبالغ',
    route: '/info/refund',
  },
];

export default function InfoCenterScreen() {
  return (
    <SettingsMenuScreen
      title="مركز المعلومات"
      description="كل ما تحتاج معرفته عن منصة سرح وسياساتها في مكان واحد."
      heroIcon="information-outline"
      items={ITEMS}
    />
  );
}
