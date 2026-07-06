// Powered by OnSpace.AI
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { countries } from '@/services/types';
import { LocationMapPreview } from '@/components/feature/LocationMapPreview';
import { openLiveCreateIfAllowed } from '@/lib/liveStreamAccess';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, toggleFollowUser } from '@/services/users';
import { openUserProfile } from '@/lib/openUserProfile';
import { BRAND_VERIFIED_AR, BRAND_VERIFIED_EN } from '@/constants/brandCopy';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { listings, me, removeListing } = useApp();
  const listing = listings.find((l) => l.id === id);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!listing || listing.seller.id === me.id) return;
    fetchUserProfile(listing.seller.id).then((profile) => {
      if (profile) setIsFollowing(profile.isFollowing);
    });
  }, [listing?.seller.id, me.id]);

  const openSellerChat = () => {
    if (!listing) return;
    router.push({
      pathname: '/butchers/chat',
      params: {
        receiverId: listing.seller.id,
        receiverName: listing.seller.arabicName,
        receiverAvatar: listing.seller.avatar ?? '',
      },
    } as any);
  };

  const handleFollowSeller = async () => {
    if (!listing || !accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول للمتابعة');
      return;
    }
    setFollowLoading(true);
    const result = await toggleFollowUser(listing.seller.id);
    if (result) setIsFollowing(result.following);
    else Alert.alert('خطأ', 'تعذّرت المتابعة');
    setFollowLoading(false);
  };

  if (!listing) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.notFound}>Listing not found</Text>
      </SafeAreaView>
    );
  }

  const country = countries[listing.country];
  const isOwner = listing.seller.id === me.id;

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

  const handleDelete = () => {
    Alert.alert('حذف الإعلان', 'هل أنت متأكد من حذف هذا الإعلان؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          const success = await removeListing(listing.id);
          if (success) {
            router.back();
          } else {
            Alert.alert('خطأ', 'فشل حذف الإعلان. يرجى المحاولة لاحقاً.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: listing.images[0] }} style={styles.heroImg} contentFit="cover" transition={300} />
          <LinearGradient
            colors={['rgba(6,9,26,0.6)', 'transparent', 'rgba(6,9,26,0.85)']}
            style={StyleSheet.absoluteFill}
          />

          <SafeAreaView edges={['top']} style={styles.heroOverlay}>
            <View style={styles.heroTop}>
              <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
                <AppIcon name={rtlBackIcon} size={22} color="#fff" />
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => Alert.alert('تم الحفظ', 'تم حفظ الإعلان في المفضّلة ❤️')}>
                  <AppIcon name="heart-outline" size={20} color="#fff" />
                </Pressable>
                <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => Share.share({ message: `${listing.arabicTitle} — ${listing.price.toLocaleString()} ${listing.currency}\nhttps://alsfat.com/l/${listing.id}` })}>
                  <AppIcon name="share-outline" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>

          {listing.featured ? (
            <View style={styles.featured}>
              <AppIcon name="star" size={12} color="#1A1300" />
              <Text style={styles.featuredText}>Featured Listing</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.arabicTitle}>{listing.arabicTitle}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{listing.price.toLocaleString()}</Text>
            <Text style={styles.currency}>{listing.currency}</Text>
            <View style={{ flex: 1 }} />
            <View style={styles.countryPill}>
              <Text style={{ fontSize: 14 }}>{country.flag}</Text>
              <Text style={styles.countryText}>{country.en}</Text>
            </View>
          </View>

          <View style={styles.specsGrid}>
            <Spec icon="paw" label="Breed" value={listing.breed} />
            <Spec icon="calendar" label="Age" value={listing.age} />
            <Spec icon="clock-outline" label="Posted" value={listing.postedAt} />
          </View>

          <Text style={styles.section}>الموقع · Location</Text>
          <LocationMapPreview
            country={listing.country}
            cityLabel={listing.arabicLocation || listing.location}
            pinSeed={listing.id}
            height={200}
          />
          <View style={styles.locationRow}>
            <AppIcon name="location" size={18} color={colors.electricBright} />
            <Text style={styles.locationText}>
              {listing.arabicLocation} · {country.ar}
            </Text>
            <Text style={styles.locationFlag}>{country.flag}</Text>
          </View>

          {/* Owner actions */}
          {isOwner ? (
            <View style={styles.ownerActions}>
              <Text style={styles.ownerLabel}>إجراءات المالك · Owner Actions</Text>
              <View style={styles.ownerBtns}>
                {/* Live button - main action */}
                <Pressable onPress={handleStartLive} style={styles.liveBtn}>
                  <LinearGradient colors={['#EF4444', '#F97316']} style={styles.liveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <View style={styles.liveDot} />
                    <AppIcon name="broadcast" size={18} color="#fff" />
                    <Text style={styles.liveBtnText}>ابدأ بثاً مباشراً</Text>
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
              </View>
            </View>
          ) : null}

          <Text style={styles.section}>Description · الوصف</Text>
          <Text style={styles.desc}>{listing.description}</Text>
          <Text style={styles.descArabic}>{listing.arabicDescription}</Text>

          {/* Seller */}
          <Text style={styles.section}>Seller · البائع</Text>
          <Pressable
            style={styles.sellerCard}
            onPress={() => openUserProfile(router, listing.seller.id)}
          >
            <Image source={{ uri: listing.seller.avatar }} style={styles.sellerAvatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{listing.seller.displayName}</Text>
                {listing.seller.verified ? (
                  <AppIcon name="shield-checkmark" size={16} color={colors.electricBright} />
                ) : null}
              </View>
              <Text style={styles.sellerArabic}>{listing.seller.arabicName}</Text>
              <View style={styles.sellerStats}>
                <AppIcon name="star" size={12} color={colors.gold} />
                <Text style={styles.sellerStat}>{listing.seller.rating}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.sellerStat}>{listing.seller.followers.toLocaleString()} followers</Text>
              </View>
            </View>
            {!isOwner ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleFollowSeller();
                }}
                disabled={followLoading}
                style={[styles.followPill, isFollowing && styles.followingPill]}
              >
                <Text style={[styles.followPillText, isFollowing && styles.followingPillText]}>
                  {isFollowing ? 'متابَع' : 'متابعة'}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>

          {/* Trust */}
          <View style={styles.trustCard}>
            <AppIcon name="shield-check" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.trustTitle}>{BRAND_VERIFIED_EN}</Text>
              <Text style={styles.trustDesc}>Documents and ownership verified · {BRAND_VERIFIED_AR}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA bar - only for non-owners */}
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
            <PrimaryButton title="Make Offer · قدّم عرضاً" />
          </Pressable>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

interface SpecProps { icon: string; label: string; value: string }
function Spec({ icon, label, value }: SpecProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  return (
    <View style={styles.specCard}>
      <AppIcon name={icon} size={18} color={colors.glow} />
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  notFound: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 80 },
  heroWrap: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.bgSurface },
  heroImg: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(6,9,26,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(125,211,252,0.3)',
  },
  featured: {
    position: 'absolute', bottom: spacing.lg, left: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  featuredText: { ...typography.micro, color: '#1A1300' },
  body: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary },
  arabicTitle: { fontSize: 17, color: colors.textBrand, textAlign: 'right' },
  priceRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    marginTop: spacing.sm,
  },
  price: { ...typography.display, color: colors.gold },
  currency: { ...typography.bodyStrong, color: colors.textMuted },
  countryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  countryText: { ...typography.caption, color: colors.textPrimary },
  specsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginTop: spacing.md,
  },
  specCard: {
    flexBasis: '48%', flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
    gap: 4,
  },
  specLabel: { ...typography.micro, color: colors.textMuted, marginTop: 4 },
  specValue: { ...typography.bodyStrong, color: colors.textPrimary },
  section: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  locationText: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  locationFlag: { fontSize: 18 },
  desc: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  descArabic: { ...typography.body, color: colors.textMuted, textAlign: 'right', lineHeight: 24 },
  sellerCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  sellerAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.electric },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerName: { ...typography.bodyStrong, color: colors.textPrimary },
  sellerArabic: { ...typography.caption, color: colors.textBrand, textAlign: 'right' },
  sellerStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  sellerStat: { ...typography.caption, color: colors.textSecondary },
  dot: { color: colors.textMuted },
  followPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.electric,
  },
  followingPill: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  followPillText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  followingPillText: { color: colors.textPrimary },
  trustCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    marginTop: spacing.md,
  },
  trustTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  trustDesc: { ...typography.caption, color: colors.textSecondary },
  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md,
    backgroundColor: colors.bgPrimary,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  ctaIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderMid,
    alignItems: 'center', justifyContent: 'center',
  },
  ownerActions: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderMid,
    gap: spacing.md,
  },
  ownerLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  ownerBtns: {
    gap: spacing.sm,
  },
  liveBtn: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
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
  liveBtnText: {
    ...typography.bodyStrong,
    color: '#fff',
    fontSize: 15,
  },
  ownerSecondRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
  });
}
