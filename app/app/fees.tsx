// Powered by OnSpace.AI
// SAFAT — سداد الرسوم والاشتراكات
// Fees & Subscriptions Payment Hub
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon, rtlForwardIcon } from '@/lib/rtl';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useApp } from '@/hooks/useApp';
import {
  PendingFee,
  getFeesSummary,
  formatDueDate,
  ListingCategory,
} from '@/services/commissions';
import { PAYMENT_METHODS, NIPaymentMethod } from '@/services/network_international';
import { formatPlanFeatureText, planDisplayName, planGradientColors, planIcon } from '@/services/subscriptionPlans';

type PageTab = 'fees' | 'subscription' | 'history' | 'rules';

const TAB_LABELS: Record<PageTab, { ar: string; icon: string }> = {
  fees: { ar: 'رسوم الإعلانات', icon: 'receipt-outline' },
  subscription: { ar: 'الاشتراك', icon: 'star-outline' },
  history: { ar: 'السجل', icon: 'time-outline' },
  rules: { ar: 'جدول الرسوم', icon: 'document-text-outline' },
};

type CommissionRuleRow = {
  icon: string;
  nameAr: string;
  nameEn: string;
  ruleAr: string;
  ruleEn: string;
  color: string;
};

export default function FeesScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { subscription } = useSubscription();
  const { me } = useApp();
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<PageTab>('fees');
  const [fees, setFees] = useState<PendingFee[]>([]);
  const [selectedFees, setSelectedFees] = useState<Set<string>>(new Set());
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<NIPaymentMethod>('mada');
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commissionRules, setCommissionRules] = useState<CommissionRuleRow[]>([]);

  const fetchFees = async () => {
    try {
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const res = await fetch(`${API_BASE}/api/fees`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.fees) {
          const mapped = json.data.fees.map((f: any) => ({
            id: f.id,
            listingId: f.listingId,
            listingTitleAr: f.listing?.arabicTitle || 'إعلان غير معروف',
            category: f.listing?.category || 'store',
            icon: f.listing?.category === 'sheep' ? '🐑' : f.listing?.category === 'camels' ? '🐪' : f.listing?.category === 'horses' ? '🐎' : f.listing?.category === 'goats' ? '🐐' : '🏪',
            quantity: 1,
            price: f.price || 0,
            commission: f.commission,
            status: f.status,
            dueDate: f.dueDate || f.createdAt,
            paidAt: f.paidAt,
            transactionId: f.transactionId,
          }));
          setFees(mapped);
        }
      }
    } catch (err) {
      console.warn('[FeesScreen] Failed to fetch fees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchFees();
    }
    fetch(`${API_BASE}/api/fees/rules`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.rules) {
          setCommissionRules(json.data.rules);
        }
      })
      .catch(() => {});
  }, [accessToken]);

  const summary = getFeesSummary(fees);
  const pendingFees = fees.filter((f) => f.status === 'pending' || f.status === 'overdue');
  const paidFees = fees.filter((f) => f.status === 'paid');
  const totalSelected = fees
    .filter((f) => selectedFees.has(f.id))
    .reduce((s, f) => s + f.commission, 0);

  const toggleSelect = (id: string) => {
    setSelectedFees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFees(new Set(pendingFees.map((f) => f.id)));
  };

  const handlePaySelected = () => {
    if (selectedFees.size === 0) return;
    setShowPayModal(true);
  };

  const handlePaySingle = (feeId: string) => {
    setSelectedFees(new Set([feeId]));
    setShowPayModal(true);
  };

  const handleConfirmPayment = async () => {
    if (selectedFees.size === 0) return;
    setProcessing(true);
    
    const selectedFeeId = Array.from(selectedFees)[0];
    const targetFee = fees.find(f => f.id === selectedFeeId);
    if (!targetFee) {
      setProcessing(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: targetFee.commission,
          currency: 'SAR',
          method: selectedMethod,
          type: 'listing_fee',
          referenceId: targetFee.id,
          description: `Listing fee payment for ${targetFee.listingTitleAr}`,
          descriptionAr: `سداد رسوم الإعلان: ${targetFee.listingTitleAr}`,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data) {
        const { checkoutUrl } = json.data;

        if (checkoutUrl) {
          await Linking.openURL(checkoutUrl);
          setSelectedFees(new Set());
          setShowPayModal(false);
          Alert.alert(
            'أكمل الدفع',
            'تم فتح صفحة الدفع. بعد إتمام الدفع سيتم تحديث حالة الرسوم تلقائياً.',
            [{ text: 'حسناً', onPress: () => fetchFees() }]
          );
        } else {
          Alert.alert('❌ فشل الدفع', 'لم يتم استلام رابط الدفع من الخادم.');
        }
      } else {
        const errMsg = json.messageAr || json.message || 'فشل إنشاء معاملة الدفع';
        Alert.alert('❌ فشل الدفع', errMsg);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('❌ خطأ في الاتصال', 'تعذر الاتصال بالخادم.');
    } finally {
      setProcessing(false);
    }
  };

  const planColors = planGradientColors(subscription.plan?.sortOrder ?? 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>الرسوم والاشتراكات</Text>
          <Text style={styles.headerSub}>سداد الرسوم وإدارة باقتك</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Summary strip */}
      {(summary.totalPending > 0 || summary.totalOverdue > 0) && (
        <View style={styles.alertStrip}>
          <AppIcon name="warning" size={16} color={colors.amber} />
          <Text style={styles.alertText}>
            رسوم معلقة:{' '}
            <Text style={styles.alertAmount}>{summary.totalPending + summary.totalOverdue} ريال</Text>
            {summary.overdueCount > 0 && (
              <Text style={styles.alertOverdue}> · {summary.overdueCount} متأخر</Text>
            )}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {(Object.keys(TAB_LABELS) as PageTab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabChip, activeTab === tab && styles.tabChipActive]}
          >
            <AppIcon
              name={TAB_LABELS[tab].icon}
              size={14}
              color={activeTab === tab ? colors.electricBright : colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {TAB_LABELS[tab].ar}
            </Text>
            {tab === 'fees' && (summary.pendingCount + summary.overdueCount) > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{summary.pendingCount + summary.overdueCount}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ─── TAB: رسوم الإعلانات ─── */}
        {activeTab === 'fees' && (
          <>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderColor: `${colors.amber}40` }]}>
                <Text style={[styles.statAmount, { color: colors.amber }]}>
                  {summary.totalPending + summary.totalOverdue}
                </Text>
                <Text style={styles.statLabel}>معلّق (ريال)</Text>
              </View>
              <View style={[styles.statCard, { borderColor: `${colors.rose}40` }]}>
                <Text style={[styles.statAmount, { color: colors.rose }]}>{summary.totalOverdue}</Text>
                <Text style={styles.statLabel}>متأخر (ريال)</Text>
              </View>
              <View style={[styles.statCard, { borderColor: `${colors.emerald}40` }]}>
                <Text style={[styles.statAmount, { color: colors.textBrandSuccess }]}>{summary.totalPaid}</Text>
                <Text style={styles.statLabel}>مسدّد (ريال)</Text>
              </View>
            </View>

            {/* Select all + pay */}
            {pendingFees.length > 0 && (
              <View style={styles.bulkRow}>
                <Pressable onPress={selectAll} style={styles.selectAllBtn}>
                  <AppIcon name="checkmark-done" size={14} color={colors.electricBright} />
                  <Text style={styles.selectAllText}>تحديد الكل</Text>
                </Pressable>
                {selectedFees.size > 0 && (
                  <Pressable style={styles.paySelectedBtn} onPress={handlePaySelected}>
                    <LinearGradient colors={gradients.royal} style={styles.paySelectedInner}>
                      <AppIcon name="cash-multiple" size={16} color="#fff" />
                      <Text style={styles.paySelectedText}>
                        سداد {selectedFees.size} رسوم · {totalSelected} ريال
                      </Text>
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            )}

            {/* Pending fees list */}
            {pendingFees.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>الرسوم المستحقة</Text>
                {pendingFees.map((fee) => {
                  const due = formatDueDate(fee.dueDate);
                  const isSelected = selectedFees.has(fee.id);
                  return (
                    <Pressable
                      key={fee.id}
                      style={[styles.feeCard, isSelected && styles.feeCardSelected, fee.status === 'overdue' && styles.feeCardOverdue]}
                      onPress={() => toggleSelect(fee.id)}
                    >
                      <View style={styles.feeCheckWrap}>
                        <View style={[styles.feeCheck, isSelected && styles.feeCheckActive]}>
                          {isSelected && <AppIcon name="checkmark" size={12} color="#fff" />}
                        </View>
                      </View>

                      <Text style={styles.feeIcon}>{fee.icon}</Text>

                      <View style={styles.feeInfo}>
                        <Text style={styles.feeTitle} numberOfLines={1}>{fee.listingTitleAr}</Text>
                        <Text style={styles.feeDesc}>
                          {fee.quantity > 1 ? `${fee.quantity} رأس · ` : ''}
                          {fee.price.toLocaleString()} ريال
                        </Text>
                        <View style={[styles.dueBadge, due.isOverdue && styles.dueBadgeOverdue, due.urgent && !due.isOverdue && styles.dueBadgeUrgent]}>
                          <AppIcon
                            name={due.isOverdue ? 'alert-circle' : 'time-outline'}
                            size={10}
                            color={due.isOverdue ? colors.rose : due.urgent ? colors.amber : colors.textMuted}
                          />
                          <Text style={[styles.dueText, due.isOverdue && { color: colors.rose }, due.urgent && !due.isOverdue && { color: colors.amber }]}>
                            {due.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.feeRight}>
                        <Text style={[styles.feeAmount, fee.status === 'overdue' && { color: colors.rose }]}>
                          {fee.commission}
                        </Text>
                        <Text style={styles.feeCurrency}>ريال</Text>
                        <Pressable
                          style={styles.payNowBtn}
                          onPress={() => handlePaySingle(fee.id)}
                        >
                          <Text style={styles.payNowText}>سدّد</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>لا توجد رسوم معلقة</Text>
                <Text style={styles.emptySubtitle}>جميع رسومك مسددة</Text>
              </View>
            )}

            {/* Info box */}
            <View style={styles.infoBox}>
              <AppIcon name="information-circle-outline" size={16} color={colors.glow} />
              <Text style={styles.infoText}>
                تُحسب الرسوم عند نشر الإعلان وتُستحق خلال ١٤ يوم. التأخر يوقف الإعلان مؤقتاً.
              </Text>
            </View>
          </>
        )}

        {/* ─── TAB: الاشتراك ─── */}
        {activeTab === 'subscription' && (
          <>
            {/* Current plan */}
            <LinearGradient colors={planColors} style={styles.currentPlanCard}>
              <View style={styles.planCardTop}>
                <View>
                  <Text style={styles.planCardLabel}>باقتك الحالية</Text>
                  <Text style={styles.planCardName}>
                    {planDisplayName(subscription.planSlug, subscription.plan?.name)}
                  </Text>
                  <Text style={styles.planCardRenew}>
                    التجديد: {new Date(subscription.renewDate).toLocaleDateString('ar-SA')}
                  </Text>
                </View>
                <AppIcon name={planIcon(subscription.planSlug) as never} size={22} color="#fff" />
              </View>

              {/* Usage bars */}
              <View style={styles.usageBars}>
                <View style={styles.usageItem}>
                  <View style={styles.usageTop}>
                    <Text style={styles.usageLabel}>الإعلانات</Text>
                    <Text style={styles.usageVal}>
                      {subscription.usageCounters.dailyAdsUsed}/
                      {(() => {
                        const v = subscription.permissions.maxAdsPer24Hours;
                        if (typeof v === 'number' && v < 0) return '∞';
                        return String(v ?? '—');
                      })()}
                    </Text>
                  </View>
                  <View style={styles.usageTrack}>
                    <View style={[styles.usageFill, {
                      width: (() => {
                        const limit = subscription.permissions.maxAdsPer24Hours;
                        if (typeof limit === 'number' && limit < 0) return '15%';
                        const used = subscription.usageCounters.dailyAdsUsed;
                        const max = typeof limit === 'number' ? limit : 1;
                        return `${Math.min((used / max) * 100, 100)}%`;
                      })()
                    }]} />
                  </View>
                </View>
                <View style={styles.usageItem}>
                  <View style={styles.usageTop}>
                    <Text style={styles.usageLabel}>دقائق البث</Text>
                    <Text style={styles.usageVal}>
                      {subscription.usageCounters.liveMinutesUsed}/
                      {(() => {
                        const hours = subscription.permissions.monthlyLiveHours;
                        if (typeof hours === 'number' && hours < 0) return '∞';
                        return typeof hours === 'number' ? hours * 60 : '—';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.usageTrack}>
                    <View style={[styles.usageFill, { width: '5%' }]} />
                  </View>
                </View>
              </View>

              {(subscription.plan?.displayFeatures ?? []).length > 0 && (
                <View style={styles.planFeaturesWrap}>
                  <Text style={styles.planFeaturesTitle}>مميزات الباقة</Text>
                  {(subscription.plan.displayFeatures ?? []).map((f, i) => {
                    const included =
                      f.valueType === 'BOOLEAN'
                        ? Boolean(f.value)
                        : f.valueType === 'NUMBER'
                          ? Number(f.value) > 0 || Number(f.value) < 0
                          : true;
                    return (
                      <View key={`${f.key}-${i}`} style={styles.planFeatureRow}>
                        <Text
                          style={[
                            styles.planFeatureText,
                            !included && styles.planFeatureTextMuted,
                          ]}
                        >
                          {f.label}: {formatPlanFeatureText(f.key, f.value, f.valueType)}
                        </Text>
                        <AppIcon
                          name={included ? 'check' : 'close'}
                          size={14}
                          color={included ? '#fff' : 'rgba(255,255,255,0.45)'}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </LinearGradient>

            {/* Upgrade CTA */}
            {subscription.plan?.monthlyPrice === 0 && (
              <Pressable
                style={styles.upgradeBtn}
                onPress={() => router.push('/subscription')}
              >
                <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.upgradeBtnInner}>
                  <AppIcon name="crown" size={18} color="#fff" />
                  <Text style={styles.upgradeBtnText}>ترقية الباقة · اكتشف المزيد</Text>
                  <AppIcon name={rtlForwardIcon} size={16} color="#fff" />
                </LinearGradient>
              </Pressable>
            )}

            {/* Renew/pay subscription */}
            <View style={styles.subActions}>
              <Text style={styles.sectionLabel}>إجراءات الاشتراك</Text>

              {[
                {
                  icon: 'refresh-circle-outline',
                  title: 'تجديد الاشتراك',
                  subtitle: 'دفع رسوم الاشتراك الشهري',
                  color: colors.electric,
                  onPress: () => router.push({ pathname: '/payment', params: { planId: subscription.planSlug, cycle: 'monthly' } }),
                },
                {
                  icon: 'calendar-outline',
                  title: 'الاشتراك السنوي',
                  subtitle: 'وفّر ٢٠٪ مع الدفع السنوي',
                  color: colors.gold,
                  onPress: () => router.push({ pathname: '/payment', params: { planId: subscription.planSlug, cycle: 'yearly' } }),
                },
                {
                  icon: 'receipt-outline',
                  title: 'فواتير سابقة',
                  subtitle: 'عرض وتحميل الفواتير',
                  color: colors.glow,
                  onPress: () => setActiveTab('history'),
                },
              ].map((action) => (
                <Pressable
                  key={action.title}
                  style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.8 }]}
                  onPress={action.onPress}
                >
                  <View style={[styles.actionIcon, { backgroundColor: `${action.color}20` }]}>
                    <AppIcon name={action.icon} size={20} color={action.color} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  </View>
                  <AppIcon name={rtlForwardIcon} size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ─── TAB: السجل ─── */}
        {activeTab === 'history' && (
          <>
            <Text style={styles.sectionLabel}>سجل المدفوعات</Text>
            {paidFees.length > 0 ? (
              paidFees.map((fee) => (
                <View key={fee.id} style={styles.historyCard}>
                  <View style={styles.historyIconWrap}>
                    <Text style={styles.historyFeeIcon}>{fee.icon}</Text>
                    <View style={styles.historyCheck}>
                      <AppIcon name="checkmark" size={10} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle} numberOfLines={1}>{fee.listingTitleAr}</Text>
                    <Text style={styles.historyDate}>
                      {fee.paidAt ? new Date(fee.paidAt).toLocaleDateString('ar-SA') : '—'}
                    </Text>
                    {fee.transactionId && (
                      <Text style={styles.historyTxn} numberOfLines={1}>{fee.transactionId}</Text>
                    )}
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyAmount}>{fee.commission}</Text>
                    <Text style={styles.historyCurrency}>ريال</Text>
                    <View style={styles.paidBadge}>
                      <Text style={styles.paidBadgeText}>مسدّد</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>لا يوجد سجل بعد</Text>
              </View>
            )}
          </>
        )}

        {/* ─── TAB: جدول الرسوم ─── */}
        {activeTab === 'rules' && (
          <>
            <View style={styles.rulesHeader}>
              <Text style={styles.rulesBig}>جدول العمولات</Text>
              <Text style={styles.rulesSubtitle}>جدول العمولات</Text>
            </View>

            <View style={styles.rulesTable}>
              {/* Header */}
              <View style={[styles.rulesRow, styles.rulesTableHeader]}>
                <Text style={[styles.rulesCell, styles.rulesCellHeader, { flex: 2 }]}>الصنف</Text>
                <Text style={[styles.rulesCell, styles.rulesCellHeader, { flex: 1.2, textAlign: 'center' }]}>الرسوم</Text>
                <Text style={[styles.rulesCell, styles.rulesCellHeader, { flex: 1.2, textAlign: 'center' }]}>Fees</Text>
              </View>

              {commissionRules.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptySubtitle}>جاري تحميل جدول الرسوم...</Text>
                </View>
              ) : (
              commissionRules.map((row, i) => (
                <View
                  key={i}
                  style={[styles.rulesRow, i % 2 === 0 && styles.rulesRowAlt]}
                >
                  <View style={[styles.rulesCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <Text style={{ fontSize: 18 }}>{row.icon}</Text>
                    <Text style={styles.rulesCellText}>{row.nameAr}</Text>
                  </View>
                  <View style={[styles.rulesCell, { flex: 1.2, alignItems: 'center' }]}>
                    <View style={[styles.rulesPill, { backgroundColor: `${row.color}20`, borderColor: `${row.color}40` }]}>
                      <Text style={[styles.rulesPillText, { color: row.color }]}>{row.ruleAr}</Text>
                    </View>
                  </View>
                  <View style={[styles.rulesCell, { flex: 1.2, alignItems: 'center' }]}>
                    <Text style={styles.rulesEnText}>{row.ruleEn}</Text>
                  </View>
                </View>
              ))
              )}
            </View>

            <View style={styles.rulesNote}>
              <AppIcon name="information-circle-outline" size={16} color={colors.glow} />
              <Text style={styles.rulesNoteText}>
                الرسوم تُستحق خلال ٧ أيام من إتمام البيع. المتاجر الموثّقة بـ اشتراك مدفوع (Starter / Pro / VIP) معفاة من العمولة كلياً.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Payment Modal */}
      {showPayModal && (
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !processing && setShowPayModal(false)} />
          <View style={styles.modal}>
            <LinearGradient colors={[colors.bgPrimary, colors.bgSurface]} style={StyleSheet.absoluteFill} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>سداد الرسوم</Text>
              <Pressable onPress={() => !processing && setShowPayModal(false)} hitSlop={8}>
                <AppIcon name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Amount */}
            <View style={styles.modalAmount}>
              <Text style={styles.modalAmountLabel}>المبلغ الإجمالي</Text>
              <Text style={styles.modalAmountValue}>{totalSelected} <Text style={styles.modalAmountCurrency}>ريال</Text></Text>
              <Text style={styles.modalAmountSub}>{selectedFees.size} رسوم محددة</Text>
            </View>

            {/* Payment methods */}
            <Text style={styles.modalMethodLabel}>طريقة السداد</Text>
            <View style={styles.methodGrid}>
              {PAYMENT_METHODS.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setSelectedMethod(m.id)}
                  style={[styles.methodChip, selectedMethod === m.id && { borderColor: m.color, backgroundColor: `${m.color}15` }]}
                >
                  <Text style={styles.methodChipIcon}>{m.icon}</Text>
                  <Text style={[styles.methodChipLabel, selectedMethod === m.id && { color: m.color }]}>
                    {m.arabic}
                  </Text>
                  {selectedMethod === m.id && (
                    <View style={[styles.methodCheck, { backgroundColor: m.color }]}>
                      <AppIcon name="checkmark" size={9} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.confirmPayBtn, processing && { opacity: 0.7 }]}
              onPress={handleConfirmPayment}
              disabled={processing}
            >
              <LinearGradient colors={gradients.royal} style={styles.confirmPayBtnInner}>
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <AppIcon name="shield-check" size={18} color="#fff" />
                    <Text style={styles.confirmPayBtnText}>تأكيد السداد · {totalSelected} ريال</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.niBadge}>
              <AppIcon name="lock" size={12} color={colors.textSubtle} />
              <Text style={styles.niBadgeText}>مدفوعات آمنة عبر Network International · PCI-DSS Level 1</Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.micro, color: colors.textBrand },

  alertStrip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: `${colors.amber}15`,
    borderWidth: 1, borderColor: `${colors.amber}30`,
  },
  alertText: { ...typography.caption, color: colors.textSecondary },
  alertAmount: { fontWeight: '700', color: colors.amber },
  alertOverdue: { color: colors.rose },

  tabsRow: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  tabChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  tabChipActive: { backgroundColor: colors.royal, borderColor: colors.electric },
  tabLabel: { ...typography.caption, color: colors.textMuted },
  tabLabelActive: { color: colors.textBrandStrong },
  tabBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statCard: {
    flex: 1, padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.bgSurface, borderWidth: 1, alignItems: 'center', gap: 4,
  },
  statAmount: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { ...typography.micro, color: colors.textMuted, textAlign: 'center' },

  bulkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.electric,
    backgroundColor: `${colors.electric}10`,
  },
  selectAllText: { ...typography.micro, color: colors.textBrandStrong },
  paySelectedBtn: { flex: 1, borderRadius: radius.pill, overflow: 'hidden' },
  paySelectedInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: radius.pill,
  },
  paySelectedText: { ...typography.caption, color: '#fff', fontWeight: '700' },

  sectionLabel: { ...typography.micro, color: colors.textMuted, letterSpacing: 0.5, marginBottom: spacing.md },

  feeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  feeCardSelected: { borderColor: colors.electric, backgroundColor: `${colors.electric}08` },
  feeCardOverdue: { borderColor: `${colors.rose}40`, backgroundColor: `${colors.rose}05` },
  feeCheckWrap: { width: 22, alignItems: 'center' },
  feeCheck: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.borderMid,
    alignItems: 'center', justifyContent: 'center',
  },
  feeCheckActive: { backgroundColor: colors.electric, borderColor: colors.electric },
  feeIcon: { fontSize: 22 },
  feeInfo: { flex: 1, gap: 2 },
  feeTitle: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  feeDesc: { ...typography.micro, color: colors.textMuted },
  dueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start', marginTop: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.sm, backgroundColor: `${colors.textMuted}15`,
  },
  dueBadgeOverdue: { backgroundColor: `${colors.rose}15` },
  dueBadgeUrgent: { backgroundColor: `${colors.amber}15` },
  dueText: { fontSize: 10, color: colors.textMuted },
  feeRight: { alignItems: 'center', gap: 2 },
  feeAmount: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  feeCurrency: { ...typography.micro, color: colors.textMuted },
  payNowBtn: {
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.royal,
    borderWidth: 1, borderColor: colors.electric,
  },
  payNowText: { ...typography.micro, color: colors.textBrandStrong, fontWeight: '700' },

  infoBox: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    padding: spacing.md, marginTop: spacing.lg,
    backgroundColor: `${colors.glow}10`, borderRadius: radius.lg,
    borderWidth: 1, borderColor: `${colors.glow}20`,
  },
  infoText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 18, textAlign: 'right' },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl * 1.5, gap: spacing.md },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { ...typography.h3, color: colors.textPrimary },
  emptySubtitle: { ...typography.body, color: colors.textMuted },

  // Subscription tab
  currentPlanCard: {
    borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg, gap: spacing.lg,
  },
  planCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planCardLabel: { ...typography.micro, color: 'rgba(255,255,255,0.7)', marginBottom: 4, textAlign: 'right', writingDirection: 'rtl' },
  planCardName: { ...typography.h2, color: '#fff', textAlign: 'right', writingDirection: 'rtl' },
  planCardRenew: { ...typography.caption, color: 'rgba(255,255,255,0.6)', marginTop: 2, textAlign: 'right', writingDirection: 'rtl' },
  planCardIcon: { fontSize: 36 },
  usageBars: { gap: spacing.md },
  usageItem: { gap: 6 },
  usageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  usageLabel: { ...typography.micro, color: 'rgba(255,255,255,0.7)', textAlign: 'right', writingDirection: 'rtl' },
  usageVal: { ...typography.micro, color: '#fff', fontWeight: '700' },
  usageTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden',
  },
  usageFill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.8)' },
  planFeaturesWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: spacing.md,
    gap: 8,
  },
  planFeaturesTitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  planFeatureText: {
    ...typography.caption,
    color: '#fff',
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  planFeatureTextMuted: {
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },

  upgradeBtn: { borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.lg },
  upgradeBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.xl,
  },
  upgradeBtnText: { ...typography.bodyStrong, color: '#fff' },

  subActions: { gap: spacing.sm },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.bgSurface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft,
    marginBottom: spacing.sm,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  actionSubtitle: { ...typography.caption, color: colors.textMuted },

  // History tab
  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  historyIconWrap: { position: 'relative', width: 36, height: 36 },
  historyFeeIcon: { fontSize: 28 },
  historyCheck: {
    position: 'absolute', bottom: -2, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center',
  },
  historyInfo: { flex: 1, gap: 2 },
  historyTitle: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  historyDate: { ...typography.micro, color: colors.textMuted },
  historyTxn: { ...typography.micro, color: colors.textSubtle },
  historyRight: { alignItems: 'center', gap: 2 },
  historyAmount: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  historyCurrency: { ...typography.micro, color: colors.textMuted },
  paidBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill,
    backgroundColor: `${colors.emerald}20`, borderWidth: 1, borderColor: `${colors.emerald}40`,
  },
  paidBadgeText: { ...typography.micro, color: colors.textBrandSuccess, fontWeight: '700' },

  // Rules tab
  rulesHeader: { alignItems: 'center', marginBottom: spacing.xl },
  rulesBig: { ...typography.h1, color: colors.textPrimary },
  rulesSubtitle: { ...typography.caption, color: colors.textBrand },
  rulesTable: {
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.borderSoft, marginBottom: spacing.lg,
  },
  rulesTableHeader: { backgroundColor: colors.bgElevated },
  rulesRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    minHeight: 52,
  },
  rulesRowAlt: { backgroundColor: `${colors.bgSurface}80` },
  rulesCell: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rulesCellHeader: { ...typography.micro, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  rulesCellText: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  rulesPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1,
  },
  rulesPillText: { fontSize: 11, fontWeight: '700' },
  rulesEnText: { ...typography.micro, color: colors.textMuted, textAlign: 'center' },
  rulesNote: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: `${colors.glow}10`, borderRadius: radius.lg,
    borderWidth: 1, borderColor: `${colors.glow}20`,
  },
  rulesNoteText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 18, textAlign: 'right' },

  // Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,9,26,0.85)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  modal: {
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    padding: spacing.xl, paddingBottom: spacing.xxxl,
    overflow: 'hidden', gap: spacing.lg,
    borderTopWidth: 1, borderColor: colors.borderMid,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  modalAmount: { alignItems: 'center', gap: 4 },
  modalAmountLabel: { ...typography.caption, color: colors.textMuted },
  modalAmountValue: { fontSize: 40, fontWeight: '800', color: colors.textPrimary },
  modalAmountCurrency: { fontSize: 20, fontWeight: '400', color: colors.textMuted },
  modalAmountSub: { ...typography.caption, color: colors.textMuted },
  modalMethodLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  methodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.lg, backgroundColor: colors.bgSurface,
    borderWidth: 1.5, borderColor: colors.borderSoft,
    position: 'relative', minWidth: '30%',
  },
  methodChipIcon: { fontSize: 16 },
  methodChipLabel: { ...typography.caption, color: colors.textMuted, flex: 1 },
  methodCheck: {
    position: 'absolute', top: -5, right: -5,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmPayBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  confirmPayBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: spacing.lg, borderRadius: radius.xl,
  },
  confirmPayBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 16 },
  niBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  niBadgeText: { ...typography.micro, color: colors.textSubtle },
  });
}
