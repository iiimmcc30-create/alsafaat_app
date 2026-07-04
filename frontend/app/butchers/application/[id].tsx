// SAFAT — Butcher Application Detail (تفاصيل الطلب — قراءة فقط)

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/butcherApplication/EmptyState';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { StatusBadge } from '@/components/butcherApplication/StatusBadge';
import { TimelineItem } from '@/components/butcherApplication/TimelineItem';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useButcherApplication } from '@/hooks/useButcherApplication';
import {
  applicationDisplayName,
  countryLabel,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  formatApplicationDate,
  formatApplicationDateTime,
} from '@/lib/butcherApplicationLabels';
import { rtlBackIcon } from '@/lib/rtl';
import type { ApplicationDetail } from '@/services/butcherApplicationTypes';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={d.row}>
      <Text style={d.label}>{label}</Text>
      <Text style={d.value}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={d.section}>
      <Text style={d.sectionTitle}>{title}</Text>
      <View style={d.sectionBody}>{children}</View>
    </View>
  );
}

export default function ButcherApplicationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { get, loading, error } = useButcherApplication();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const applicationId = typeof id === 'string' ? id : id?.[0];

  const load = useCallback(async () => {
    if (!applicationId) return;
    const detail = await get(applicationId);
    setApplication(detail);
  }, [applicationId, get]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/phone');
      return;
    }
    if (!applicationId) return;
    (async () => {
      try {
        await load();
      } catch {
        // hook.error
      } finally {
        setInitialLoad(false);
      }
    })();
  }, [authLoading, isAuthenticated, applicationId, router, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch {
      // hook.error
    } finally {
      setRefreshing(false);
    }
  };

  const comments = useMemo(() => {
    if (!application) return [];
    const items: { id: string; text: string; at: string; actor: string }[] = [];
    if (application.rejectionReason) {
      items.push({
        id: 'rejection-reason',
        text: application.rejectionReason,
        at: application.rejectedAt ?? application.updatedAt,
        actor: 'الإدارة',
      });
    }
    for (const event of application.timeline) {
      if (event.action === 'COMMENT' && event.comment) {
        items.push({
          id: event.id,
          text: event.comment,
          at: event.createdAt,
          actor: event.actorUsername,
        });
      }
    }
    return items;
  }, [application]);

  if (authLoading || initialLoad) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState message="جاري تحميل الطلب..." />
      </SafeAreaView>
    );
  }

  if (!applicationId) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <EmptyState
          title="طلب غير موجود"
          description="معرّف الطلب غير صالح."
          actionLabel="العودة"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (!application && !loading) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <EmptyState
          title="تعذّر تحميل الطلب"
          description={error ?? 'حاول مرة أخرى لاحقاً.'}
          actionLabel="إعادة المحاولة"
          onAction={load}
          icon="alert-circle-outline"
        />
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState />
      </SafeAreaView>
    );
  }

  const title = applicationDisplayName(application.nameAr, application.nameEn);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          طلب #{application.applicationNumber}
        </Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.glow} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Text style={s.title}>{title}</Text>
          <StatusBadge status={application.status} />
          <Text style={s.meta}>
            أُنشئ {formatApplicationDate(application.createdAt)}
            {application.submittedAt
              ? ` · قُدّم ${formatApplicationDate(application.submittedAt)}`
              : ''}
          </Text>
        </View>

        {application.status === 'APPROVED' && application.provisionedButcherId ? (
          <View style={s.provisionCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View style={s.provisionText}>
              <Text style={s.provisionTitle}>تم تفعيل ملحمتك</Text>
              <Text style={s.provisionSub}>يمكنك زيارة صفحة الملحمة من الزر أدناه.</Text>
            </View>
            <PrimaryButton
              title="زيارة الملحمة"
              small
              variant="gold"
              onPress={() =>
                router.push({
                  pathname: '/butchers/[id]',
                  params: { id: application.provisionedButcherId! },
                })
              }
            />
          </View>
        ) : null}

        <Section title="البيانات الأساسية">
          <DetailRow label="الاسم بالعربية" value={application.nameAr ?? '—'} />
          <DetailRow label="الاسم بالإنجليزية" value={application.nameEn ?? '—'} />
          <DetailRow label="هاتف المحل" value={application.shopPhone ?? '—'} />
          <DetailRow label="السجل التجاري" value={application.commercialReg ?? '—'} />
        </Section>

        <Section title="الموقع">
          <DetailRow label="الدولة" value={countryLabel(application.country)} />
          <DetailRow label="المدينة" value={application.city ?? '—'} />
          <DetailRow label="المدينة (عربي)" value={application.cityAr ?? '—'} />
          <DetailRow label="العنوان" value={application.address ?? '—'} />
          <DetailRow label="العنوان (عربي)" value={application.addressAr ?? '—'} />
          <DetailRow
            label="الإحداثيات"
            value={
              application.lat != null && application.lng != null
                ? `${application.lat.toFixed(5)}, ${application.lng.toFixed(5)}`
                : '—'
            }
          />
        </Section>

        <Section title="ساعات العمل">
          <DetailRow label="وقت الفتح" value={application.openTime || '—'} />
          <DetailRow label="وقت الإغلاق" value={application.closeTime || '—'} />
        </Section>

        {(application.bioAr || application.bioEn || application.specialties.length > 0) && (
          <Section title="نبذة وتخصصات">
            {application.bioAr ? <DetailRow label="نبذة عربية" value={application.bioAr} /> : null}
            {application.bioEn ? <DetailRow label="نبذة إنجليزية" value={application.bioEn} /> : null}
            {application.specialties.length > 0 ? (
              <DetailRow label="التخصصات" value={application.specialties.join(' · ')} />
            ) : null}
          </Section>
        )}

        <Section title="المستندات">
          {application.documents.length === 0 ? (
            <Text style={d.empty}>لا توجد مستندات مرفوعة بعد.</Text>
          ) : (
            application.documents.map((doc) => (
              <View key={doc.id} style={d.docRow}>
                <View style={d.docMain}>
                  <Text style={d.docTitle}>{DOCUMENT_TYPE_LABELS[doc.type]}</Text>
                  <Text style={d.docSub}>
                    {doc.originalFileName ?? '—'}
                    {doc.fileSizeBytes
                      ? ` · ${(doc.fileSizeBytes / 1024).toFixed(0)} ك.ب`
                      : ''}
                  </Text>
                  {doc.notes ? <Text style={d.docNotes}>{doc.notes}</Text> : null}
                </View>
                <View style={d.docBadge}>
                  <Text style={d.docBadgeText}>{DOCUMENT_STATUS_LABELS[doc.status]}</Text>
                </View>
              </View>
            ))
          )}
        </Section>

        {comments.length > 0 ? (
          <Section title="التعليقات">
            {comments.map((c) => (
              <View key={c.id} style={d.commentRow}>
                <Text style={d.commentText}>{c.text}</Text>
                <Text style={d.commentMeta}>
                  {c.actor} · {formatApplicationDateTime(c.at)}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="السجل الزمني">
          {application.timeline.length === 0 ? (
            <Text style={d.empty}>لا توجد أحداث بعد.</Text>
          ) : (
            application.timeline.map((event, index) => (
              <TimelineItem
                key={event.id}
                event={event}
                isLast={index === application.timeline.length - 1}
              />
            ))
          )}
        </Section>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {application.status === 'DRAFT' ? (
          <PrimaryButton
            title="متابعة التعديل"
            onPress={() =>
              router.push({
                pathname: '/butchers/application/edit/[id]',
                params: { id: application.id },
              })
            }
            style={s.footerBtn}
          />
        ) : null}

        <PrimaryButton
          title="العودة لطلباتي"
          variant="outline"
          onPress={() => router.push('/butchers/my-application')}
          style={s.footerBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  provisionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    padding: spacing.lg,
  },
  provisionText: {
    flex: 1,
    gap: spacing.xs,
  },
  provisionTitle: {
    ...typography.bodyStrong,
    color: colors.textBrandSuccess,
  },
  provisionSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footerBtn: {
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});

const d = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  docMain: {
    flex: 1,
    gap: spacing.xs,
  },
  docTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  docSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  docNotes: {
    ...typography.caption,
    color: colors.amber,
  },
  docBadge: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  docBadgeText: {
    ...typography.micro,
    color: colors.textBrand,
    fontWeight: '600',
  },
  commentRow: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  commentText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  commentMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
