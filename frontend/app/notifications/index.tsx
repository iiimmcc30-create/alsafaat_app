// SAFAT — Notification Center (مركز الإشعارات)

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/butcherApplication/EmptyState';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { NotificationCard } from '@/components/notifications/NotificationCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationsList } from '@/hooks/useNotificationsList';
import { handleNotificationNavigation } from '@/lib/notifications';
import { rtlBackIcon } from '@/lib/rtl';
import type { AppNotification } from '@/services/notifications';

export default function NotificationsScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    refreshing,
    error,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    retry,
  } = useNotificationsList();

  const handlePress = async (notification: AppNotification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    handleNotificationNavigation(
      { type: notification.type, data: notification.data },
      {
        router,
        isAdmin: user?.role === 'ADMIN',
      },
      { stayOnUnknown: true },
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.glow} />
      </View>
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState message="جاري تحميل الإشعارات..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>الإشعارات</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '٩٩+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={unreadCount > 0 ? markAllAsRead : undefined}
          hitSlop={12}
          style={styles.iconBtn}
          disabled={unreadCount === 0}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={22}
            color={unreadCount > 0 ? colors.glow : colors.textSubtle}
          />
        </Pressable>
      </View>

      {unreadCount > 0 ? (
        <View style={styles.markAllRow}>
          <PrimaryButton
            title="تعليم الكل كمقروء"
            variant="outline"
            small
            onPress={markAllAsRead}
            style={styles.markAllBtn}
          />
        </View>
      ) : null}

      {error && notifications.length === 0 ? (
        <View style={styles.errorWrap}>
          <EmptyState
            title="تعذّر تحميل الإشعارات"
            description={error}
            actionLabel="إعادة المحاولة"
            onAction={retry}
            icon="alert-circle-outline"
          />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard notification={item} onPress={() => handlePress(item)} />
          )}
          contentContainerStyle={[
            styles.list,
            notifications.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.glow} />
          }
          onEndReached={() => loadMore()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <EmptyState
              title="لا توجد إشعارات"
              description="ستظهر هنا إشعارات نشاطك وطلباتك."
              icon="notifications-outline"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {error && notifications.length > 0 ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typography.micro,
    color: '#fff',
    fontWeight: '800',
  },
  markAllRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  markAllBtn: {
    alignSelf: 'flex-start',
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  listEmpty: {
    flexGrow: 1,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  errorWrap: {
    flex: 1,
  },
  inlineError: {
    padding: spacing.md,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 12,
  },
  inlineErrorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  });
}
