// Powered by OnSpace.AI
// SAFAT — Search Screen (البحث)

import { Ionicons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Platform,
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
import { rtlBackIcon, rtlRow } from '@/lib/rtl';
import { ListingCard } from '@/components/feature/ListingCard';
import { UserProfileLink } from '@/components/feature/UserProfileLink';
import { useApp } from '@/hooks/useApp';
import { API_BASE } from '@/services/api';

type SearchFilter = 'all' | 'listings' | 'users' | 'live';

export default function SearchScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { listings } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);

  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbLiveStreams, setDbLiveStreams] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/search/trending`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.trending) {
          setTrendingTags(json.data.trending);
        }
      })
      .catch(() => {});
  }, []);

  // Load saved searches on mount
  useEffect(() => {
    AsyncStorage.getItem('safat_recent_searches').then((val) => {
      if (val) setRecentSearches(JSON.parse(val));
    }).catch(() => {});
  }, []);

  // Fetch users & livestreams dynamically
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const url = query.trim()
          ? `${API_BASE}/api/users?search=${encodeURIComponent(query)}`
          : `${API_BASE}/api/users`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setDbUsers(json.data);
          }
        }
      } catch (err) {
        console.warn('[SearchScreen] fetchUsers failed:', err);
      }
    };

    const fetchLiveStreams = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/livestreams`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setDbLiveStreams(json.data);
          }
        }
      } catch (err) {
        console.warn('[SearchScreen] fetchLiveStreams failed:', err);
      }
    };

    fetchUsers();
    fetchLiveStreams();
  }, [query]);

  // Save searches whenever they change
  const saveRecent = (searches: string[]) => {
    setRecentSearches(searches);
    AsyncStorage.setItem('safat_recent_searches', JSON.stringify(searches)).catch(() => {});
  };

  const addRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter((r) => r !== term)].slice(0, 10);
    saveRecent(updated);
  };

  const hasQuery = query.trim().length > 0;

  const filteredListings = listings.filter((l) => {
    const q = query.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.arabicTitle.includes(q) ||
      l.arabicLocation.includes(q)
    );
  });

  const filteredUsers = dbUsers;

  const filteredLive = dbLiveStreams.filter((l) => {
    const q = query.toLowerCase();
    return (l.arabicTitle || '').includes(q) || (l.title || '').toLowerCase().includes(q);
  });

  const FILTERS: { id: SearchFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'listings', label: 'الإعلانات' },
    { id: 'users', label: 'الحسابات' },
    { id: 'live', label: 'البث المباشر' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.searchBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث في صفاة..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            returnKeyType="search"
            textAlign="right"
            onSubmitEditing={() => { if (query.trim()) addRecentSearch(query.trim()); }}
          />
          {hasQuery && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {hasQuery && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, filter === f.id && styles.filterLabelActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!hasQuery ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>البحث الأخير</Text>
                <Pressable onPress={() => saveRecent([])}>
                  <Text style={styles.clearText}>مسح الكل</Text>
                </Pressable>
              </View>
              {recentSearches.map((term) => (
                <Pressable key={term} style={styles.recentRow} onPress={() => setQuery(term)}>
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.recentText}>{term}</Text>
                  <Pressable onPress={() => saveRecent(recentSearches.filter((r) => r !== term))} hitSlop={8} style={{ marginLeft: 'auto' }}>
                    <Ionicons name="close" size={14} color={colors.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔥 الأكثر تداولاً</Text>
            {trendingTags.length === 0 ? (
              <Text style={{ color: colors.textMuted, ...typography.caption, textAlign: 'right' }}>
                لا توجد هاشتاقات رائجة حالياً
              </Text>
            ) : (
            <View style={styles.trendingGrid}>
              {trendingTags.map((item) => (
                <Pressable key={item.tag} style={styles.trendingChip} onPress={() => setQuery(item.tag)}>
                  <Text style={styles.trendingText}>{item.tag}</Text>
                </Pressable>
              ))}
            </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 أبرز المربّين</Text>
            {dbUsers.slice(0, 4).map((user) => (
              <Pressable
                key={user.id}
                style={styles.userRow}
                onPress={() => router.push({ pathname: '/users/[id]', params: { id: user.id } } as any)}
              >
                <Image source={user.avatar ? { uri: user.avatar } : undefined} style={styles.userAvatar} contentFit="cover" />
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{user.arabicName || user.displayName || user.username}</Text>
                    {user.verified && <Ionicons name="checkmark-circle" size={13} color={colors.electricBright} />}
                  </View>
                  <Text style={styles.userHandle}>@{user.username}</Text>
                </View>
                <Text style={styles.followersText}>{((user.followers || 0) / 1000).toFixed(1)}k</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ height: 80 }} />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {(filter === 'all' || filter === 'listings') && filteredListings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>الإعلانات ({filteredListings.length})</Text>
              <View style={styles.listingsGrid}>
                {filteredListings.slice(0, 6).map((l) => (
                  <View key={l.id} style={styles.listingItem}>
                    <ListingCard
                      listing={l}
                      variant="grid"
                      onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}

          {(filter === 'all' || filter === 'users') && filteredUsers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>المستخدمون ({filteredUsers.length})</Text>
              {filteredUsers.map((user) => (
                <Pressable
                  key={user.id}
                  style={styles.userRow}
                  onPress={() => router.push({ pathname: '/users/[id]', params: { id: user.id } } as any)}
                >
                  <Image source={user.avatar ? { uri: user.avatar } : undefined} style={styles.userAvatar} contentFit="cover" />
                  <View style={styles.userInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.userName}>{user.arabicName || user.displayName || user.username}</Text>
                      {user.verified && <Ionicons name="checkmark-circle" size={13} color={colors.electricBright} />}
                    </View>
                    <Text style={styles.userHandle}>@{user.username}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {(filter === 'all' || filter === 'live') && filteredLive.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>بث مباشر ({filteredLive.length})</Text>
              {filteredLive.map((l) => (
                <View key={l.id} style={styles.liveRow}>
                  <Image source={l.thumbnail ? { uri: l.thumbnail } : undefined} style={styles.liveThumbnail} contentFit="cover" />
                  <View style={styles.liveInfo}>
                    <Text style={styles.liveTitle} numberOfLines={2}>{l.arabicTitle || l.title}</Text>
                    <UserProfileLink userId={l.host?.id}>
                      <Text style={styles.liveHost}>{l.host?.arabicName || l.host?.displayName || 'عميل صفاة'}</Text>
                    </UserProfileLink>
                    <View style={styles.liveStats}>
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>LIVE</Text>
                      </View>
                      <Text style={styles.liveViewers}>{(l.viewers || 0).toLocaleString()} مشاهد</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {filteredListings.length === 0 && filteredUsers.length === 0 && filteredLive.length === 0 && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsIcon}>🔍</Text>
              <Text style={styles.noResultsText}>لا توجد نتائج لـ "{query}"</Text>
              <Text style={styles.noResultsSub}>جرّب كلمات مختلفة</Text>
            </View>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  input: {
    flex: 1, ...typography.body, color: colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  filterRow: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  filterChipActive: { backgroundColor: colors.royal, borderColor: colors.electric },
  filterLabel: { ...typography.caption, color: colors.textMuted },
  filterLabelActive: { color: colors.textBrandStrong },
  scroll: { paddingBottom: 20 },
  section: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  clearText: { ...typography.caption, color: colors.textBrandStrong },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  recentText: { ...typography.body, color: colors.textSecondary, flex: 1, textAlign: 'right' },
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trendingChip: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: `${colors.electric}15`,
    borderWidth: 1, borderColor: `${colors.electric}30`,
  },
  trendingText: { ...typography.caption, color: colors.textBrandStrong },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.borderMid },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userName: { ...typography.bodyStrong, color: colors.textPrimary },
  userHandle: { ...typography.caption, color: colors.textMuted },
  followersText: { ...typography.caption, color: colors.textSecondary },
  listingsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  listingItem: { width: '47%' },
  liveRow: {
    flexDirection: 'row', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  liveThumbnail: { width: 80, height: 60, borderRadius: radius.md },
  liveInfo: { flex: 1, gap: 4 },
  liveTitle: { ...typography.caption, color: colors.textPrimary, textAlign: 'right', lineHeight: 18 },
  liveHost: { ...typography.micro, color: colors.textMuted },
  liveStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.liveRed, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  liveViewers: { ...typography.micro, color: colors.textMuted },
  noResults: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  noResultsIcon: { fontSize: 48 },
  noResultsText: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
  noResultsSub: { ...typography.body, color: colors.textMuted },
  });
}
