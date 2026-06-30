// Powered by OnSpace.AI
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { inlineEnd, inlineStart, rtlDirection, rtlRow } from '@/lib/rtl';
import { Listing, countries } from '@/services/types';

interface ListingCardProps {
  listing: Listing;
  onPress?: () => void;
  variant?: 'grid' | 'feature' | 'profile';
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

function listingImageUri(listing: Listing): string | undefined {
  const first = listing.images?.[0];
  return first && first.trim().length > 0 ? first : undefined;
}

export function ListingCard({ listing, onPress, variant = 'grid' }: ListingCardProps) {
  const country = countries[listing.country];
  const thumbUri = listingImageUri(listing);

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
          colors={['transparent', 'rgba(6,9,26,0.92)']}
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
            <Ionicons name="star" size={12} color="#1A1300" />
          </View>
        ) : null}
      </Pressable>
    );
  }

  if (variant === 'feature') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.feature, rtlDirection, pressed && styles.pressed]}
      >
        <Image source={thumbUri ? { uri: thumbUri } : undefined} style={styles.featureImg} contentFit="cover" transition={250} />
        <LinearGradient
          colors={['transparent', 'rgba(6,9,26,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        {listing.featured ? (
          <View style={[styles.featuredBadge, inlineStart(spacing.lg), { top: spacing.lg }]}>
            <Ionicons name="star" size={12} color="#1A1300" />
            <Text style={styles.featuredText}>مميز</Text>
          </View>
        ) : null}
        <View style={styles.featureContent}>
          <Text style={styles.featureTitle} numberOfLines={2}>{listing.arabicTitle}</Text>
          <View style={[styles.row, rtlRow]}>
            <Text style={styles.featurePrice}>
              {listing.price.toLocaleString('ar-SA')} {listing.currency}
            </Text>
            <View style={styles.locationPill}>
              <Text style={styles.flag}>{country.flag}</Text>
              <Text style={styles.locationText}>{listing.arabicLocation}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, rtlDirection, pressed && styles.pressed]}
    >
      <View style={styles.imgWrap}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.img} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.imgPlaceholder}>
            <Text style={styles.imgPlaceholderIcon}>{CATEGORY_ICONS[listing.category] || '📦'}</Text>
          </View>
        )}
        {listing.featured ? (
          <View style={[styles.miniFeatured, inlineStart(8), { top: 8 }]}>
            <Ionicons name="star" size={10} color="#1A1300" />
          </View>
        ) : null}
        <View style={[styles.flagPill, inlineEnd(8), { top: 8 }]}>
          <Text style={styles.flag}>{country.flag}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{listing.arabicTitle}</Text>
        <View style={[styles.metaRow, rtlRow]}>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.textMuted} />
          <Text style={styles.meta}>{listing.arabicLocation}</Text>
        </View>
        <View style={[styles.priceRow, rtlRow]}>
          <Text style={styles.price}>{listing.price.toLocaleString('ar-SA')}</Text>
          <Text style={styles.currency}>{listing.currency}</Text>
        </View>
        <View style={[styles.sellerRow, rtlRow]}>
          <Image source={uriSource(listing.seller.avatar)} style={styles.sellerAvatar} />
          <Text style={styles.sellerName} numberOfLines={1}>{listing.seller.arabicName}</Text>
          {listing.seller.verified ? (
            <Ionicons name="shield-checkmark" size={12} color={colors.electricBright} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
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
  featureTitle: {
    ...typography.h2,
    color: '#fff',
    marginBottom: 2,
  },
  featureArabic: {
    ...typography.caption,
    color: colors.glow,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
  featurePrice: {
    ...typography.h3,
    color: colors.gold,
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
    backgroundColor: 'rgba(6,9,26,0.5)',
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
  row: {
    ...rtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Grid
  card: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  imgWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgElevated,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  imgPlaceholderIcon: { fontSize: 32 },
  miniFeatured: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagPill: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(6,9,26,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  flag: {
    fontSize: 14,
  },
  body: {
    padding: spacing.md,
    gap: 4,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  arabic: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
  },
  metaRow: {
    ...rtlRow,
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  priceRow: {
    ...rtlRow,
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  price: {
    ...typography.h3,
    color: colors.gold,
  },
  currency: {
    ...typography.micro,
    color: colors.textMuted,
  },
  sellerRow: {
    ...rtlRow,
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  sellerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  sellerName: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
});

export default ListingCard;
