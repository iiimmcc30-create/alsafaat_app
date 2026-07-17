import { SettingsMenuScreen, type SettingsMenuItem } from '@/components/ui/SettingsMenuScreen';

const ITEMS: SettingsMenuItem[] = [
  {
    icon: 'shield-check-outline',
    label: 'التحقق من الحساب والأمان',
    subtitle: 'حالة التوثيق وإعدادات الأمان',
    route: '/profile/edit',
  },
  {
    icon: 'lock-outline',
    label: 'تغيير كلمة المرور والبريد',
    subtitle: 'تحديث بيانات الدخول',
    route: '/auth/forgot-password',
  },
];

export default function AccountSettingsScreen() {
  return (
    <SettingsMenuScreen
      title="الحساب"
      description="حدّث بيانات الدخول وراجع خيارات حماية حسابك."
      heroIcon="shield-check-outline"
      items={ITEMS}
    />
  );
}
