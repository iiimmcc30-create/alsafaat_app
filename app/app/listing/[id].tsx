// Powered by OnSpace.AI
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { formatRelativeTimeAr } from '@/lib/formatRelativeTime';
import { rtlBackIcon, rtlDirection, rtlRow } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { type Listing } from '@/services/types';
import { openLiveCreateIfAllowed } from '@/lib/liveStreamAccess';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, setFollowUser } from '@/services/users';
import { openUserProfile } from '@/lib/openUserProfile';
import { BRAND_VERIFIED_AR, BRAND_VERIFIED_EN } from '@/constants/brandCopy';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';
import { promptReport } from '@/services/reports';
import { alertMessage, confirmDestructive } from '@/lib/actionSheet';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { listings, me, removeListing } = useApp();
  const cached = listings.find((l) => l.id === id);
  const [listing, setListing] = useState<Listing | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

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
      const { checkoutUrl, boostId, devMode } = json.data as { checkoutUrl?: string; boostId?: string; devMode?: boolean };

      if (devMode && boostId) {
        const simRes = await authFetch(`${API_BASE}/api/listings/boost/${boostId}/dev-complete`, { method: 'POST' });
        const simJson = await simRes.json().catch(() => ({}));
        if (simRes.ok && simJson.success) {
          setBoostModalVisible(false);
          Alert.alert(
            boostType === 'featured' ? '⭐ تم التمييز' : '📌 تم التثبيت',
            `إعلانك ${boostType === 'featured' ? 'مميز' : 'مثبّت'} لمدة ${boostDuration} يوماً (وضع التطوير).`,
          );
        } else {
          Alert.alert('خطأ', simJson.messageAr ?? 'فشل محاكاة الدفع');
        }
        return;
      }

      if (checkoutUrl) {
        setBoostModalVisible(false);
        await Linking.openURL(checkoutUrl);
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
    if (__DEV__) {
      console.debug('[Follow] listing seller state loaded from server', {
        viewerId: me.id,
        sellerId: listing.seller.id,
        isFollowing: profile?.isFollowing ?? null,
      });
    }
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
      if (__DEV__ && refreshed.isFollowing !== result.following) {
        console.warn('[Follow] listing seller mutation/profile mismatch', {
          sellerId: listing.seller.id,
          mutationFollowing: result.following,
          profileFollowing: refreshed.isFollowing,
        });
      }
    } catch (error) {
      if (__DEV__) console.warn('[Follow] listing seller mutation failed', error);
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

  const handleStartLive = () => {
    Alert.alert(
      'بث مباشر لهذا الإعلان',
      `ستبدأ بثاً مباشراً مرتبطاً بـ "${listing.title}"`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'ابدأ البث 🔴',
          onPress: () => openLiveCreateIfAllowed(router, accessToken, {
            listingId: listing.id,
            listingTitle: listing.arabicTitle,
          }),
        },
      ]
    );
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

  return (
    <View style={[styles.screen, rtlDirection]}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={[styles.topActions, rtlRow]}>
          {!isOwner ? (
            <Pressable
              hitSlop={8}
              style={styles.iconBtn}
              onPress={() => promptReport('listing', listing.id, isAuthenticated)}
            >
              <AppIcon name="flag-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          ) : null}
          <Pressable
            hitSlop={8}
            style={styles.iconBtn}
            onPress={() => Alert.alert('تم الحفظ', 'تم حفظ الإعلان في المفضّلة ❤️')}
          >
            <AppIcon name="heart-outline" size={20} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            hitSlop={8}
            style={styles.iconBtn}
            onPress={() =>
              Share.share({
                message: `${listing.arabicTitle} — ${listing.price.toLocaleString()} ${listing.currency}\nhttps://alsfat.com/l/${listing.id}`,
              })
            }
          >
            <AppIcon name="share-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>{listing.arabicTitle || listing.title}</Text>

          {listing.featured ? (
            <View style={[styles.featured, rtlRow]}>
              <AppIcon name="star" size={12} color="#1A1300" />
              <Text style={styles.featuredText}>إعلان مميز</Text>
            </View>
          ) : null}

          {/* Haraj detail meta: مدينة · الوقت · المعلن */}
          <View style={[styles.metaRow, rtlRow]}>
            <Text style={styles.metaText}>
              {listing.arabicLocation || listing.location}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{timeLabel || 'الآن'}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Pressable onPress={() => openUserProfile(router, listing.seller.id)}>
              <Text style={styles.metaUser}>
                {listing.seller.arabicName || listing.seller.displayName || listing.seller.username}
              </Text>
            </Pressable>
            {listing.seller.verified ? (
              <AppIcon name="shield-checkmark" size={13} color={colors.electricBright} />
            ) : null}
          </View>

          {!isOwner ? (
            <View style={[styles.sellerActions, rtlRow]}>
              <Pressable
                onPress={handleFollowSeller}
                disabled={followLoading || isFollowing === null}
                style={[styles.followPill, isFollowing === true && styles.followingPill]}
              >
                {isFollowing === null ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.followPillText,
                      isFollowing && styles.followingPillText,
                    ]}
                  >
                    {isFollowing ? 'متابَع' : 'متابعة'}
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => openUserProfile(router, listing.seller.id)}
                style={[styles.sellerChip, rtlRow]}
              >
                <Image
                  source={{ uri: listing.seller.avatar }}
                  style={styles.sellerAvatar}
                  contentFit="cover"
                />
                <Text style={styles.sellerChipName} numberOfLines={1}>
                  {listing.seller.arabicName || listing.seller.displayName}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {(listing.arabicDescription || listing.description) ? (
            <View style={styles.descBlock}>
              {listing.arabicDescription ? (
                <Text style={styles.descArabic}>{listing.arabicDescription}</Text>
              ) : null}
              {listing.description && listing.description !== listing.arabicDescription ? (
                <Text style={styles.desc}>{listing.description}</Text>
              ) : null}
            </View>
          ) : null}

          {listing.price > 0 ? (
            <View style={[styles.priceRow, rtlRow]}>
              <Text style={styles.price}>{listing.price.toLocaleString('ar-SA')}</Text>
              <Text style={styles.currency}>{listing.currency}</Text>
            </View>
          ) : null}

          {images.length > 0 ? (
            <View style={styles.gallery}>
              {images.map((uri, index) => (
                <Pressable
                  key={`${uri}-${index}`}
                  onPress={() => { setImageViewerIndex(index); setImageViewerVisible(true); }}
                >
                  <Image
                    source={{ uri }}
                    style={[styles.galleryImg, index === 0 && styles.galleryImgMain]}
                    contentFit="cover"
                    transition={300}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}

          <ImageViewerModal
            visible={imageViewerVisible}
            images={images}
            initialIndex={imageViewerIndex}
            onClose={() => setImageViewerVisible(false)}
          />

          {isOwner ? (
            <View style={styles.ownerActions}>
              <Text style={styles.ownerLabel}>إدارة إعلانك</Text>
              <View style={styles.ownerBtns}>
                <Pressable onPress={handleStartLive} style={styles.liveBtn}>
                  <LinearGradient
                    colors={[colors.rose, '#DC2626']}
                    style={styles.liveBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBtnText}>بث مباشر</Text>
                  </LinearGradient>
                </Pressable>
                <View style={styles.ownerSecondRow}>
                  <Pressable onPress={handleEdit} style={styles.ownerSecBtn}>
                    <AppIcon name="create-outline" size={18} color={colors.electricBright} />
                    <Text style={styles.ownerSecBtnText}>تعديل</Text>
                  </Pressable>
                  <Pressable onPress={handleDelete} style={[styles.ownerSecBtn, styles.ownerSecBtnDanger]}>
                    <AppIcon name="trash-outline" size={18} color={colors.rose} />
                    <Text style={[styles.ownerSecBtnText, { color: colors.rose }]}>حذف</Text>
                  </Pressable>
                </View>

                {/* ─── Boost CTA ─── */}
                <View style={styles.boostRow}>
                  <Pressable
                    style={[styles.boostBtn, { backgroundColor: `${colors.gold}18`, borderColor: `${colors.gold}50` }]}
                    onPress={() => { setBoostType('featured'); setBoostDuration(30); setBoostModalVisible(true); }}
                  >
                    <AppIcon name="star" size={16} color={colors.gold} />
                    <Text style={[styles.boostBtnText, { color: colors.gold }]}>
                      {listing.featured ? '⭐ مميز' : 'تمييز الإعلان'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.boostBtn, { backgroundColor: `${colors.electricBright}18`, borderColor: `${colors.electricBright}50` }]}
                    onPress={() => { setBoostType('pinned'); setBoostDuration(7); setBoostModalVisible(true); }}
                  >
                    <AppIcon name="pin" size={16} color={colors.electricBright} />
                    <Text style={[styles.boostBtnText, { color: colors.electricBright }]}>
                      تثبيت الإعلان
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.trustCard}>
            <AppIcon name="shield-check" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.trustTitle}>{BRAND_VERIFIED_EN}</Text>
              <Text style={styles.trustDesc}>Documents and ownership verified · {BRAND_VERIFIED_AR}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {!isOwner ? (
        <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
          <Pressable
            onPress={openSellerChat}
            style={({ pressed }) => [styles.ctaIcon, pressed && { opacity: 0.7 }]}
          >
            <AppIcon name="chatbubbles" size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => {
              Alert.alert(
                'تقديم عرض 💰',
                `هل تريد إرسال عرض للبائع بسعر ${listing.price.toLocaleString()} ${listing.currency}؟`,
                [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'إرسال العرض',
                    onPress: openSellerChat,
                  },
                ]
              );
            }}
            style={{ flex: 1 }}
          >
            <PrimaryButton title="قدّم عرضاً" />
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
    topBar: {
      ...rtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      backgroundColor: colors.bgDeep,
    },
    topActions: {
      ...rtlRow,
      alignItems: 'center',
      gap: 8,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    scrollContent: { paddingBottom: 160, paddingHorizontal: spacing.md, paddingTop: spacing.md },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.lg,
      gap: spacing.md,
    },
    title: {
      ...typography.h1,
      color: colors.cyan,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 34,
    },
    featured: {
      ...rtlRow,
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      backgroundColor: colors.gold,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    featuredText: { ...typography.micro, color: '#1A1300', fontWeight: '700' },
    metaRow: {
      ...rtlRow,
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    metaText: {
      ...typography.caption,
      color: colors.textMuted,
      writingDirection: 'rtl',
    },
    metaDot: {
      ...typography.caption,
      color: colors.textSubtle,
    },
    metaUser: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
      writingDirection: 'rtl',
    },
    sellerActions: {
      ...rtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    sellerChip: {
      ...rtlRow,
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    sellerAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgElevated,
    },
    sellerChipName: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      flexShrink: 1,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    followPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: '#1877F2',
    },
    followingPill: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.borderMid,
    },
    followPillText: { ...typography.caption, color: '#fff', fontWeight: '700' },
    followingPillText: { color: colors.textMuted },
    descBlock: { gap: spacing.sm },
    desc: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
    descArabic: {
      ...typography.body,
      color: colors.textPrimary,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 26,
    },
    priceRow: {
      ...rtlRow,
      alignItems: 'baseline',
      gap: 6,
    },
    price: { ...typography.h2, color: colors.gold },
    currency: { ...typography.bodyStrong, color: colors.textMuted },
    gallery: { gap: spacing.sm, marginTop: spacing.xs },
    galleryImg: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radius.md,
      backgroundColor: colors.bgElevated,
    },
    galleryImgMain: {
      aspectRatio: 4 / 3,
    },
    trustCard: {
      ...rtlRow,
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: 'rgba(16,185,129,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(16,185,129,0.3)',
      marginTop: spacing.sm,
    },
    trustTitle: { ...typography.bodyStrong, color: colors.textPrimary },
    trustDesc: { ...typography.caption, color: colors.textSecondary },
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
    ownerActions: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.xl,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderMid,
      gap: spacing.md,
    },
    ownerLabel: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    ownerBtns: { gap: spacing.sm },
    liveBtn: { borderRadius: radius.xl, overflow: 'hidden' },
    liveBtnGrad: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: radius.xl,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fff',
      opacity: 0.9,
    },
    liveBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 15 },
    ownerSecondRow: { flexDirection: 'row', gap: spacing.sm },
    ownerSecBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.lg,
      backgroundColor: colors.bgGlass,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    ownerSecBtnDanger: {
      borderColor: 'rgba(239,68,68,0.3)',
      backgroundColor: 'rgba(239,68,68,0.08)',
    },
    ownerSecBtnText: {
      ...typography.caption,
      color: colors.textBrandStrong,
      fontWeight: '600',
    },
    // ─── Boost row (in owner section) ───────────────────────────────────────
    boostRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    boostBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    boostBtnText: {
      ...typography.caption,
      fontWeight: '700',
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
