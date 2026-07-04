// Powered by OnSpace.AI
// SAFAT — Market Tab (السوق)

import { Ionicons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlDirection, rtlRow } from '@/lib/rtl';
import { countries, Country } from '@/services/types';
import { ListingCard } from '@/components/feature/ListingCard';
import { CountryChips } from '@/components/feature/CountryChips';
import { useApp } from '@/hooks/useApp';

const CATEGORIES = [
  { id: 'all', ar: 'الكل', icon: '🔘' },
  { id: 'camels', ar: 'إبل', icon: '🐪' },
  { id: 'sheep', ar: 'أغنام', icon: '🐑' },
  { id: 'horses', ar: 'خيول', icon: '🐎' },
  { id: 'goats', ar: 'معز', icon: '🐐' },
  { id: 'cows', ar: 'بقر', icon: '🐄' },
  { id: 'birds', ar: 'طيور', icon: '🦅' },
  { id: 'feed', ar: 'علف', icon: '🌾' },
  { id: 'equipment', ar: 'معدات', icon: '⚙️' },
];

export default function MarketScreen() {
  const router = useRouter();
  const styles = useThemedStyles(({ colors }) => createMarketStyles(colors));
  const { listings } = useApp();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCountry, setActiveCountry] = useState<Country | 'ALL'>('ALL');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  const filtered = listings.filter((l) => {
    if (activeCategory !== 'all' && l.category !== activeCategory) return false;
    if (activeCountry !== 'ALL' && l.country !== activeCountry) return false;
    if (showFeaturedOnly && !l.featured) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.title.toLowerCase().includes(q) ||
        l.arabicTitle.includes(q) ||
        l.arabicLocation.includes(q)
      );
    }
    return true;
  });

  const featured = filtered.filter((l) => l.featured);

  return (
    <SafeAreaView style={[styles.container, rtlDirection]} edges={['top']}>
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث عن حيوانات، أعلاف..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterBtn, showFeaturedOnly && styles.filterBtnActive]}
          onPress={() => setShowFeaturedOnly(!showFeaturedOnly)}
        >
          <Ionicons name="star" size={16} color={showFeaturedOnly ? colors.gold : colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.catRow, rtlDirection]}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[styles.catChip, activeCategory === cat.id && styles.catChipActive]}
            >
              <Text style={styles.catIcon}>{cat.icon}</Text>
              <Text style={[styles.catLabel, activeCategory === cat.id && styles.catLabelActive]}>
                {cat.ar}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Country filter */}
        <CountryChips value={activeCountry} onChange={setActiveCountry} />

        {/* Featured */}
        {featured.length > 0 && !showFeaturedOnly && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>⭐ الإعلانات المميزة</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.featuredRow, rtlDirection]}
            >
              {featured.map((l) => (
                <View key={l.id} style={styles.featuredItem}>
                  <ListingCard
                    listing={l}
                    variant="feature"
                    onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* All listings grid */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {showFeaturedOnly ? '⭐ المميزة' : 'جميع الإعلانات'}
            </Text>
            <Text style={styles.count}>{filtered.length} إعلان</Text>
          </View>
          <View style={styles.grid}>
            {filtered.map((l) => (
              <View key={l.id} style={styles.gridItem}>
                <ListingCard
                  listing={l}
                  variant="grid"
                  onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
                />
              </View>
            ))}
          </View>
          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>لا توجد إعلانات مطابقة</Text>
            </View>
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createMarketStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  searchRow: {
    ...rtlRow,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
  },
  searchBox: {
    flex: 1,
    ...rtlRow,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  filterBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  filterBtnActive: { borderColor: colors.gold, backgroundColor: `${colors.gold}15` },
  catRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  catChip: {
    ...rtlRow,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  catChipActive: { backgroundColor: colors.royal, borderColor: colors.electric },
  catIcon: { fontSize: 14 },
  catLabel: { ...typography.caption, color: colors.textMuted },
  catLabelActive: { color: colors.textBrandStrong },
  sectionWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionHeader: {
    ...rtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  count: { ...typography.caption, color: colors.textMuted },
  featuredRow: { gap: spacing.md, paddingBottom: spacing.sm },
  featuredItem: { width: 280 },
  grid: {
    ...rtlRow,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: { width: '47%' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.body, color: colors.textMuted },
  });
}
