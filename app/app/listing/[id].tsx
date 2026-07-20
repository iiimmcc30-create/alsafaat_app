// Powered by OnSpace.AI
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { formatRelativeTimeAr } from '@/lib/formatRelativeTime';
import { rtlBackIcon, rtlDirection, rtlRow } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { type Listing } from '@/services/types';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, setFollowUser } from '@/services/users';
import { openUserProfile } from '@/lib/openUserProfile';
import { BRAND_VERIFIED_AR, BRAND_VERIFIED_EN } from '@/constants/brandCopy';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';
import { openPaymentCheckout } from '@/services/paymentCheckout';
import { promptReport } from '@/services/reports';
import { alertMessage, confirmDestructive, presentActionSheet } from '@/lib/actionSheet';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORY_LABELS: Record<string, string> = {
  camels: 'إبل',
  sheep: 'أغنام',
  goats: 'ماعز',
  cows: 'أبقار',
  horses: 'خيول',
  birds: 'طيور',
  feed: 'أعلاف',
  equipment: 'معدات',
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { listings, me, removeListing } = useApp();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cached = listings.find((l) => l.id === id);
  const [listing, setListing] = useState<Listing | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [activeImage, setActiveImage] = useState(0);

  // ─── Boost state ──────────────────────────────────────────────────────────
  const [boostModalVisible, setBoostModalVisible] = useState(false);
  const [boostType, setBoostType] = useState<'featured' | 'pinned'>('featured');
  const [boostDuration, setBoostDuration] = useState(30);
  const [boostMethod, setBoostMethod] = useState<'mada' | 'visa' | 'mastercard' | 'apple_pay' | 'stc_pay'>('mada');
  const [boostProcessing, setBoostProcessing] = useState(false);

  const BOOST_PLANS = {
    featured: [
      { durationDays: 7,  amount: 25,  labelAr: '٧ أيام'  },
      { durationDays: 30, amount: 75,  labelAr: '٣٠ يوماً' },
      { durationDays: 60, amount: 130, labelAr: '٦٠ يوماً' },
    ],
    pinned: [
      { durationDays: 3,  amount: 15,  labelAr: '٣ أيام'   },
      { durationDays: 7,  amount: 30,  labelAr: '٧ أيام'   },
      { durationDays: 30, amount: 80,  labelAr: '٣٠ يوماً' },
    ],
  } as const;

  const PAYMENT_METHODS_BOOST = [
    { id: 'mada' as const,       icon: '💳', labelAr: 'مدى'       },
    { id: 'visa' as const,       icon: '💳', labelAr: 'فيزا'      },
    { id: 'mastercard' as const, icon: '💳', labelAr: 'ماستركارد' },
    { id: 'apple_pay' as const,  icon: '🍎', labelAr: 'Apple Pay' },
    { id: 'stc_pay' as const,    icon: '📱', labelAr: 'STC Pay'  },
  ];

  const selectedBoostPlan = BOOST_PLANS[boostType].find((p) => p.durationDays === boostDuration)
    ?? BOOST_PLANS[boostType][1];

  const handleBoostPay = async () => {
    if (!listing) return;
    setBoostProcessing(true);
    try {
      const res = await authFetch(`${API_BASE}/api/listings/${listing.id}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boostType, durationDays: boostDuration, method: boostMethod }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        Alert.alert('فشل', json.messageAr ?? json.message ?? 'تعذّر إطلاق خدمة الترقية');
        return;
      }
      const { checkoutUrl, paymentId, devMode } = json.data as {
        checkoutUrl?: string;
        paymentId?: string;
        devMode?: boolean;
      };

      if (devMode) {
        setBoostModalVisible(false);
        Alert.alert(
          'الدفع غير متاح حالياً',
          'تم إيقاف أي ترقية وهمية للإعلان. لن يتم التمييز أو التثبيت حتى تعمل بوابة الدفع الحقيقية.',
        );
        return;
      }

      if (checkoutUrl) {
        setBoostModalVisible(false);
        await openPaymentCheckout(checkoutUrl, paymentId);
      } else {
        Alert.alert('خطأ', 'لم يُرجع الخادم رابط الدفع');
      }
    } catch (err) {
      Alert.alert('خطأ في الاتصال', 'تعذّر الوصول للخادم');
    } finally {
      setBoostProcessing(false);
    }
  };

  useEffect(() => {
    if (cached) setListing(cached);
  }, [cached]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) return;
      if (!cached) setLoading(true);
      try {
        const res = await (accessToken
          ? authFetch(`${API_BASE}/api/listings/${id}`)
          : fetch(`${API_BASE}/api/listings/${id}`));
        if (!res.ok) return;
        const json = await res.json();
        if (!json.success || !json.data || cancelled) return;
        const raw = json.data;
        setListing({
          id: raw.id,
          title: raw.title,
          arabicTitle: raw.arabicTitle,
          price: raw.price,
          currency: raw.currency || 'SAR',
          category: raw.category,
          breed: raw.breed || '',
          age: raw.age || '',
          location: raw.location,
          arabicLocation: raw.arabicLocation,
          country: raw.country,
          contactPhone: raw.contactPhone || undefined,
          images: raw.images?.length ? raw.images : [],
          description: raw.description,
          arabicDescription: raw.arabicDescription,
          seller: {
            id: raw.seller?.id,
            username: raw.seller?.username || '',
            displayName: raw.seller?.displayName || '',
            arabicName: raw.seller?.arabicName || '',
            avatar: raw.seller?.avatar,
            verified: raw.seller?.verified ?? false,
            followers: raw.seller?.followersCount ?? raw.seller?.followers ?? 0,
            following: raw.seller?.followingCount ?? 0,
            rating: typeof raw.seller?.rating === 'number' ? raw.seller.rating : null,
            reviewCount: raw.seller?.reviewCount ?? 0,
            country: raw.seller?.country || 'SA',
            bio: raw.seller?.bio || '',
          },
          featured: raw.featured ?? false,
          postedAt: new Date(raw.createdAt).toLocaleDateString('ar-SA'),
          createdAt: raw.createdAt,
        });
      } catch {
        // keep cache if any
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, accessToken, cached]);

  const refreshSellerFollowState = useCallback(async () => {
    if (
      !listing ||
      listing.seller.id === me.id ||
      !isAuthenticated ||
      !accessToken
    ) {
      setIsFollowing(null);
      return null;
    }
    const profile = await fetchUserProfile(listing.seller.id);
    setIsFollowing(profile?.isFollowing ?? null);
    return profile;
  }, [accessToken, isAuthenticated, listing, me.id]);

  useEffect(() => {
    void refreshSellerFollowState();
  }, [refreshSellerFollowState]);

  const openSellerChat = () => {
    if (!listing) return;
    router.push({
      pathname: '/butchers/chat',
      params: {
        receiverId: listing.seller.id,
        receiverName: listing.seller.arabicName,
        receiverAvatar: listing.seller.avatar ?? '',
        accountType: 'LIVESTOCK_TRADER',
        threadType: 'DIRECT',
      },
    } as any);
  };

  const openSellerWhatsApp = async () => {
    if (!listing) return;
    if (!listing.contactPhone) return;
    const phone = listing.contactPhone.replace(/\D/g, '');
    if (!phone) return;
    const title = listing.arabicTitle || listing.title;
    const message = encodeURIComponent(
      `مرحباً، أتواصل بخصوص إعلان "${title}" في تطبيق سرح.\nhttps://alsfat.com/l/${listing.id}`,
    );
    const appUrl = `whatsapp://send?phone=${phone}&text=${message}`;
    const webUrl = `https://wa.me/${phone}?text=${message}`;
    try {
      const canOpenApp = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpenApp ? appUrl : webUrl);
    } catch {
      Alert.alert('تعذّر فتح واتساب', 'تأكد من تثبيت واتساب أو صحة رقم التواصل.');
    }
  };

  const handleFollowSeller = async () => {
    if (!listing || !accessToken || isFollowing === null) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول للمتابعة');
      return;
    }
    setFollowLoading(true);
    try {
      const result = await setFollowUser(listing.seller.id, !isFollowing);
      if (!result) throw new Error('follow_failed');
      const refreshed = await refreshSellerFollowState();
      if (!refreshed) throw new Error('profile_refetch_failed');
    } catch (error) {
      await refreshSellerFollowState();
      Alert.alert('خطأ', 'تعذّرت المتابعة');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading && !listing) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator style={{ marginTop: 80 }} color={colors.electricBright} />
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.notFound}>لم يتم العثور على الإعلان</Text>
      </SafeAreaView>
    );
  }

  const isOwner = !!me.id && listing.seller.id === me.id;
  const timeLabel = listing.createdAt
    ? formatRelativeTimeAr(listing.createdAt)
    : listing.postedAt;
  const images = (listing.images || []).filter((uri) => uri && uri.trim().length > 0);
  const categoryLabel = CATEGORY_LABELS[listing.category] ?? '';

  const handleStartLive = () => {
    Alert.alert('البث المباشر', 'قريباً 🔴\nميزة البث المباشر للإعلانات ستتوفر قريباً.');
  };

  const handleEdit = () => {
    router.push({ pathname: '/create/listing', params: { editId: listing.id } } as any);
  };

  const handleDelete = async () => {
    const confirmed = await confirmDestructive(
      'حذف الإعلان',
      'هل أنت متأكد من حذف هذا الإعلان؟',
    );
    if (!confirmed) return;
    const result = await removeListing(listing.id);
    if (result.ok) {
      router.back();
    } else {
      await alertMessage(
        'خطأ',
        result.error || 'فشل حذف الإعلان. يرجى المحاولة لاحقاً.',
      );
    }
  };

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (idx !== activeImage) setActiveImage(idx);
  };

  const heroHeight = Math.min(screenWidth * 0.85, 420);

  // Owner management actions — single horizontal row
  const ownerActions = [
    {
      key: 'live',
      icon: 'signal-stream',
      label: 'بث مباشر',
      onPress: handleStartLive,
      badge: 'قريباً',
      danger: false,
    },
    {
      key: 'edit',
      icon: 'create-outline',
      label: 'تعديل',
      onPress: handleEdit,
      danger: false,
    },
    {
      key: 'feature',
      icon: 'star',
      label: listing.featured ? 'مميز ⭐' : 'تمييز',
      onPress: () => { setBoostType('featured'); setBoostDuration(30); setBoostModalVisible(true); },
      danger: false,
    },
    {
      key: 'pin',
      icon: 'pin',
      label: 'تثبيت',
      onPress: () => { setBoostType('pinned'); setBoostDuration(7); setBoostModalVisible(true); },
      danger: false,
    },
    {
      key: 'delete',
      icon: 'trash-outline',
      label: 'حذف',
      onPress: handleDelete,
      danger: true,
    },
  ];

  const showOwnerMenu = async () => {
    const key = await presentActionSheet({
      title: 'إدارة الإعلان',
      message: 'اختر الإجراء المطلوب',
      items: [
        { key: 'edit', label: 'تعديل الإعلان', icon: 'create-outline' },
        { key: 'feature', label: listing.featured ? 'إدارة التمييز' : 'تمييز الإعلان', icon: 'star' },
        { key: 'pin', label: 'تثبيت الإعلان', icon: 'pin' },
        { key: 'delete', label: 'حذف الإعلان', icon: 'trash-outline', destructive: true },
        { key: 'cancel', label: 'إلغاء', cancel: true },
      ],
    });
    if (key === 'edit') handleEdit();
    if (key === 'feature') {
      setBoostType('featured');
      setBoostDuration(30);
      setBoostModalVisible(true);
    }
    if (key === 'pin') {
      setBoostType('pinned');
      setBoostDuration(7);
      setBoostModalVisible(true);
    }
    if (key === 'delete') void handleDelete();
  };

  return (
    <View style={[styles.screen, rtlDirection]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ─── Hero gallery ─── */}
        <View style={[styles.hero, { height: heroHeight }]}>
          {images.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onGalleryScroll}
              >
                {images.map((uri, index) => (
                  <Pressable
                    key={`${uri}-${index}`}
                    onPress={() => { setImageViewerIndex(index); setImageViewerVisible(true); }}
                  >
                    <Image
                      source={uriSource(uri)}
                      style={{ width: screenWidth, height: heroHeight }}
                      contentFit="cover"
                      transition={250}
                    />
                  </Pressable>
                ))}
              </ScrollView>
              <LinearGradient
                colors={['rgba(0,0,0,0.45)', 'transparent']}
                style={styles.heroTopFade}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.35)']}
                style={styles.heroBottomFade}
                pointerEvents="none"
              />
              {images.length > 1 ? (
                <View style={styles.dotsRow} pointerEvents="none">
                  {images.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
                  ))}
                </View>
              ) : null}
              {images.length > 1 ? (
                <View style={styles.imgCounter} pointerEvents="none">
                  <AppIcon name="image" size={12} color="#fff" />
                  <Text style={styles.imgCounterText}>
                    {activeImage + 1}/{images.length}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.heroPlaceholder, { height: heroHeight }]}>
              <Text style={{ fontSize: 56 }}>🐪</Text>
            </View>
          )}

          {/* Floating top bar */}
          <View style={[styles.floatBar, { top: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.floatBtn}>
              <AppIcon name={rtlBackIcon} size={20} color="#fff" />
            </Pressable>
            <View style={[styles.floatActions, rtlRow]}>
              {isOwner ? (
                <Pressable hitSlop={8} style={styles.floatBtn} onPress={showOwnerMenu}>
                  <AppIcon name="ellipsis-horizontal" size={18} color="#fff" />
                </Pressable>
              ) : null}
              {!isOwner ? (
                <Pressable
                  hitSlop={8}
                  style={styles.floatBtn}
                  onPress={() => promptReport('listing', listing.id, isAuthenticated)}
                >
                  <AppIcon name="flag-outline" size={18} color="#fff" />
                </Pressable>
              ) : null}
              <Pressable
                hitSlop={8}
                style={styles.floatBtn}
                onPress={() => Alert.alert('تم الحفظ', 'تم حفظ الإعلان في المفضّلة ❤️')}
              >
                <AppIcon name="heart-outline" size={18} color="#fff" />
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.floatBtn}
                onPress={() =>
                  Share.share({
                    message: `${listing.arabicTitle} — ${listing.price.toLocaleString()} ${listing.currency}\nhttps://alsfat.com/l/${listing.id}`,
                  })
                }
              >
                <AppIcon name="share-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        <ImageViewerModal
          visible={imageViewerVisible}
          images={images}
          initialIndex={imageViewerIndex}
          onClose={() => setImageViewerVisible(false)}
        />

        {/* ─── Content sheet ─── */}
        <View style={styles.sheet}>
          {/* Price + featured */}
          <View style={[styles.priceHeader, rtlRow]}>
            {listing.price > 0 ? (
              <View style={[styles.priceRow, rtlRow]}>
                <Text style={styles.price}>{listing.price.toLocaleString('ar-SA')}</Text>
                <Text style={styles.currency}>{listing.currency}</Text>
              </View>
            ) : (
              <Text style={styles.priceOnRequest}>السعر عند الطلب</Text>
            )}
            {listing.featured ? (
              <View style={[styles.featured, rtlRow]}>
                <AppIcon name="star" size={11} color="#1A1300" />
                <Text style={styles.featuredText}>مميز</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{listing.arabicTitle || listing.title}</Text>

          {/* Meta chips */}
          <View style={[styles.chipsRow, rtlRow]}>
            <View style={[styles.chip, rtlRow]}>
              <AppIcon name="map-marker-outline" size={13} color={colors.textBrandStrong} />
              <Text style={styles.chipText}>{listing.arabicLocation || listing.location}</Text>
            </View>
            <View style={[styles.chip, rtlRow]}>
              <AppIcon name="time-outline" size={13} color={colors.textBrandStrong} />
              <Text style={styles.chipText}>{timeLabel || 'الآن'}</Text>
            </View>
            {categoryLabel ? (
              <View style={[styles.chip, rtlRow]}>
                <AppIcon name="tag-outline" size={13} color={colors.textBrandStrong} />
                <Text style={styles.chipText}>{categoryLabel}</Text>
              </View>
            ) : null}
            {listing.breed ? (
              <View style={[styles.chip, rtlRow]}>
                <Text style={styles.chipText}>{listing.breed}</Text>
              </View>
            ) : null}
            {listing.age ? (
              <View style={[styles.chip, rtlRow]}>
                <Text style={styles.chipText}>{listing.age}</Text>
              </View>
            ) : null}
            {listing.weightKg ? (
              <View style={[styles.chip, rtlRow]}>
                <Text style={styles.chipText}>{listing.weightKg.toLocaleString('ar-SA')} كجم</Text>
              </View>
            ) : null}
          </View>

          {/* ─── Owner management: single horizontal row ─── */}
          {isOwner ? (
            <View style={styles.ownerCard}>
              <View style={[styles.ownerHeader, rtlRow]}>
                <AppIcon name="settings-outline" size={15} color={colors.textBrandStrong} />
                <Text style={styles.ownerLabel}>إدارة الإعلان</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ownerRow}
              >
                {ownerActions.map((a) => (
                  <Pressable
                    key={a.key}
                    onPress={a.onPress}
                    style={({ pressed }) => [
                      styles.ownerAction,
                      a.danger && styles.ownerActionDanger,
                      pressed && styles.ownerActionPressed,
                    ]}
                  >
                    {a.badge ? (
                      <View style={styles.soonBadge}>
                        <Text style={styles.soonBadgeText}>{a.badge}</Text>
                      </View>
                    ) : null}
                    <View style={styles.ownerActionIcon}>
                      <AppIcon
                        name={a.icon}
                        size={20}
                        color={a.danger ? colors.rose : colors.textPrimary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.ownerActionText,
                        a.danger && styles.ownerActionTextDanger,
                      ]}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Seller card */}
          {!isOwner ? (
            <View style={[styles.sellerCard, rtlRow]}>
              <Pressable
                onPress={() => openUserProfile(router, listing.seller.id)}
                style={[styles.sellerInfo, rtlRow]}
              >
                <Image
                  source={uriSource(listing.seller.avatar)}
                  style={styles.sellerAvatar}
                  contentFit="cover"
                />
                <View style={styles.sellerNameCol}>
                  <View style={[rtlRow, { alignItems: 'center', gap: 4 }]}>
                    <Text style={styles.sellerChipName} numberOfLines={1}>
                      {listing.seller.arabicName || listing.seller.displayName || listing.seller.username}
                    </Text>
                    {listing.seller.verified ? (
                      <AppIcon name="shield-checkmark" size={14} color={colors.electricBright} />
                    ) : null}
                  </View>
                  <Text style={styles.sellerFollowers}>
                    {listing.seller.followers.toLocaleString('ar-SA')} متابع
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={handleFollowSeller}
                disabled={followLoading || isFollowing === null}
                style={[styles.followPill, isFollowing === true && styles.followingPill]}
              >
                {isFollowing === null && isAuthenticated ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.followPillText,
                      isFollowing === true && styles.followingPillText,
                    ]}
                  >
                    {isFollowing ? 'متابَع' : 'متابعة'}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* Description */}
          {(listing.arabicDescription || listing.description) ? (
            <View style={styles.descBlock}>
              <View style={[styles.sectionHeader, rtlRow]}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>الوصف</Text>
              </View>
              {listing.arabicDescription ? (
                <Text style={styles.descArabic}>{listing.arabicDescription}</Text>
              ) : null}
              {listing.description && listing.description !== listing.arabicDescription ? (
                <Text style={styles.desc}>{listing.description}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Trust card */}
          <View style={[styles.trustCard, rtlRow]}>
            <View style={styles.trustIconWrap}>
              <AppIcon name="shield-check" size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trustTitle}>{BRAND_VERIFIED_AR}</Text>
              <Text style={styles.trustDesc}>{BRAND_VERIFIED_EN} · مستندات وملكية موثّقة</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA for buyers */}
      {!isOwner ? (
        <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
          <Pressable
            onPress={openSellerChat}
            style={({ pressed }) => [styles.ctaIcon, pressed && { opacity: 0.7 }]}
          >
            <AppIcon name="chatbubbles" size={22} color={colors.textBrandStrong} />
          </Pressable>
          <Pressable
            onPress={listing.contactPhone ? openSellerWhatsApp : openSellerChat}
            style={{ flex: 1 }}
          >
            <PrimaryButton
              title={listing.contactPhone ? 'تواصل عبر واتساب' : 'مراسلة البائع'}
            />
          </Pressable>
        </SafeAreaView>
      ) : null}

      {/* ─── Boost Modal ─── */}
      <Modal
        visible={boostModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBoostModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => !boostProcessing && setBoostModalVisible(false)} />
        <View style={styles.boostModal}>
          <LinearGradient colors={[colors.bgPrimary, colors.bgSurface]} style={StyleSheet.absoluteFill} />

          {/* Header */}
          <View style={[styles.boostModalHeader, rtlRow]}>
            <Text style={styles.boostModalTitle}>
              {boostType === 'featured' ? '⭐ تمييز الإعلان' : '📌 تثبيت الإعلان'}
            </Text>
            <Pressable onPress={() => !boostProcessing && setBoostModalVisible(false)} hitSlop={8}>
              <AppIcon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Type Selector */}
          <View style={[styles.boostTypeRow, rtlRow]}>
            {([
              { key: 'featured' as const, icon: 'star',  label: 'إعلان مميز', desc: 'شارة ذهبية في نتائج البحث' },
              { key: 'pinned'   as const, icon: 'pin',   label: 'تثبيت أعلى', desc: 'يظهر دائماً في المقدمة'    },
            ]).map((t) => (
              <Pressable
                key={t.key}
                onPress={() => { setBoostType(t.key); setBoostDuration(BOOST_PLANS[t.key][1].durationDays); }}
                style={[
                  styles.boostTypeBtn,
                  boostType === t.key && {
                    borderColor: t.key === 'featured' ? colors.gold : colors.electricBright,
                    backgroundColor: t.key === 'featured' ? `${colors.gold}12` : `${colors.electricBright}12`,
                  },
                ]}
              >
                <AppIcon
                  name={t.icon}
                  size={20}
                  color={boostType === t.key ? (t.key === 'featured' ? colors.gold : colors.electricBright) : colors.textMuted}
                />
                <Text style={[styles.boostTypeBtnLabel, boostType === t.key && { color: t.key === 'featured' ? colors.gold : colors.electricBright }]}>
                  {t.label}
                </Text>
                <Text style={styles.boostTypeBtnDesc}>{t.desc}</Text>
              </Pressable>
            ))}
          </View>

          {/* Duration Selector */}
          <Text style={styles.boostSectionLabel}>اختر مدة الترقية</Text>
          <View style={[styles.boostDurRow, rtlRow]}>
            {BOOST_PLANS[boostType].map((plan) => (
              <Pressable
                key={plan.durationDays}
                onPress={() => setBoostDuration(plan.durationDays)}
                style={[
                  styles.boostDurChip,
                  boostDuration === plan.durationDays && { borderColor: colors.electric, backgroundColor: `${colors.electric}14` },
                ]}
              >
                <Text style={[styles.boostDurLabel, boostDuration === plan.durationDays && { color: colors.electricBright }]}>
                  {plan.labelAr}
                </Text>
                <Text style={[styles.boostDurPrice, boostDuration === plan.durationDays && { color: colors.electricBright }]}>
                  {plan.amount} ريال
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Payment Method */}
          <Text style={styles.boostSectionLabel}>طريقة السداد</Text>
          <View style={[styles.boostMethodRow, rtlRow]}>
            {PAYMENT_METHODS_BOOST.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setBoostMethod(m.id)}
                style={[styles.boostMethodChip, boostMethod === m.id && { borderColor: colors.electric, backgroundColor: `${colors.electric}12` }]}
              >
                <Text style={{ fontSize: 14 }}>{m.icon}</Text>
                <Text style={[styles.boostMethodLabel, boostMethod === m.id && { color: colors.electricBright }]}>
                  {m.labelAr}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Pay CTA */}
          <Pressable
            style={[styles.boostPayBtn, boostProcessing && { opacity: 0.65 }]}
            onPress={handleBoostPay}
            disabled={boostProcessing}
          >
            <LinearGradient
              colors={boostType === 'featured' ? ['#B8860B', '#FFD700', '#B8860B'] : [colors.electric, colors.electricBright, colors.electric]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.boostPayBtnInner}
            >
              {boostProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <AppIcon name={boostType === 'featured' ? 'star' : 'pin'} size={18} color="#fff" />
                  <Text style={styles.boostPayBtnText}>
                    {boostType === 'featured' ? 'تمييز الإعلان' : 'تثبيت الإعلان'} · {selectedBoostPlan?.amount ?? 0} ريال
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.boostNiBadge}>
            <AppIcon name="lock" size={12} color={colors.textSubtle} />
            <Text style={styles.boostNiText}>دفع آمن عبر Network International · PCI-DSS</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgDeep },
    notFound: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 80 },
    scrollContent: { paddingBottom: 140 },

    // ─── Hero gallery ─────────────────────────────────────────────────────
    hero: {
      width: '100%',
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
    },
    heroPlaceholder: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
    },
    heroTopFade: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 110,
    },
    heroBottomFade: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 70,
    },
    floatBar: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    floatActions: {
      alignItems: 'center',
      gap: 8,
    },
    floatBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(10,20,15,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    dotsRow: {
      position: 'absolute',
      bottom: 14,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.45)',
    },
    dotActive: {
      width: 18,
      backgroundColor: '#fff',
    },
    imgCounter: {
      position: 'absolute',
      bottom: 12,
      right: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(10,20,15,0.55)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    imgCounterText: { fontSize: 11, color: '#fff', fontWeight: '700' },

    // ─── Content sheet ────────────────────────────────────────────────────
    sheet: {
      marginTop: -18,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      backgroundColor: colors.bgDeep,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      gap: spacing.lg,
    },
    priceHeader: {
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    priceRow: {
      alignItems: 'baseline',
      gap: 6,
    },
    price: {
      ...typography.h1,
      color: colors.textBrandStrong,
      fontWeight: '800',
    },
    currency: { ...typography.bodyStrong, color: colors.textBrandSoft },
    priceOnRequest: { ...typography.h3, color: colors.textBrandStrong },
    featured: {
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.gold,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    featuredText: { ...typography.micro, color: '#1A1300', fontWeight: '800' },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 32,
    },

    // Meta chips
    chipsRow: {
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    chipText: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
    },

    // ─── Owner management (horizontal row) ────────────────────────────────
    ownerCard: {
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    ownerHeader: {
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
    },
    ownerLabel: {
      ...typography.caption,
      color: colors.textBrandStrong,
      fontWeight: '700',
    },
    ownerRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    ownerAction: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minWidth: 84,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      backgroundColor: colors.bgElevated,
    },
    ownerActionDanger: {
      borderColor: `${colors.rose}35`,
      backgroundColor: colors.bgSurface,
    },
    ownerActionPressed: {
      opacity: 0.82,
    },
    ownerActionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    ownerActionText: {
      ...typography.micro,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    ownerActionTextDanger: {
      color: colors.rose,
    },
    soonBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      backgroundColor: colors.gold,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      zIndex: 2,
    },
    soonBadgeText: { fontSize: 8, color: '#1A1300', fontWeight: '800' },

    // ─── Seller card ──────────────────────────────────────────────────────
    sellerCard: {
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    sellerInfo: {
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    sellerNameCol: { flex: 1, minWidth: 0, gap: 2 },
    sellerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.bgElevated,
      borderWidth: 2,
      borderColor: colors.electric,
    },
    sellerChipName: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      flexShrink: 1,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    sellerFollowers: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    followPill: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 9,
      borderRadius: radius.pill,
      backgroundColor: colors.electricBright,
    },
    followingPill: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.borderMid,
    },
    followPillText: { ...typography.caption, color: '#fff', fontWeight: '700' },
    followingPillText: { color: colors.textMuted },

    // Description
    descBlock: { gap: spacing.sm },
    sectionHeader: {
      alignItems: 'center',
      gap: 8,
    },
    sectionBar: {
      width: 4,
      height: 16,
      borderRadius: 2,
      backgroundColor: colors.electricBright,
    },
    sectionTitle: {
      ...typography.bodyStrong,
      color: colors.textBrandStrong,
      fontWeight: '700',
    },
    desc: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
    descArabic: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 26,
    },

    // Trust card
    trustCard: {
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: 'rgba(16,185,129,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(16,185,129,0.25)',
    },
    trustIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(16,185,129,0.14)',
    },
    trustTitle: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    trustDesc: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    // Bottom CTA
    ctaBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
      backgroundColor: colors.bgPrimary,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
    },
    ctaIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderMid,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ─── Boost Modal ────────────────────────────────────────────────────────
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(6,9,26,0.75)',
    },
    boostModal: {
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      padding: spacing.xl,
      paddingBottom: spacing.xxxl,
      overflow: 'hidden',
      gap: spacing.lg,
      borderTopWidth: 1,
      borderColor: colors.borderMid,
    },
    boostModalHeader: {
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    boostModalTitle: { ...typography.h2, color: colors.textPrimary },
    boostSectionLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600', marginBottom: -spacing.sm },
    boostTypeRow: { gap: spacing.sm },
    boostTypeBtn: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      backgroundColor: colors.bgSurface,
    },
    boostTypeBtnLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
    boostTypeBtnDesc:  { fontSize: 10, color: colors.textSubtle, textAlign: 'center' },
    boostDurRow: { gap: spacing.sm },
    boostDurChip: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.bgSurface,
    },
    boostDurLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
    boostDurPrice: { fontSize: 11, color: colors.textSubtle, fontWeight: '700' },
    boostMethodRow: { flexWrap: 'wrap', gap: spacing.sm },
    boostMethodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.bgSurface,
    },
    boostMethodLabel: { ...typography.micro, color: colors.textMuted },
    boostPayBtn: { borderRadius: radius.xl, overflow: 'hidden' },
    boostPayBtnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: spacing.lg,
      borderRadius: radius.xl,
    },
    boostPayBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 15 },
    boostNiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    boostNiText: { ...typography.micro, color: colors.textSubtle },
  });
}
