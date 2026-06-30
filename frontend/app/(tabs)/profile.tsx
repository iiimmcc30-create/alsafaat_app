// Powered by OnSpace.AI
// SAFAT — Profile Tab (حسابي)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useApp } from '@/hooks/useApp';
import { countries } from '@/services/types';
import { ListingCard } from '@/components/feature/ListingCard';
import { MessagesPanel } from '@/components/feature/MessagesPanel';

type ProfileTab = 'listings' | 'messages' | 'about';

const PROFILE_TABS = [
  { id: 'listings' as const, label: 'الإعلانات', icon: 'storefront-outline' },
  { id: 'messages' as const, label: 'الرسائل', icon: 'chatbubbles-outline' },
  { id: 'about' as const, label: 'عن الحساب', icon: 'information-circle-outline' },
];

const CARD = {
  backgroundColor: colors.bgSurface,
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.borderSoft,
} as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { me, listings } = useApp();
  const { subscription } = useSubscription();
  const [activeTab, setActiveTab] = useState<ProfileTab>('listings');

  useEffect(() => {
    if (tab === 'messages') setActiveTab('messages');
  }, [tab]);

  const myListings = listings.filter((l) => l.seller.id === me.id);
  const country = countries[me.country];
  const listingsLeft = Math.max(subscription.plan.listingsPerMonth - subscription.listingsUsed, 0);
  const liveMinutesLeft = Math.max(subscription.plan.liveMinutesPerWeek - subscription.liveMinutesUsed, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={styles.scrollView}
      >
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#0B1330', '#162149', '#1E3A8A']}
            style={styles.cover}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Pressable
            style={styles.editCoverBtn}
            onPress={() => router.push('/profile/edit')}
          >
            <Ionicons name="camera-outline" size={16} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}>
                <Image source={{ uri: me.avatar }} style={styles.avatar} contentFit="cover" />
              </View>
              {me.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.electricBright} />
                </View>
              )}
            </View>

            <View style={styles.headerBtns}>
              <Pressable style={styles.editBtn} onPress={() => router.push('/profile/edit')}>
                <Text style={styles.editBtnText}>تعديل الملف</Text>
              </Pressable>
              <Pressable
                style={styles.shareBtn}
                onPress={() => {
                  Share.share({
                    message: `تفقّد بروفايل ${me.arabicName} في تطبيق الصفاة 🐪\nhttps://alsfat.com/u/${me.username}`,
                    title: 'الصفاة — سوق الثروة الحيوانية',
                  });
                }}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{me.arabicName}</Text>
              {me.verified && (
                <Ionicons name="checkmark-circle" size={20} color={colors.electricBright} />
              )}
            </View>
            <Text style={styles.englishName}>{me.displayName}</Text>
            <Text style={styles.handle}>@{me.username}</Text>
            {me.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}
            <View style={styles.locationRow}>
              <Text style={styles.flag}>{country.flag}</Text>
              <Text style={styles.locationText}>{country.ar}</Text>
            </View>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{me.followers.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLabel}>متابعون</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{myListings.length}</Text>
              <Text style={styles.statLabel}>إعلانات</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>★ {me.rating}</Text>
              <Text style={styles.statLabel}>تقييم</Text>
            </View>
          </View>

          <Pressable style={styles.planCard} onPress={() => router.push('/subscription')}>
            <View style={styles.planTop}>
              <View style={styles.planLock}>
                <MaterialCommunityIcons name="lock-outline" size={20} color={colors.gold} />
              </View>
              <View style={styles.planMain}>
                <Text style={styles.planLabel}>باقتك الحالية</Text>
                <Text style={styles.planName}>{subscription.plan.arabicName}</Text>
              </View>
              <View style={styles.upgradeBtn}>
                <Ionicons name="arrow-up" size={14} color={colors.electricBright} />
                <Text style={styles.upgradeText}>ترقية</Text>
              </View>
            </View>
            <View style={styles.planBottom}>
              <Text style={styles.planStat}>{listingsLeft} إعلانات متبقية</Text>
              <Text style={styles.planStat}>{liveMinutesLeft} دقيقة بث</Text>
            </View>
          </Pressable>

          <View style={styles.tabs}>
            {PROFILE_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={styles.tabItem}
                >
                  <Ionicons
                    name={tab.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={active ? colors.electricBright : colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {active && <View style={styles.tabIndicator} />}
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'listings' && (
            <View>
              {myListings.length > 0 && (
                <View style={styles.listingsHeader}>
                  <Text style={styles.listingsCount}>{myListings.length} إعلان</Text>
                  <Pressable
                    style={styles.addListingSmallBtn}
                    onPress={() => router.push('/create/listing')}
                  >
                    <Ionicons name="add" size={16} color={colors.electricBright} />
                    <Text style={styles.addListingSmallText}>إعلان جديد</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.listingsGrid}>
              {myListings.map((listing) => (
                <View key={listing.id} style={styles.listingItem}>
                  <ListingCard
                    listing={listing}
                    variant="profile"
                    onPress={() =>
                      router.push({ pathname: '/listing/[id]', params: { id: listing.id } })
                    }
                  />
                </View>
              ))}
              {myListings.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyText}>لا توجد إعلانات بعد</Text>
                  <Pressable
                    style={styles.addListingBtn}
                    onPress={() => router.push('/create/listing')}
                  >
                    <Text style={styles.addListingText}>+ أضف إعلانًا</Text>
                  </Pressable>
                </View>
              )}
            </View>
            </View>
          )}

          {activeTab === 'messages' && (
            <MessagesPanel variant="embedded" />
          )}

          {activeTab === 'about' && (
            <View style={styles.aboutCard}>
              {[
                { icon: 'star-outline', label: 'التقييم', value: `${me.rating} / 5.0 ⭐` },
                { icon: 'earth', label: 'الدولة', value: `${country.flag} ${country.ar}` },
                {
                  icon: 'shield-checkmark-outline',
                  label: 'الحالة',
                  value: me.verified ? '✅ موثّق' : '🔓 غير موثّق',
                },
                {
                  icon: 'people-outline',
                  label: 'عدد المتابعين',
                  value: me.followers.toLocaleString('ar-SA'),
                },
              ].map((item, idx, arr) => (
                <View
                  key={item.label}
                  style={[styles.aboutRow, idx < arr.length - 1 && styles.aboutRowBorder]}
                >
                  <Ionicons
                    name={item.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={colors.glow}
                  />
                  <Text style={styles.aboutLabel}>{item.label}</Text>
                  <Text style={styles.aboutValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  scrollView: { flex: 1 },
  scroll: { paddingBottom: spacing.md },
  heroSection: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  cover: {
    height: 150,
    width: '100%',
  },
  editCoverBtn: {
    position: 'absolute',
    bottom: spacing.xl + 20,
    right: spacing.lg,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMid,
    zIndex: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: -40,
    zIndex: 3,
  },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.electricBright,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgDeep,
  },
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  editBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  editBtnText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  info: {
    gap: 4,
    marginBottom: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 24,
  },
  englishName: {
    ...typography.body,
    color: colors.glow,
  },
  handle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  flag: { fontSize: 14 },
  locationText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statsCard: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  statLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderSoft,
  },
  planCard: {
    ...CARD,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planLock: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planMain: {
    flex: 1,
  },
  planLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  planName: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  planBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  planStat: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: `${colors.electric}18`,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  upgradeText: {
    ...typography.micro,
    color: colors.electricBright,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  tabLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.electricBright,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.electricBright,
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  listingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  listingsCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  addListingSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  addListingSmallText: {
    ...typography.caption,
    color: colors.electricBright,
    fontWeight: '600',
  },
  listingItem: {
    width: '47.5%',
  },
  empty: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.xxxl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.body, color: colors.textMuted },
  addListingBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.royal,
    borderWidth: 1,
    borderColor: colors.electric,
  },
  addListingText: { ...typography.bodyStrong, color: colors.electricBright },
  aboutCard: {
    ...CARD,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  aboutRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  aboutLabel: {
    flex: 1,
    ...typography.body,
    color: colors.textSecondary,
  },
  aboutValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  bottomSpacer: { height: 100 },
});
