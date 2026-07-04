// Powered by OnSpace.AI
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scrimColor, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlDirection, rtlForwardIcon, rtlRow } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { ButchersSidebarEntry } from '@/components/feature/ButchersSidebarEntry';

type MenuItem = {
  key: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap | keyof typeof Ionicons.glyphMap;
  iconSet?: 'material' | 'ion';
  label: string;
  subtitle?: string;
  route?: string;
  onPress?: () => void;
  danger?: boolean;
  accent?: string;
};

function SidebarMenuRow({
  item,
  colors,
  onPress,
  showDivider,
}: {
  item: MenuItem;
  colors: ThemeColors;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const iconColor = item.danger ? colors.rose : (item.accent ?? colors.glow);
  const IconComponent = item.iconSet === 'ion' ? Ionicons : MaterialCommunityIcons;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.row,
        showDivider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderHairline },
        pressed && { opacity: 0.72 },
      ]}
    >
      <View style={rowStyles.leading}>
        <IconComponent name={item.icon as any} size={22} color={iconColor} />
        <View style={rowStyles.textWrap}>
          <Text style={[rowStyles.label, { color: item.danger ? colors.rose : colors.textPrimary }]}>
            {item.label}
          </Text>
          {item.subtitle ? (
            <Text style={[rowStyles.subtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
          ) : null}
        </View>
      </View>
      {!item.danger ? (
        <Ionicons name={rtlForwardIcon} size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    ...rtlRow,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  leading: {
    ...rtlRow,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
    minWidth: 0,
  },
  textWrap: {
    flexShrink: 1,
    gap: 2,
  },
  label: { ...typography.bodyStrong },
  subtitle: { ...typography.caption },
});

export default function SidebarScreen() {
  const router = useRouter();
  const { me } = useApp();
  const { signOut } = useAuth();
  const { preference, setPreference, scheme, colors } = useTheme();
  const styles = useThemedStyles((theme) => createSidebarStyles(theme.colors, theme.scheme));

  const handleNav = (route: string) => {
    router.back();
    setTimeout(() => router.push(route as any), 120);
  };

  const handleSignOut = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد أنك تريد الخروج من حسابك؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'خروج',
          style: 'destructive',
          onPress: async () => {
            router.back();
            await signOut();
            setTimeout(() => router.replace('/auth/phone' as any), 300);
          },
        },
      ]
    );
  };

  const themeLabel =
    preference === 'light' ? 'الوضع الفاتح' : preference === 'dark' ? 'الوضع الداكن' : 'حسب النظام';
  const themeSubtitle =
    preference === 'light' ? 'مفعّل' : preference === 'dark' ? 'مفعّل' : 'يتبع إعدادات الجهاز';

  const cycleTheme = () => {
    const next = preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light';
    setPreference(next);
  };

  const accountItems: MenuItem[] = [
    { key: 'settings', icon: 'cog-outline', label: 'الإعدادات والخصوصية', route: '/info/privacy' },
    { key: 'verify', icon: 'shield-account-outline', label: 'التحقق من الحساب', route: '/profile/edit' },
    { key: 'notifications', icon: 'bell-outline', label: 'مركز الإشعارات', route: '/notifications' },
    { key: 'subscription', icon: 'crown-outline', label: 'الاشتراك والرسوم', route: '/subscription' },
  ];

  const helpItems: MenuItem[] = [
    { key: 'about', icon: 'information-outline', label: 'من نحن', route: '/info/about' },
    { key: 'terms', icon: 'file-document-outline', label: 'الشروط والأحكام', route: '/info/terms' },
    { key: 'privacy', icon: 'lock-outline', label: 'سياسة الخصوصية', route: '/info/privacy' },
    { key: 'contact', icon: 'email-outline', label: 'تواصل معنا', route: '/info/contact' },
  ];

  const renderItem = (item: MenuItem, showDivider = true) => (
    <SidebarMenuRow
      key={item.key}
      item={item}
      colors={colors}
      showDivider={showDivider}
      onPress={() => {
        if (item.onPress) item.onPress();
        else if (item.route) handleNav(item.route);
      }}
    />
  );

  return (
    <View style={[styles.backdrop, rtlRow]}>
      <SafeAreaView style={styles.panel} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, rtlDirection]}
        >
          {/* Profile */}
          <Pressable
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/(tabs)/profile'), 100);
            }}
            style={({ pressed }) => [styles.profileRow, pressed && { opacity: 0.75 }]}
          >
            <View style={styles.profileLeading}>
              <Image source={{ uri: me.avatar }} style={styles.avatar} contentFit="cover" />
              <View style={styles.profileText}>
                <Text style={styles.profileName}>{me.arabicName}</Text>
                <Text style={styles.profileHandle}>@{me.username}</Text>
              </View>
            </View>
            <Ionicons name={rtlForwardIcon} size={18} color={colors.textMuted} />
          </Pressable>

          <View style={styles.divider} />

          {/* Butchers section */}
          <ButchersSidebarEntry />

          {/* Account */}
          {accountItems.map((item, idx) => renderItem(item, idx < accountItems.length - 1))}
          <View style={styles.divider} />

          {/* Help */}
          {helpItems.map((item, idx) => renderItem(item, idx < helpItems.length - 1))}
          <View style={styles.divider} />

          {/* Theme toggle */}
          {renderItem({
            key: 'theme',
            icon: preference === 'dark' ? 'weather-night' : preference === 'light' ? 'white-balance-sunny' : 'theme-light-dark',
            label: themeLabel,
            subtitle: themeSubtitle,
            onPress: cycleTheme,
          })}

          {/* Logout */}
          <SidebarMenuRow
            item={{
              key: 'logout',
              icon: 'log-out-outline',
              iconSet: 'ion',
              label: 'تسجيل الخروج',
              danger: true,
            }}
            colors={colors}
            onPress={handleSignOut}
          />

          <Text style={styles.versionText}>الصفاة · الإصدار ١.٠.٠</Text>
        </ScrollView>
      </SafeAreaView>

      <Pressable style={styles.backdropTap} onPress={() => router.back()} />
    </View>
  );
}

function createSidebarStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  const panelBg = scheme === 'dark' ? colors.bgElevated : colors.bgSurface;

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: scrimColor(scheme, 0.5),
    },
    backdropTap: {
      flex: 1,
    },
    panel: {
      width: '88%',
      maxWidth: 360,
      alignSelf: 'stretch',
      backgroundColor: panelBg,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.borderMid,
      shadowColor: '#000',
      shadowOffset: { width: scheme === 'dark' ? -4 : -2, height: 0 },
      shadowOpacity: scheme === 'dark' ? 0.35 : 0.12,
      shadowRadius: 12,
      elevation: 8,
    },
    scroll: {
      flex: 1,
      ...rtlDirection,
    },
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    profileRow: {
      ...rtlRow,
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
    },
    profileLeading: {
      ...rtlRow,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: spacing.sm,
      minWidth: 0,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderColor: colors.electric,
    },
    profileText: { flexShrink: 1, gap: 2 },
    profileName: { ...typography.bodyStrong, color: colors.textPrimary },
    profileHandle: { ...typography.caption, color: colors.textMuted },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderHairline,
      marginHorizontal: spacing.xl,
    },
    versionText: {
      ...typography.micro,
      color: colors.textSubtle,
      textAlign: 'center',
      marginTop: spacing.xl,
      paddingHorizontal: spacing.xl,
    },
  });
}
