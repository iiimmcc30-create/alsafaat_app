import { ProfileSettingsMenuScreen } from '@/components/feature/ProfileSettingsMenuScreen';
import { useAuth } from '@/contexts/AuthContext';
import { confirmDestructive, presentActionSheet } from '@/lib/actionSheet';
import { useRouter } from 'expo-router';

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

  const openReportsTicket = async () => {
    const key = await presentActionSheet({
      title: 'البلاغات',
      message: 'اختر نوع التذكرة',
      items: [
        { key: 'support', label: 'تواصل مع الدعم' },
        { key: 'report', label: 'إبلاغ عن محتوى مخالف' },
      ],
    });
    if (key === 'support') {
      router.push('/info/contact' as any);
    } else if (key === 'report') {
      router.push('/info/contact' as any);
    }
  };

  return (
    <ProfileSettingsMenuScreen
      title="الإعدادات"
      onLogout={() => void handleLogout()}
      sections={[
        {
          title: 'الحساب',
          items: [
            {
              key: 'profile',
              icon: 'person-outline',
              label: 'إدارة الملف',
              route: '/profile/edit',
            },
            {
              key: 'password',
              icon: 'lock-outline',
              label: 'تغيير كلمة المرور',
              route: '/profile/settings/password',
            },
            {
              key: 'privacy',
              icon: 'shield-outline',
              label: 'الخصوصية',
              route: '/info/privacy',
            },
          ],
        },
        {
          title: 'مركز المعلومات',
          items: [
            {
              key: 'about',
              icon: 'information-outline',
              label: 'من نحن',
              route: '/info/about',
            },
            {
              key: 'terms',
              icon: 'document-text-outline',
              label: 'الشروط والأحكام',
              route: '/info/terms',
            },
            {
              key: 'usage',
              icon: 'shield-check',
              label: 'سياسة الاستخدام',
              route: '/info/terms',
            },
            {
              key: 'privacy-policy',
              icon: 'shield-outline',
              label: 'سياسة الخصوصية',
              route: '/info/privacy',
            },
            {
              key: 'refund',
              icon: 'refresh',
              label: 'سياسة الاسترداد',
              route: '/info/refund',
            },
          ],
        },
        {
          title: 'المساعدة والدعم',
          items: [
            {
              key: 'contact',
              icon: 'headset',
              label: 'تواصل معنا',
              route: '/info/contact',
            },
            {
              key: 'reports',
              icon: 'ticket',
              label: 'البلاغات (إنشاء تذكرة)',
              onPress: () => void openReportsTicket(),
            },
          ],
        },
      ]}
    />
  );
}
