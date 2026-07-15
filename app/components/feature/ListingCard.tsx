// Powered by OnSpace.AI
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, imageCardOverlay, imageCardOverlayStrong, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { formatRelativeTimeAr } from '@/lib/formatRelativeTime';
import { inlineStart, rtlDirection, rtlRow } from '@/lib/rtl';
import { Listing, countries } from '@/services/types';
import { UserProfileLink } from '@/components/feature/UserProfileLink';

interface ListingCardProps {
  listing: Listing;
  onPress?: () => void;
  variant?: 'grid' | 'feature' | 'profile' | 'list';
  compact?: boolean;
}

const CATEGORY_ICONS: Record<Listing['category'], string> = {
  camels: '🐪',
  sheep: '🐑',
  goats: '🐐',
  cows: '🐄',
  horses: '🐎',
  birds: '🦅',
  feed: '🌾',
  equipment: '⚙️',
};

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const NEW_LISTING_MS = 24 * 60 * 60 * 1000;

function listingImageUri(listing: Listing): string | undefined {
  const first = listing.images?.[0];
  return first && first.trim().length > 0 ? first : undefined;
}

function listingHasVideo(listing: Listing): boolean {
  return (listing.images ?? []).some((uri) => VIDEO_EXT.test(uri));
}

function listingTimeLabel(listing: Listing): string {
  if (listing.createdAt) return formatRelativeTimeAr(listing.createdAt);
  return listing.postedAt || '';
}

