// SAFAT — Butcher Application Entry (بوابة تسجيل الملحمة)

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { gradients, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useButcherApplication } from '@/hooks/useButcherApplication';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';
import type { ApplicationSummary } from '@/services/butcherApplicationTypes';

function findActiveDraftOrSubmitted(apps: ApplicationSummary[]): ApplicationSummary | null {
  return (
    apps.find((a) => a.status === 'DRAFT' || a.status === 'SUBMITTED') ?? null
  );
}

function findApproved(apps: ApplicationSummary[]): ApplicationSummary | null {
  return apps.find((a) => a.status === 'APPROVED') ?? null;
}

export default function ButcherApplyScreen() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { list, createDraft, loading, error } = useButcherApplication();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [canStartNew, setCanStartNew] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/phone');
    }
  }, [authLoading, isAuthenticated, router]);

  const bootstrap = useCallback(async () => {
    if (!isAuthenticated) return;
    setBootstrapping(true);
    try {
      const result = await list({ limit: 10 });
      const apps = result.applications;

      const approved = findApproved(apps);
      if (approved) {
        if (approved.provisionedButcherId) {
          router.replace({
            pathname: '/butchers/[id]',
            params: { id: approved.provisionedButcherId },
          });
        } else {
          router.replace({
            pathname: '/butchers/application/[id]',
            params: { id: approved.id },
          });
        }
        return;
      }

      const active = findActiveDraftOrSubmitted(apps);
      if (active) {
        if (active.status === 'DRAFT') {
          router.replace({
            pathname: '/butchers/application/edit/[id]',
            params: { id: active.id },
          });
        } else {
          router.replace({
            pathname: '/butchers/application/[id]',
            params: { id: active.id },
          });
        }
        return;
      }

      // REJECTED / WITHDRAWN — allow creating a new application
      setCanStartNew(true);
    } catch {
      // Entry screen still shown; hook.error surfaces below.
      setCanStartNew(true);
    } finally {
      setBootstrapping(false);
    }
  }, [isAuthenticated, list, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    bootstrap();
  }, [authLoading, isAuthenticated, bootstrap]);

  const handleStart = async () => {
    try {
      const draft = await createDraft();
      router.replace({
        pathname: '/butchers/application/edit/[id]',
        params: { id: draft.id },
      });
    } catch {
      // error state handled by hook
    }
  };

  if (authLoading || bootstrapping) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState message="جاري التحقق من طلباتك..." />
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
        <Text style={styles.headerTitle}>تسجيل ملحمة</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroIcon}>
          <LinearGradient colors={gradients.electric} style={styles.heroIconInner}>
            <Ionicons name="storefront" size={40} color="#fff" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>انضم كجزار في صفاة</Text>
        <Text style={styles.subtitle}>
          قدّم طلب تسجيل ملحمتك عبر نظام الطلبات الجديد. سنراجع بياناتك ومستنداتك ثم نفعّل حسابك
          كجزار بعد الموافقة.
        </Text>

        <View style={styles.stepsCard}>
          {[
            { n: '١', t: 'إنشاء مسودة الطلب' },
            { n: '٢', t: 'إكمال البيانات والمستندات' },
            { n: '٣', t: 'مراجعة الإدارة والموافقة' },
          ].map((step) => (
            <View key={step.n} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{step.n}</Text>
              </View>
              <Text style={styles.stepText}>{step.t}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {canStartNew ? (
          <PrimaryButton
            title="ابدأ طلب التسجيل"
            onPress={handleStart}
            disabled={loading}
            style={styles.cta}
          />
        ) : null}

        <Pressable onPress={() => router.push('/butchers/my-application')} style={styles.linkBtn}>
          <Text style={styles.linkText}>عرض طلباتي السابقة</Text>
        </Pressable>
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
    padding: spacing.xl,
    paddingBottom: spacing.huge,
    alignItems: 'center',
  },
  heroIcon: {
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  heroIconInner: {
    width: 88,
    height: 88,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxl,
  },
  stepsCard: {
    width: '100%',
    backgroundColor: colors.bgGlass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    ...typography.caption,
    color: colors.textBrand,
    fontWeight: '800',
  },
  stepText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  cta: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  linkBtn: {
    padding: spacing.md,
  },
  linkText: {
    ...typography.bodyStrong,
    color: colors.textBrand,
    textAlign: 'center',
  },
  });
}
