// Powered by OnSpace.AI
// SAFAT — Butchers Listing Screen (قسم الملاحم)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { countries } from '@/services/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import {
  ButcherProfile,
  ButcherStory,
  Country,
  gccCurrencies,
  rankButchers,
} from '@/services/butcherData';

const STORY_CIRCLE = 62;

// ─── Story Type Colors ────────────────────────────────────────────────────────
const STORY_TYPE_COLORS = {
  daily_slaughter: ['#EF4444', '#DC2626'],
  offer: ['#F59E0B', '#D97706'],
  new_stock: ['#10B981', '#059669'],
  update: ['#3B82F6', '#2563EB'],
} as const;

const STORY_TYPE_ICONS = {
  daily_slaughter: '🔪',
  offer: '🏷️',
  new_stock: '📦',
  update: '📢',
};

// ─── Components ───────────────────────────────────────────────────────────────

function StoriesRow({ stories, onStoryPress }: {
  stories: ButcherStory[];
  onStoryPress: (story: ButcherStory) => void;
}) {
  const { colors } = useTheme();
  const st = useThemedStyles(({ colors }) => createStoryStyles(colors));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.storiesContent}
    >
      {stories.map((story) => {
        const typeColors = STORY_TYPE_COLORS[story.type];
        return (
          <Pressable key={story.id} onPress={() => onStoryPress(story)} style={st.storyItem}>
            <LinearGradient
              colors={story.seen ? [colors.borderSoft, colors.borderSoft] : typeColors}
              style={st.storyRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={st.storyInner}>
                <Image
                  source={{ uri: story.butcherLogo }}
                  style={st.storyAvatar}
                  contentFit="cover"
                />
                {story.isVerified && (
                  <View style={st.storyVerifiedDot}>
                    <AppIcon name="shield-checkmark" size={9} color={colors.electricBright} />
                  </View>
                )}
              </View>
            </LinearGradient>
            <View style={st.storyTypeChip}>
              <Text style={st.storyTypeIcon}>{STORY_TYPE_ICONS[story.type]}</Text>
            </View>
            <Text style={st.storyName} numberOfLines={1}>
              {story.butcherNameAr.split(' ').slice(0, 2).join(' ')}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ButcherCard({ butcher, onPress }: { butcher: ButcherProfile; onPress: () => void }) {
  const { colors } = useTheme();
  const bc = useThemedStyles(({ colors }) => createCardStyles(colors));
  const currency = gccCurrencies[butcher.country];
  const country = countries[butcher.country];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [bc.card, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
    >
      {/* Cover */}
      <View style={bc.coverWrap}>
        <Image source={{ uri: butcher.cover }} style={bc.cover} contentFit="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(6,9,26,0.88)']}
          style={StyleSheet.flatten([StyleSheet.absoluteFillObject, { borderRadius: radius.xl }])}
        />
        {/* Verified badge */}
        {butcher.subscriptionActive && (
          <LinearGradient
            colors={[colors.gold, '#F59E0B']}
            style={bc.verifiedBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <AppIcon name="shield-checkmark" size={11} color="#1A1300" />
            <Text style={bc.verifiedText}>موثّق</Text>
          </LinearGradient>
        )}
        {/* Country flag */}
        <View style={bc.flagPill}>
          <Text style={bc.flag}>{country.flag}</Text>
        </View>
        {/* Open/Closed */}
        <View style={[bc.statusPill, { backgroundColor: butcher.workingHours.isOpen ? colors.success + 'CC' : colors.danger + 'CC' }]}>
          <View style={[bc.statusDot, { backgroundColor: butcher.workingHours.isOpen ? '#fff' : '#fff' }]} />
          <Text style={bc.statusText}>{butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={bc.body}>
        {/* Logo + Name */}
        <View style={bc.logoRow}>
          <View style={bc.logoWrap}>
            <Image source={{ uri: butcher.logo }} style={bc.logo} contentFit="cover" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={bc.name} numberOfLines={1}>{butcher.nameAr}</Text>
            <View style={bc.locationRow}>
              <AppIcon name="map-marker-outline" size={12} color={colors.glow} />
              <Text style={bc.locationText}>{butcher.cityAr} · {country.ar}</Text>
            </View>
          </View>
          {/* Rating */}
          <View style={bc.ratingPill}>
            <AppIcon name="star" size={12} color={colors.gold} />
            <Text style={bc.ratingText}>{butcher.rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* Specialties chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={bc.chipsRow}>
            {butcher.specialties.slice(0, 4).map((spec, i) => (
              <View key={i} style={bc.chip}>
                <Text style={bc.chipText}>{spec}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Stats */}
        <View style={bc.statsRow}>
          <View style={bc.stat}>
            <AppIcon name="check-circle-outline" size={13} color={colors.success} />
            <Text style={bc.statText}>{butcher.orderCompletionRate}% إتمام</Text>
          </View>
          <View style={bc.statDivider} />
          <View style={bc.stat}>
            <AppIcon name="bag-outline" size={13} color={colors.electricBright} />
            <Text style={bc.statText}>{butcher.totalOrders.toLocaleString()} طلب</Text>
          </View>
          <View style={bc.statDivider} />
          <View style={bc.stat}>
            <AppIcon name="time-outline" size={13} color={colors.textMuted} />
            <Text style={bc.statText}>{butcher.workingHours.open} – {butcher.workingHours.close}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const GCC_COUNTRIES: { code: Country; label: string; flag: string }[] = [
  { code: 'SA', label: 'السعودية', flag: '🇸🇦' },
];

export default function ButchersScreen() {
  const { colors, gradients } = useTheme();
  const s = useThemedStyles(({ colors }) => createScreenStyles(colors));
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();
  const [butchersList, setButchersList] = useState<ButcherProfile[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [seenStories, setSeenStories] = useState<Set<string>>(new Set());
  const [butcherStories, setButcherStories] = useState<ButcherStory[]>([]);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const res = await fetch(`${API_BASE}/api/butchers/stories`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const mapped = json.data.map((s: any) => ({
              id: s.id,
              butcherId: s.butcherId,
              butcherName: s.butcher?.nameAr || s.butcher?.nameEn || 'ملحمة',
              butcherNameAr: s.butcher?.nameAr || 'ملحمة',
              butcherLogo: s.butcher?.logo || undefined,
              isVerified: s.butcher?.subscriptionActive || false,
              thumbnail: s.thumbnail,
              caption: s.caption,
              captionAr: s.captionAr,
              postedAt: s.createdAt,
              duration: s.duration || 15,
              seen: false,
              type: s.type,
            }));
            setButcherStories(mapped);
          }
        }
      } catch (err) {
        console.warn('[ButchersScreen] Failed to fetch stories:', err);
      }
    };
    fetchStories();
  }, [accessToken]);

  useEffect(() => {
    const fetchButchers = async () => {
      try {
        const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const res = await fetch(`${API_BASE}/api/butchers`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.butchers) {
            const mapped = json.data.butchers
              .filter((b: any) => (b.country || 'SA') !== 'EG')
              .map((b: any) => ({
              id: b.id,
              name: b.nameAr || b.nameEn,
              nameAr: b.nameAr,
              logo: b.logo || undefined,
              cover: b.cover || undefined,
              type: b.type || 'regular',
              country: b.country || 'SA',
              city: b.city || '',
              cityAr: b.cityAr || '',
              address: b.address || '',
              addressAr: b.addressAr || '',
              lat: b.lat || 0,
              lng: b.lng || 0,
              phone: b.phone || '',
              rating: b.rating ?? 5.0,
              reviewCount: b.reviewCount ?? 0,
              orderCompletionRate: b.orderCompletionRate ?? 100,
              workingHours: {
                open: b.openTime || '06:00',
                close: b.closeTime || '22:00',
                isOpen: b.isOpen ?? true,
                closedOn: b.closedDays || [],
              },
              bio: b.bioAr || b.bioEn || '',
              bioAr: b.bioAr || '',
              specialties: b.specialties || [],
              subscriptionActive: b.subscriptionActive ?? false,
              subscriptionExpiry: b.subscriptionExpiry,
              commercialReg: b.commercialReg,
              activityScore: b.activityScore ?? 50,
              totalOrders: b.totalOrders ?? 0,
              joinedAt: b.createdAt || new Date().toISOString(),
              }));
            setButchersList(mapped);
          }
        }
      } catch (err) {
        console.warn('[ButchersScreen] Failed to fetch butchers:', err);
      }
    };
    fetchButchers();
  }, [accessToken]);

  const ranked = rankButchers(butchersList);

  const filtered = ranked.filter((b) => {
    if (selectedCountry !== 'all' && b.country !== selectedCountry) return false;
    if (showVerifiedOnly && !b.subscriptionActive) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.nameAr.includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.cityAr.includes(q) ||
        b.specialties.some((s) => s.includes(q))
      );
    }
    return true;
  });

  const storiesWithSeen = butcherStories.map((s) => ({
    ...s,
    seen: seenStories.has(s.id),
  }));

  const handleStoryPress = (story: ButcherStory) => {
    setSeenStories((prev) => new Set([...prev, story.id]));
    router.push({
      pathname: '/butchers/story-viewer',
      params: { butcherId: story.butcherId, storyId: story.id },
    });
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* ── Sticky Header ── */}
        <View style={s.stickyHeader}>
          <LinearGradient colors={[colors.bgDeep, colors.bgPrimary]} style={StyleSheet.absoluteFill} />
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>الملاحم 🥩</Text>
              <Text style={s.headerSub}>سوق الملاحم</Text>
            </View>
            <View style={s.headerActions}>
              <Pressable
                style={[s.filterBtn, showVerifiedOnly && s.filterBtnActive]}
                onPress={() => setShowVerifiedOnly((v) => !v)}
              >
                <AppIcon
                  name="shield-checkmark"
                  size={16}
                  color={showVerifiedOnly ? colors.gold : colors.textMuted}
                />
                <Text style={[s.filterBtnText, showVerifiedOnly && { color: colors.gold }]}>
                  موثّق
                </Text>
              </Pressable>
              <Pressable
                style={s.mapBtn}
                onPress={() => router.push('/butchers/map')}
              >
                <AppIcon name="map-outline" size={20} color={colors.electricBright} />
              </Pressable>
            </View>
          </View>

          {/* Search */}
          <View style={s.searchWrap}>
            <AppIcon name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="ابحث عن ملحمة، مدينة، أو نوع لحم..."
              placeholderTextColor={colors.textSubtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <AppIcon name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Country Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.countryRow}
          >
            <Pressable
              onPress={() => setSelectedCountry('all')}
              style={[s.countryChip, selectedCountry === 'all' && s.countryChipActive]}
            >
              <Text style={s.countryChipFlag}>🌍</Text>
              <Text style={[s.countryChipLabel, selectedCountry === 'all' && s.countryChipLabelActive]}>
                الكل
              </Text>
            </Pressable>
            {GCC_COUNTRIES.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => setSelectedCountry(c.code)}
                style={[s.countryChip, selectedCountry === c.code && s.countryChipActive]}
              >
                <Text style={s.countryChipFlag}>{c.flag}</Text>
                <Text style={[s.countryChipLabel, selectedCountry === c.code && s.countryChipLabelActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── Stories ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>قصص اليوم</Text>
            <View style={s.liveDotRow}>
              <View style={s.liveDot} />
              <Text style={s.sectionSub}>{storiesWithSeen.filter((s) => !s.seen).length} جديد</Text>
            </View>
          </View>
          <StoriesRow stories={storiesWithSeen} onStoryPress={handleStoryPress} />
        </View>

        {/* ── Listing ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>الملاحم ({filtered.length})</Text>
            <Pressable
              style={s.addBtn}
              onPress={() => {
                if (!isAuthenticated) {
                  router.push('/auth/phone');
                  return;
                }
                router.push('/butchers/apply');
              }}
            >
              <AppIcon name="add" size={14} color={colors.electricBright} />
              <Text style={s.addBtnText}>سجّل ملحمتك</Text>
            </Pressable>
          </View>

          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>🥩</Text>
              <Text style={s.emptyTitle}>لا توجد ملاحم</Text>
              <Text style={s.emptySub}>جرّب تغيير الفلتر أو البلد</Text>
            </View>
          ) : (
            filtered.map((butcher) => (
              <ButcherCard
                key={butcher.id}
                butcher={butcher}
                onPress={() =>
                  router.push({
                    pathname: '/butchers/[id]',
                    params: { id: butcher.id },
                  })
                }
              />
            ))
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { paddingBottom: 20 },

  // Sticky header
  stickyHeader: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.h1, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textBrand, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  filterBtnActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '22',
  },
  filterBtnText: { ...typography.caption, color: colors.textMuted },
  mapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'right',
  },

  // Country chips
  countryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  countryChipActive: {
    backgroundColor: colors.electric,
    borderColor: colors.electric,
  },
  countryChipFlag: { fontSize: 14 },
  countryChipLabel: { ...typography.caption, color: colors.textMuted },
  countryChipLabelActive: { color: '#fff', fontWeight: '600' },

  // Sections
  section: { marginTop: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  sectionSub: { ...typography.caption, color: colors.textMuted },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.electricBright + '66',
    backgroundColor: colors.electric + '11',
  },
  addBtnText: { ...typography.micro, color: colors.textBrandStrong },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...typography.h3, color: colors.textPrimary },
  emptySub: { ...typography.caption, color: colors.textMuted },
  });
}

// Stories
function createStoryStyles(colors: ThemeColors) {
  return StyleSheet.create({
  storiesContent: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    gap: 4,
    width: STORY_CIRCLE + 8,
    position: 'relative',
  },
  storyRing: {
    width: STORY_CIRCLE + 4,
    height: STORY_CIRCLE + 4,
    borderRadius: (STORY_CIRCLE + 4) / 2,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyInner: {
    width: STORY_CIRCLE,
    height: STORY_CIRCLE,
    borderRadius: STORY_CIRCLE / 2,
    borderWidth: 2,
    borderColor: colors.bgDeep,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.bgSurface,
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
  },
  storyVerifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.electricBright + '55',
  },
  storyTypeChip: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5,
    borderColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyTypeIcon: { fontSize: 10 },
  storyName: {
    ...typography.micro,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: STORY_CIRCLE + 8,
  },
  });
}

// Butcher card
function createCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  coverWrap: {
    height: 160,
    backgroundColor: colors.bgElevated,
    position: 'relative',
  },
  cover: { width: '100%', height: '100%' },
  verifiedBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  verifiedText: { ...typography.micro, color: '#1A1300', fontWeight: '700' },
  flagPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(6,9,26,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  flag: { fontSize: 14 },
  statusPill: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  statusText: { ...typography.micro, color: '#fff' },

  body: { padding: spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.borderMid,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
  },
  logo: { width: '100%', height: '100%' },
  name: { ...typography.h3, color: colors.textPrimary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText: { ...typography.caption, color: colors.textMuted },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold + '22',
    borderWidth: 1,
    borderColor: colors.gold + '44',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  ratingText: { ...typography.caption, color: colors.gold, fontWeight: '700' },

  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipText: { ...typography.micro, color: colors.textBrand },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.md,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  statText: { ...typography.micro, color: colors.textMuted, flex: 1 },
  statDivider: { width: 1, height: 14, backgroundColor: colors.borderSoft },
  });
}