function isNewListing(listing: Listing): boolean {
  if (!listing.createdAt) return false;
  const t = new Date(listing.createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_LISTING_MS;
}

function formatCount(n: number): string {
  return n.toLocaleString('ar-SA');
}

export function ListingCard({ listing, onPress, variant = 'grid', compact = false }: ListingCardProps) {
  const country = countries[listing.country];
  const thumbUri = listingImageUri(listing);
  const { scheme } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const cardOverlay = imageCardOverlay(scheme);
  const cardOverlayStrong = imageCardOverlayStrong(scheme);
  const desc = listing.arabicDescription || listing.description;
  const timeLabel = listingTimeLabel(listing);
  const title = listing.arabicTitle || listing.title;
  const location = listing.arabicLocation || listing.location;
  const sellerName =
    listing.seller.arabicName || listing.seller.displayName || listing.seller.username;

  if (variant === 'list') {
    const showNew = isNewListing(listing);
    const hasVideo = listingHasVideo(listing);
    const views = listing.views ?? 0;

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.listRow, rtlDirection, pressed && styles.pressed]}
      >
        {/* المحتوى يمين (بداية RTL) ثم الصورة يسار */}
        <View style={styles.listContent}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {title}
          </Text>

          <View style={[styles.listMetaRow, rtlRow]}>
            <View style={[styles.listMetaItem, rtlRow]}>
              <AppIcon name="map-marker-outline" size={12} color={colors.textMuted} />
              <Text style={styles.listMetaText} numberOfLines={1}>
                {location}
              </Text>
            </View>
            {listing.featured ? (
              <Text style={styles.listStatusFeatured}>مميز</Text>
            ) : showNew ? (
              <Text style={styles.listStatusNew}>جديد</Text>
            ) : null}
          </View>

          <View style={[styles.listBottomRow, rtlRow]}>
            <UserProfileLink userId={listing.seller.id} style={[styles.listSeller, rtlRow]}>
              <Image source={uriSource(listing.seller.avatar)} style={styles.listAvatar} />
              <Text style={styles.listSellerName} numberOfLines={1}>
                {sellerName}
              </Text>
              {listing.seller.verified ? (
                <AppIcon name="shield-checkmark" size={12} color={colors.electricBright} />
              ) : null}
            </UserProfileLink>

            <View style={[styles.listStats, rtlRow]}>
              {timeLabel ? (
                <View style={[styles.listMetaItem, rtlRow]}>
                  <AppIcon name="time-outline" size={11} color={colors.textSubtle} />
                  <Text style={styles.listStatText}>{timeLabel}</Text>
                </View>
              ) : null}
              {views > 0 ? (
                <View style={[styles.listMetaItem, rtlRow]}>
                  <AppIcon name="eye" size={11} color={colors.textSubtle} />
                  <Text style={styles.listStatText}>{formatCount(views)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.listThumbWrap}>
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.listThumb} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.listThumbPlaceholder}>
              <Text style={styles.listThumbIcon}>{CATEGORY_ICONS[listing.category] || '📦'}</Text>
            </View>
          )}
          {hasVideo ? (
            <View style={styles.listVideoBadge}>
              <AppIcon name="play" size={10} color="#fff" variant="sr" />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  if (variant === 'profile') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.profileCard, rtlDirection, pressed && styles.pressed]}
      >
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.profileImg} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Text style={styles.profilePlaceholderIcon}>{CATEGORY_ICONS[listing.category] || '📦'}</Text>
          </View>
        )}
        <LinearGradient
          colors={cardOverlay}
          style={styles.profileOverlay}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileTitle} numberOfLines={2}>{listing.arabicTitle}</Text>
          <Text style={styles.profilePrice}>
            {listing.price.toLocaleString('ar-SA')} {listing.currency}
          </Text>
        </View>
        {listing.featured ? (
          <View style={[styles.profileStar, inlineStart(10)]}>
            <AppIcon name="star" size={12} color="#1A1300" />
          </View>
        ) : null}
      </Pressable>
    );
  }

  if (variant === 'feature') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.feature,
          compact && styles.featureCompact,
          rtlDirection,
          pressed && styles.pressed,
        ]}
      >
        <Image source={thumbUri ? { uri: thumbUri } : undefined} style={styles.featureImg} contentFit="cover" transition={250} />
        <LinearGradient
          colors={cardOverlayStrong}
          style={StyleSheet.absoluteFill}
        />
        {listing.featured ? (
          <View style={[styles.featuredBadge, inlineStart(spacing.lg), { top: compact ? spacing.md : spacing.lg }]}>
            <AppIcon name="star" size={12} color="#1A1300" />
            <Text style={styles.featuredText}>مميز</Text>
          </View>
        ) : null}
        <View style={[styles.featureContent, compact && styles.featureContentCompact]}>
          <Text style={[styles.featureTitle, compact && styles.featureTitleCompact]} numberOfLines={2}>
            {listing.arabicTitle}
          </Text>
          <View style={[styles.row, rtlRow]}>
            <Text style={[styles.featurePrice, compact && styles.featurePriceCompact]}>
              {listing.price.toLocaleString('ar-SA')} {listing.currency}
            </Text>
            <View style={styles.locationPill}>
              <Text style={styles.flag}>{country.flag}</Text>
              <Text style={[styles.locationText, compact && styles.locationTextCompact]} numberOfLines={1}>
                {listing.arabicLocation}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  // تغذية مثل حراج: بطاقات بعرض كامل تحت بعض
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.harajCard, rtlDirection, pressed && styles.pressed]}
    >
      <Text style={styles.harajTitle} numberOfLines={2}>
        {title}
      </Text>

      <View style={[styles.harajMeta, rtlRow]}>
        <View style={[styles.harajMetaItem, rtlRow]}>
          <AppIcon name="map-marker-outline" size={13} color={colors.textMuted} />
          <Text style={styles.harajMetaText}>{location}</Text>
        </View>
        <View style={[styles.harajMetaItem, rtlRow]}>
          <AppIcon name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.harajMetaText}>{timeLabel || 'الآن'}</Text>
        </View>
      </View>

      <View style={[styles.harajSellerRow, rtlRow]}>
        <UserProfileLink userId={listing.seller.id} style={[styles.harajSellerInfo, rtlRow]}>
          <Image source={uriSource(listing.seller.avatar)} style={styles.harajAvatar} />
          <Text style={styles.harajSellerName} numberOfLines={1}>
            {sellerName}
          </Text>
          {listing.seller.verified ? (
            <AppIcon name="shield-checkmark" size={13} color={colors.electricBright} />
          ) : null}
        </UserProfileLink>
        {listing.featured ? (
          <View style={[styles.harajFeatured, rtlRow]}>
            <AppIcon name="star" size={10} color="#1A1300" />
            <Text style={styles.harajFeaturedText}>مميز</Text>
          </View>
        ) : null}
      </View>

      {desc ? (
        <Text style={styles.harajDesc} numberOfLines={8}>
          {desc}
        </Text>
      ) : null}

      {listing.price > 0 ? (
        <Text style={styles.harajPrice}>
          {listing.price.toLocaleString('ar-SA')} {listing.currency}
        </Text>
      ) : null}

      <View style={styles.harajImgWrap}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.harajImg} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.harajImgPlaceholder}>
            <Text style={styles.harajImgPlaceholderIcon}>
              {CATEGORY_ICONS[listing.category] || '📦'}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },

  // قائمة السوق المضغوطة — بطاقة صف مع ظل خفيف
  listRow: {
    ...rtlRow,
    alignItems: 'center',
    minHeight: 100,
    maxHeight: 116,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    marginHorizontal: spacing.md,
    marginVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderHairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  listContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 5,
  },
  listTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    lineHeight: 22,
    color: colors.cyan,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  listMetaRow: {
    ...rtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listMetaItem: {
    ...rtlRow,
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  listMetaText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  listStatusNew: {
    ...typography.micro,
    color: colors.cyan,
    fontWeight: '700',
  },
  listStatusFeatured: {
    ...typography.micro,
    color: colors.gold,
    fontWeight: '700',
  },
  listBottomRow: {
    ...rtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listSeller: {
    ...rtlRow,
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  listAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
  },
  listSellerName: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  listStats: {
    ...rtlRow,
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  listStatText: {
    ...typography.micro,
    fontSize: 11,
    color: colors.textSubtle,
    writingDirection: 'rtl',
  },
  listThumbWrap: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    flexShrink: 0,
  },
  listThumb: {
    width: '100%',
    height: '100%',
  },
  listThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listThumbIcon: { fontSize: 28 },
  listVideoBadge: {
    position: 'absolute',
    top: 6,
    start: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    aspectRatio: 0.82,
  },
  profileImg: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  profilePlaceholderIcon: { fontSize: 36 },
  profileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  profileInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    gap: 2,
  },
  profileTitle: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'right',
  },
  profilePrice: {
    ...typography.micro,
    color: colors.gold,
    fontWeight: '700',
    textAlign: 'right',
  },
  profileStar: {
    position: 'absolute',
    top: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Feature
  feature: {
    width: 280,
    height: 380,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    marginEnd: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderMid,
    backgroundColor: colors.bgSurface,
  },
  featureCompact: {
    width: 248,
    height: 268,
    borderRadius: radius.xl,
    marginEnd: spacing.md,
  },
  featureImg: {
    width: '100%',
    height: '100%',
  },
  featureContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
  featureContentCompact: {
    padding: spacing.md,
  },
  featureTitle: {
    ...typography.h2,
    color: '#fff',
    marginBottom: 2,
  },
  featureTitleCompact: {
    ...typography.h3,
    marginBottom: 0,
  },
  featurePrice: {
    ...typography.h3,
    color: colors.gold,
  },
  featurePriceCompact: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  featuredBadge: {
    position: 'absolute',
    ...rtlRow,
    alignItems: 'center',
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4,
  },
  featuredText: {
    ...typography.micro,
    color: '#1A1300',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgOverlay,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  locationText: {
    ...typography.caption,
    color: '#fff',
  },
  locationTextCompact: {
    fontSize: 11,
    maxWidth: 88,
  },
  row: {
    ...rtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flag: {
    fontSize: 14,
  },

  harajCard: {
    width: '100%',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  harajTitle: {
    ...typography.h3,
    color: colors.cyan,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 26,
  },
  harajMeta: {
    ...rtlRow,
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  harajMetaItem: {
    ...rtlRow,
    alignItems: 'center',
    gap: 4,
  },
  harajMetaText: {
    ...typography.caption,
    color: colors.textMuted,
    writingDirection: 'rtl',
  },
  harajSellerRow: {
    ...rtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  harajSellerInfo: {
    ...rtlRow,
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  harajAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
  },
  harajSellerName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  harajFeatured: {
    ...rtlRow,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  harajFeaturedText: {
    ...typography.micro,
    color: '#1A1300',
    fontWeight: '700',
  },
  harajDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 24,
  },
  harajPrice: {
    ...typography.bodyStrong,
    color: colors.gold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  harajImgWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    marginTop: spacing.xs,
  },
  harajImg: {
    width: '100%',
    height: '100%',
  },
  harajImgPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  harajImgPlaceholderIcon: { fontSize: 40 },
  });
}

export default ListingCard;
