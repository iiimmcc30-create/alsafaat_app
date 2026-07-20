import { SettingsMenuScreen, type SettingsMenuItem } from '@/components/ui/SettingsMenuScreen';
import { useAuth } from '@/contexts/AuthContext';
import { confirmDestructive } from '@/lib/actionSheet';
import { useRouter } from 'expo-router';

const ITEMS: SettingsMenuItem[] = [
  {
    icon: 'person-outline',
    label: 'إدارة الملف الشخصي',
    subtitle: 'الصورة، الاسم، والنبذة',
    route: '/profile/edit',
  },
  {
    icon: 'lock-outline',
    label: 'تغيير كلمة المرور',
    subtitle: 'تحديث بيانات الدخول بأمان',
    route: '/profile/settings/password',
  },
  {
    icon: 'person-circle-outline',
    label: 'تعديل المعلومات الشخصية',
    subtitle: 'الاسم، الموقع، وبيانات التواصل',
    route: '/profile/edit',
  },
  {
    icon: 'bell-outline',
    label: 'الإشعارات',
    subtitle: 'مركز الإشعارات وتفضيلات التنبيه',
    route: '/notifications',
  },
  {
    icon: 'shield-outline',
    label: 'الخصوصية',
    subtitle: 'من يرى ملفك وكيف تُستخدم بياناتك',
    route: '/info/privacy',
  },
  {
    icon: 'shield-check-outline',
    label: 'الأمان',
    subtitle: 'حماية الحساب والجلسات النشطة',
    route: '/profile/settings/password',
  },
  {
    icon: 'lifebuoy',
    label: 'المساعدة والدعم',
    subtitle: 'تواصل معنا والإبلاغ عن مشكلة',
    route: '/info/contact',
  },
  {
    icon: 'information-outline',
    label: 'مركز المعلومات',
    subtitle: 'من نحن، الشروط، وسياسة الخصوصية',
    route: '/settings/info',
  },
];

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    const confirmed = await confirmDestructive(
      'تسجيل الخروج',
      'هل أنت متأكد أنك تريد الخروج من حسابك؟',
      'تسجيل الخروج',
    );
    if (!confirmed) return;
    await signOut();
    router.replace('/auth/phone' as any);
  };

  return (
    <SettingsMenuScreen
      title="إعدادات الحساب"
      description="إدارة ملفك الشخصي، الأمان، الخصوصية، والدعم من مكان واحد."
      heroIcon="settings-outline"
      items={[
        ...ITEMS,
        {
          icon: 'log-out-outline',
          label: 'تسجيل الخروج',
          subtitle: 'الخروج من حسابك على هذا الجهاز',
          route: '__logout__',
        },
      ]}
      onItemPress={(item) => {
        if (item.route === '__logout__') {
          void handleLogout();
          return true;
        }
        return false;
      }}
    />
  );
}
