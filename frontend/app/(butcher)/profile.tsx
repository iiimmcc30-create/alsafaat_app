// Powered by OnSpace.AI
// SAFAT — Butcher Profile Screen (الملف الشخصي للملحمة)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { CATEGORY_LABELS, MeatCategory } from '@/services/butcherData';
import { UserProfileLink } from '@/components/feature/UserProfileLink';

type ProfileTab = 'info' | 'products' | 'reviews';

const PROFILE_TABS = [
  { id: 'info' as const, label: 'عن الملحمة', icon: 'information-circle-outline' },
  { id: 'products' as const, label: 'المنتجات', icon: 'storefront-outline' },
  { id: 'reviews' as const, label: 'التقييمات', icon: 'star-outline' },
];

export default function ButcherProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('info');
  const [butcher, setButcher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setErrorMsg('الرجاء تسجيل الدخول أولاً');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/butchers/me?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        setButcher(json.data);
      } else {
        setErrorMsg(json.messageAr || json.message || 'لم يتم العثور على ملف ملحمة');
      }
    } catch (err) {
      console.warn('[ButcherProfile] Fetch profile failed:', err);
      setErrorMsg('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  if (loading && !butcher) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.electricBright} />
          <Text style={{ marginTop: spacing.md, color: colors.textMuted, ...typography.body }}>جاري تحميل ملف الملحمة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg || !butcher) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ fontSize: 60 }}>🥩</Text>
          <Text style={{ ...typography.h2, color: colors.textPrimary, textAlign: 'center' }}>سجّل ملحمتك في صفاة</Text>
          <Text style={{ ...typography.body, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 22 }}>
            ابدأ بعرض منتجاتك الحيوانية واللحوم الطازجة لآلاف المشترين في منطقة الخليج العربي.
          </Text>
          <Pressable
            style={{
              marginTop: spacing.md,
              paddingHorizontal: spacing.xxl,
              paddingVertical: spacing.md,
              borderRadius: radius.xl,
              backgroundColor: colors.electric,
            }}
            onPress={() => router.push('/butchers/apply')}
          >
            <Text style={{ ...typography.bodyStrong, color: '#fff' }}>سجل ملحمتك الآن</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const products = butcher.products || [];
  const reviews = butcher.reviews || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={styles.scrollView}
      >
        {/* Cover Section */}
        <View style={styles.heroSection}>
          <Image source={{ uri: butcher.cover }} style={styles.cover} contentFit="cover" />
          <Pressable
            style={styles.menuBtn}
            onPress={() => router.push('/sidebar')}
          >
            <Ionicons name="menu" size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}>
                <Image source={{ uri: butcher.logo }} style={styles.avatar} contentFit="cover" />
              </View>
              {butcher.type === 'verified' && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.gold} />
                </View>
              )}
            </View>

            <View style={styles.headerBtns}>
              <Pressable style={styles.editBtn} onPress={() => router.push('/butchers/edit')}>
                <Text style={styles.editBtnText}>تعديل الحساب</Text>
              </Pressable>
              <Pressable
                style={styles.shareBtn}
                onPress={() => {
                  Share.share({
                    message: `تفقّد ملحمة ${butcher.nameAr} في تطبيق الصفاة 🥩\nتواصل مع الملحمة واطلب ذبيحتك مباشرة!`,
                    title: 'الصفاة — سوق الثروة الحيوانية',
                  });
                }}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Main Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{butcher.nameAr}</Text>
              {butcher.type === 'verified' && (
                <Ionicons name="checkmark-circle" size={20} color={colors.electricBright} />
              )}
            </View>
            <Text style={styles.englishName}>{butcher.nameEn}</Text>
            <Text style={styles.handle}>سجل تجاري: {butcher.commercialReg || 'مفعل بموجب وثيقة'}</Text>
            <Text style={styles.bio}>{butcher.bioAr}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.glow} />
              <Text style={styles.locationText}>{butcher.cityAr} · {butcher.addressAr}</Text>
            </View>
          </View>

          {/* Stats Card */}
          <View style={styles.statsCard}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{butcher.totalOrders.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLabel}>طلب مكتمل</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{products.length}</Text>
              <Text style={styles.statLabel}>منتجات نشطة</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>★ {butcher.rating}</Text>
              <Text style={styles.statLabel}>{butcher.reviewCount} تقييم</Text>
            </View>
          </View>

          {/* Specialty Badges */}
          <View style={styles.specialtiesRow}>
            {butcher.specialties.map((spec: string) => (
              <View key={spec} style={styles.specBadge}>
                <Text style={styles.specText}>{spec}</Text>
              </View>
            ))}
          </View>

          {/* Tabs Navigation */}
          <View style={styles.tabs}>
            {PROFILE_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={styles.tabItem}
                >
                  <Ionicons
                    name={tab.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={active ? colors.electricBright : colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {active && <View style={styles.tabIndicator} />}
                </Pressable>
              );
            })}
          </View>

          {/* Tab 1: Store Info */}
          {activeTab === 'info' && (
            <View style={styles.aboutCard}>
              {[
                { icon: 'time-outline', label: 'ساعات العمل اليومية', value: `من ${butcher.openTime} حتى ${butcher.closeTime}` },
                { icon: 'call-outline', label: 'رقم هاتف الملحمة', value: butcher.phone },
                { icon: 'checkmark-circle-outline', label: 'حالة التوثيق', value: butcher.type === 'verified' ? 'موثّق وبطاقة تجارية نشطة' : 'شريك عادي' },
                { icon: 'shield-outline', label: 'نسبة إتمام الطلبات', value: `%${butcher.orderCompletionRate} من الطلبات الواردة` },
                { icon: 'calendar-outline', label: 'تاريخ الانضمام للصفاة', value: new Date(butcher.createdAt).toLocaleDateString('ar-SA') },
              ].map((item, idx, arr) => (
                <View
                  key={item.label}
                  style={[styles.aboutRow, idx < arr.length - 1 && styles.aboutRowBorder]}
                >
                  <Ionicons
                    name={item.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={colors.glow}
                  />
                  <Text style={styles.aboutLabel}>{item.label}</Text>
                  <Text style={styles.aboutValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Tab 2: Products */}
          {activeTab === 'products' && (
            <View style={styles.productsGrid}>
              {products.map((p: any) => (
                <View key={p.id} style={styles.productCard}>
                  <Image source={{ uri: p.images[0] }} style={styles.productImg} contentFit="cover" />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{p.nameAr}</Text>
                    <Text style={styles.productCat}>
                      {CATEGORY_LABELS[p.category as MeatCategory]?.icon || '🥩'} {CATEGORY_LABELS[p.category as MeatCategory]?.ar || p.category}
                    </Text>
                    <View style={styles.productBottom}>
                      {p.pricePerKg
                        ? <Text style={styles.productPrice}>{p.pricePerKg} ر.س/كغ</Text>
                        : <Text style={styles.productPrice}>{p.priceFixed?.toLocaleString()} ر.س</Text>
                      }
                      <View style={[styles.stockTag, { backgroundColor: p.inStock ? `${colors.success}22` : `${colors.danger}22` }]}>
                        <Text style={[styles.stockTagText, { color: p.inStock ? colors.textBrandSuccess : colors.danger }]}>
                          {p.inStock ? 'متوفر' : 'نفد'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
              {products.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🥩</Text>
                  <Text style={styles.emptyText}>لا توجد منتجات نشطة حالياً</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 3: Reviews */}
          {activeTab === 'reviews' && (
            <View style={styles.reviewsList}>
              {reviews.map((rev: any) => (
                <View key={rev.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <UserProfileLink userId={rev.reviewer?.id}>
                      {rev.reviewer?.avatar ? (
                        <Image source={{ uri: rev.reviewer.avatar }} style={styles.reviewAvatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.reviewAvatar, { backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="person" size={18} color={colors.textMuted} />
                        </View>
                      )}
                    </UserProfileLink>
                    <View style={{ flex: 1 }}>
                      <UserProfileLink userId={rev.reviewer?.id}>
                        <Text style={styles.reviewAuthor}>{rev.reviewer?.arabicName || rev.reviewer?.displayName || 'عميل صفاة'}</Text>
                      </UserProfileLink>
                      <Text style={styles.reviewTime}>
                        {new Date(rev.createdAt).toLocaleDateString('ar-SA')}
                      </Text>
                    </View>
                    <View style={styles.stars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < rev.rating ? 'star' : 'star-outline'}
                          size={14}
                          color={colors.amber}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{rev.comment}</Text>
                </View>
              ))}
              {reviews.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>⭐</Text>
                  <Text style={styles.emptyText}>لا توجد تقييمات بعد</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  const CARD = {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  } as const;

  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  scrollView: { flex: 1 },
  scroll: { paddingBottom: spacing.md },
  heroSection: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  cover: {
    height: 150,
    width: '100%',
  },
  menuBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    zIndex: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: -40,
    zIndex: 3,
  },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.electricBright,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgDeep,
  },
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  editBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  editBtnText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  info: {
    gap: 4,
    marginBottom: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 22,
  },
  englishName: {
    ...typography.body,
    color: colors.textBrand,
  },
  handle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 22,
    textAlign: 'right',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  locationText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statsCard: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  statLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderSoft,
  },
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  specBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  specText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  tabLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.textBrandStrong,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.electricBright,
  },
  aboutCard: {
    ...CARD,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  aboutRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  aboutLabel: {
    flex: 1,
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  aboutValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  productsGrid: {
    gap: spacing.md,
  },
  productCard: {
    ...CARD,
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  productImg: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  productCat: {
    ...typography.micro,
    color: colors.textMuted,
  },
  productBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  productPrice: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: '700',
  },
  stockTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  stockTagText: {
    ...typography.micro,
    fontWeight: '700',
  },
  reviewsList: {
    gap: spacing.md,
  },
  reviewItem: {
    ...CARD,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
  },
  reviewAuthor: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  reviewTime: {
    ...typography.micro,
    color: colors.textMuted,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'right',
  },
  empty: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.xxxl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.body, color: colors.textMuted },
  bottomSpacer: { height: 100 },
  });
}
