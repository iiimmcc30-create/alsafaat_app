// Powered by OnSpace.AI
// SAFAT — Live Tab (البث المباشر)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { openLiveCreateIfAllowed } from '@/lib/liveStreamAccess';
import { LiveStreamItem } from '@/components/feature/LiveStreamItem';
import { UserProfileLink } from '@/components/feature/UserProfileLink';

const LIVE_CATEGORIES = ['الكل', 'إبل', 'خيول', 'أغنام', 'صقور', 'معز'];

export default function LiveScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [streamsList, setStreamsList] = useState<any[]>([]);

  const fetchStreams = async () => {
    try {
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const res = await fetch(`${API_BASE}/api/livestreams`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStreamsList(json.data);
        }
      }
    } catch (err) {
      console.warn('[LiveScreen] Failed to fetch streams:', err);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, [accessToken]);

  const filtered =
    activeCategory === 'الكل'
      ? streamsList
      : streamsList.filter((l) => {
          const catMap: Record<string, string> = {
            'إبل': 'camels',
            'خيول': 'horses',
            'أغنام': 'sheep',
            'صقور': 'falcons',
            'معز': 'goats',
          };
          const target = catMap[activeCategory];
          return l.category?.toLowerCase() === target || l.category?.toLowerCase().includes(activeCategory);
        });

  const totalViewers = streamsList.reduce((sum, l) => sum + (l.viewers || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>مباشر</Text>
        </View>
        <Text style={styles.title}>البث المباشر</Text>
        <View style={styles.viewersWrap}>
          <AppIcon name="eye" size={14} color={colors.textMuted} />
          <Text style={styles.viewersCount}>{(totalViewers / 1000).toFixed(1)}k</Text>
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {LIVE_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
          >
            <Text style={[styles.catLabel, activeCategory === cat && styles.catLabelActive]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Live streams */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Featured (first stream large) */}
        {filtered.length > 0 && (
          <Pressable style={styles.featured} onPress={() => router.push({ pathname: '/live/watch/[id]', params: { id: filtered[0].id } } as any)}>
            <Image
              source={filtered[0].thumbnail ? { uri: filtered[0].thumbnail } : undefined}
              style={styles.featuredImg}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient
              colors={['transparent', 'rgba(6,9,26,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.liveTag}>
              <View style={styles.liveDotSmall} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
            <View style={styles.featuredContent}>
              <UserProfileLink userId={filtered[0].host?.id} style={styles.hostRow}>
                <Image source={filtered[0].host?.avatar ? { uri: filtered[0].host.avatar } : undefined} style={styles.hostAvatar} contentFit="cover" />
                <View>
                  <Text style={styles.hostName}>{filtered[0].host?.arabicName || 'مستخدم سروح'}</Text>
                  <Text style={styles.hostHandle}>@{filtered[0].host?.username || 'user'}</Text>
                </View>
              </UserProfileLink>
              <Text style={styles.featuredTitle} numberOfLines={2}>{filtered[0].arabicTitle}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <AppIcon name="eye" size={14} color={colors.textMuted} />
                  <Text style={styles.statText}>{filtered[0].viewers.toLocaleString()}</Text>
                </View>
                <View style={styles.stat}>
                  <AppIcon name="heart" size={14} color={colors.rose} />
                  <Text style={styles.statText}>{filtered[0].likes.toLocaleString()}</Text>
                </View>
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{filtered[0].category}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}

        {/* Rest of streams */}
        <View style={styles.streamsList}>
          {filtered.slice(1).map((stream) => (
            <LiveStreamItem key={stream.id} stream={stream} height={200} />
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyText}>لا يوجد بث مباشر الآن</Text>
          </View>
        )}

        <View style={{ height: 100 + insets.bottom }} />
      </ScrollView>
      {/* FAB — بدء بث جديد */}
      <Pressable
        style={[styles.fab, { bottom: Math.max(insets.bottom, spacing.lg) + 58 }]}
        onPress={() => openLiveCreateIfAllowed(router, accessToken)}
      >
        <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.fabGrad}>
          <View style={styles.fabDot} />
          <Text style={styles.fabText}>بث مباشر</Text>
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 4,
    backgroundColor: `${colors.liveRed}20`,
    borderRadius: radius.pill, borderWidth: 1, borderColor: `${colors.liveRed}40`,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.liveRed },
  liveBadgeText: { ...typography.micro, color: colors.liveRed },
  title: { ...typography.h2, color: colors.textPrimary },
  viewersWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewersCount: { ...typography.caption, color: colors.textMuted },
  catRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  catChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  catChipActive: { backgroundColor: colors.liveRed, borderColor: colors.liveRed },
  catLabel: { ...typography.caption, color: colors.textMuted },
  catLabelActive: { color: '#fff' },
  scroll: { paddingHorizontal: spacing.lg },
  featured: {
    height: 220, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.lg,
  },
  featuredImg: { ...StyleSheet.absoluteFillObject },
  liveTag: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.liveRed, borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  liveDotSmall: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveTagText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  featuredContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.lg, gap: spacing.sm,
  },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  hostAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.borderMid },
  hostName: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  hostHandle: { ...typography.micro, color: colors.textMuted },
  featuredTitle: { ...typography.h3, color: '#fff' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...typography.caption, color: colors.textMuted },
  catBadge: {
    marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: colors.bgGlass, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  catBadgeText: { ...typography.micro, color: colors.textSecondary },
  streamsList: { gap: spacing.md },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.body, color: colors.textMuted },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    borderRadius: radius.pill,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  fabDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  fabText: { ...typography.bodyStrong, color: '#fff', fontSize: 13 },
  });
}
