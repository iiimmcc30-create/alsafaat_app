// SAFAT — My Butcher Application (طلبي)

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApplicationCard } from '@/components/butcherApplication/ApplicationCard';
import { EmptyState } from '@/components/butcherApplication/EmptyState';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { StatusBadge } from '@/components/butcherApplication/StatusBadge';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { gradients, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useButcherApplication } from '@/hooks/useButcherApplication';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  applicationDisplayName,
  formatApplicationDate,
} from '@/lib/butcherApplicationLabels';
import { rtlBackIcon } from '@/lib/rtl';
import type { ApplicationSummary } from '@/services/butcherApplicationTypes';

function pickCurrentApplication(apps: ApplicationSummary[]): ApplicationSummary | null {
  if (apps.length === 0) return null;
  const priority: ApplicationSummary['status'][] = [
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN',
  ];
  for (const status of priority) {
    const found = apps.find((a) => a.status === status);
    if (found) return found;
  }
  return apps[0];
}

export default function MyButcherApplicationScreen() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const actionStyles = useThemedStyles(() => createActionStyles());
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { list, withdraw, loading, error } = useButcherApplication();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [showWithdrawInput, setShowWithdrawInput] = useState(false);

  const current = useMemo(() => pickCurrentApplication(applications), [applications]);

  const fetchApplications = useCallback(async () => {
    const result = await list({ limit: 20 });
    setApplications(result.applications);
  }, [list]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/phone');
      return;
    }
    (async () => {
      try {
        await fetchApplications();
      } catch {
        // hook.error
      } finally {
        setInitialLoad(false);
      }
    })();
  }, [authLoading, isAuthenticated, router, fetchApplications]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchApplications();
    } catch {
      // hook.error
    } finally {
      setRefreshing(false);
    }
  };

  const openDetails = (id: string) => {
    router.push({ pathname: '/butchers/application/[id]', params: { id } });
  };

  const openEdit = (id: string) => {
    router.push({ pathname: '/butchers/application/edit/[id]', params: { id } });
  };

  const confirmWithdraw = () => {
    if (!current) return;
    Alert.alert('سحب الطلب', 'هل أنت متأكد من سحب طلب التسجيل؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'سحب الطلب',
        style: 'destructive',
        onPress: async () => {
          try {
            await withdraw(current.id, withdrawReason.trim() ? { reason: withdrawReason.trim() } : {});
            setWithdrawReason('');
            setShowWithdrawInput(false);
            await fetchApplications();
          } catch {
            // hook.error
          }
        },
      },
    ]);
  };

  const renderActions = () => {
    if (!current) return null;

    switch (current.status) {
      case 'DRAFT':
        return (
          <>
            <PrimaryButton
              title="متابعة إكمال الطلب"
              onPress={() => openEdit(current.id)}
              style={actionStyles.btn}
            />
            <PrimaryButton
              title="عرض التفاصيل"
              variant="outline"
              onPress={() => openDetails(current.id)}
              style={actionStyles.btn}
            />
          </>
        );
      case 'SUBMITTED':
        return (
          <>
            <PrimaryButton
              title="عرض التفاصيل"
              onPress={() => openDetails(current.id)}
              style={actionStyles.btn}
            />
            {showWithdrawInput ? (
              <AppTextInput
                label="سبب السحب (اختياري)"
                value={withdrawReason}
                onChangeText={setWithdrawReason}
                placeholder="اذكر سبب السحب إن رغبت"
                multiline
                maxLength={500}
                containerStyle={actionStyles.input}
              />
            ) : null}
            <PrimaryButton
              title={showWithdrawInput ? 'تأكيد سحب الطلب' : 'سحب الطلب'}
              variant="ghost"
              onPress={showWithdrawInput ? confirmWithdraw : () => setShowWithdrawInput(true)}
              style={actionStyles.btn}
              disabled={loading}
            />
          </>
        );
      case 'APPROVED':
        return (
          <>
            <PrimaryButton
              title="عرض التفاصيل"
              onPress={() => openDetails(current.id)}
              style={actionStyles.btn}
            />
            {current.provisionedButcherId ? (
              <PrimaryButton
                title="زيارة الملحمة"
                variant="gold"
                onPress={() =>
                  router.push({
                    pathname: '/butchers/[id]',
                    params: { id: current.provisionedButcherId! },
                  })
                }
                style={actionStyles.btn}
              />
            ) : null}
          </>
        );
      case 'REJECTED':
      case 'WITHDRAWN':
        return (
          <>
            <PrimaryButton
              title="عرض التفاصيل"
              onPress={() => openDetails(current.id)}
              style={actionStyles.btn}
            />
            <PrimaryButton
              title="تقديم طلب جديد"
              onPress={() => router.push('/butchers/apply')}
              style={actionStyles.btn}
            />
          </>
        );
      default:
        return null;
    }
  };

  if (authLoading || initialLoad) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>طلب تسجيل الملحمة</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.glow} />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!current ? (
          <EmptyState
            title="لا يوجد طلب حالياً"
            description="لم تقدّم طلب تسجيل ملحمة بعد. ابدأ الآن لإنشاء مسودة طلبك."
            actionLabel="ابدأ طلب التسجيل"
            onAction={() => router.push('/butchers/apply')}
            icon="storefront-outline"
          />
        ) : (
          <>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>
                {applicationDisplayName(current.nameAr, current.nameEn)}
              </Text>
              <StatusBadge status={current.status} />
            </View>

            <View style={styles.datesCard}>
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>تاريخ الإنشاء</Text>
                <Text style={styles.dateValue}>{formatApplicationDate(current.createdAt)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>تاريخ التقديم</Text>
                <Text style={styles.dateValue}>{formatApplicationDate(current.submittedAt)}</Text>
              </View>
            </View>

            <ApplicationCard application={current} onPress={() => openDetails(current.id)} />

            <View style={styles.actions}>{renderActions()}</View>

            {applications.length > 1 ? (
              <View style={styles.history}>
                <Text style={styles.historyTitle}>سجل الطلبات</Text>
                {applications
                  .filter((a) => a.id !== current.id)
                  .map((app) => (
                    <ApplicationCard
                      key={app.id}
                      application={app}
                      onPress={() => openDetails(app.id)}
                    />
                  ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
    flexGrow: 1,
    gap: spacing.lg,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderRadius: 12,
    padding: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  summaryHeader: {
    gap: spacing.md,
  },
  summaryTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  datesCard: {
    backgroundColor: colors.bgGlass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dateValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderHairline,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  history: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  historyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  });
}

function createActionStyles() {
  return StyleSheet.create({
    btn: { width: '100%' },
    input: { marginBottom: spacing.sm },
  });
}
