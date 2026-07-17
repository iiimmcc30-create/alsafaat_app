// Powered by OnSpace.AI
// SAFAT — Market Tab (السوق)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlDirection, rtlRow } from '@/lib/rtl';
import { countries, Country, Listing } from '@/services/types';
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

  // ──────────────────────────────────────────────────────
  // منطق الفلترة — لم يتغير
  // ──────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────
  // FlatList — كل صف إعلان ضيق
  // ──────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Listing>) => (
      <ListingCard
        listing={item}
        variant="list"
        onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback((item: Listing) => item.id, []);

  const ItemSeparator = useCallback(() => null, []);

  const ListEmpty = (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyText}>لا توجد إعلانات مطابقة</Text>
    </View>
  );

  // الهيدر داخل FlatList حتى يتحرك مع القائمة
  const ListHeader = (
    <View>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>السوق</Text>
          <Text style={styles.pageSubtitle}>اكتشف أحدث الإعلانات من مجتمع سرح</Text>
        </View>
        <View style={styles.marketIcon}>
          <AppIcon name="tags" size={22} color={colors.electricBright} />
        </View>
      </View>

      {/* شريط البحث */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <AppIcon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث عن حيوانات، أعلاف..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <AppIcon name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterBtn, showFeaturedOnly && styles.filterBtnActive]}
          onPress={() => setShowFeaturedOnly(!showFeaturedOnly)}
        >
          <AppIcon name="star" size={16} color={showFeaturedOnly ? colors.gold : colors.textMuted} />
        </Pressable>
      </View>

      {/* أقسام الفئات */}
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

      {/* فلتر الدولة */}
      <CountryChips value={activeCountry} onChange={setActiveCountry} />

      {/* رأس القائمة */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {showFeaturedOnly ? '⭐ المميزة' : 'جميع الإعلانات'}
        </Text>
        <Text style={styles.count}>{filtered.length} إعلان</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, rtlDirection]} edges={['top']}>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={<View style={{ height: 80 }} />}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={8}
      />
    </SafeAreaView>
  );
}

function createMarketStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDeep },
    pageHeader: {
      ...rtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    pageTitle: { ...typography.h1, color: colors.textPrimary },
    pageSubtitle: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    marketIcon: {
      width: 46,
      height: 46,
      borderRadius: radius.lg,
      backgroundColor: colors.bgGlass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMid,
      alignItems: 'center',
      justifyContent: 'center',
    },

    searchRow: {
      ...rtlRow,
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    searchBox: {
      flex: 1,
      ...rtlRow,
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgGlassStrong,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.md,
      minHeight: 52,
      borderWidth: StyleSheet.hairlineWidth,
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
      width: 52, height: 52, borderRadius: radius.lg,
      backgroundColor: colors.bgGlassStrong,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft,
    },
    filterBtnActive: { borderColor: colors.gold, backgroundColor: `${colors.gold}15` },

    catRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
    catChip: {
      ...rtlRow,
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md, minHeight: 38,
      borderRadius: radius.pill,
      backgroundColor: colors.bgGlassStrong,
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft,
    },
    catChipActive: { backgroundColor: colors.royal, borderColor: colors.electric },
    catIcon: { fontSize: 14 },
    catLabel: { ...typography.caption, color: colors.textMuted },
    catLabelActive: { color: colors.textBrandStrong },

    sectionHeader: {
      ...rtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    sectionTitle: { ...typography.h3, color: colors.textPrimary },
    count: { ...typography.caption, color: colors.textMuted },

    separator: {
      height: 1,
      backgroundColor: colors.borderHairline,
      marginHorizontal: spacing.md,
    },

    empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
    emptyIcon: { fontSize: 40 },
    emptyText: { ...typography.body, color: colors.textMuted },
  });
}
