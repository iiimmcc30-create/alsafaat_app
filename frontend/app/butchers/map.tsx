// Powered by OnSpace.AI
// SAFAT — Butchers Map Screen (خريطة الملاحم)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';
import { useEffect } from 'react';
import {
  ButcherProfile,
  Country,
  gccCurrencies,
  rankButchers,
} from '@/services/butcherData';
import { countries } from '@/services/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { hasValidCoords, COUNTRY_MAP_CENTER } from '@/lib/butcherLocation';
import { isNativeMapsEnabled } from '@/lib/maps';
import { NativeButchersMap } from '@/components/feature/NativeButchersMap';

// ─── Map pin layout coordinates (% of map container) ─────────────────────────────
const GCC_COORDINATES: Record<Country, { x: number; y: number }> = {
  SA: { x: 44, y: 48 },
  AE: { x: 52, y: 38 },
  KW: { x: 42, y: 32 },
  QA: { x: 50, y: 42 },
  BH: { x: 46, y: 40 },
  OM: { x: 56, y: 50 },
  EG: { x: 38, y: 28 },
};

function getPinPosition(butcher: ButcherProfile): { x: number; y: number } {
  if (hasValidCoords(butcher.lat, butcher.lng)) {
    const minLat = 12;
    const maxLat = 32;
    const minLng = 34;
    const maxLng = 60;
    const x = ((butcher.lng - minLng) / (maxLng - minLng)) * 80 + 10;
    const y = ((maxLat - butcher.lat) / (maxLat - minLat)) * 80 + 10;
    return {
      x: Math.min(Math.max(x, 8), 92),
      y: Math.min(Math.max(y, 8), 92),
    };
  }

  const countryPos = GCC_COORDINATES[butcher.country] ?? { x: 50, y: 50 };
  
  // Deterministic offset based on ID string to avoid exact overlap
  let hash = 0;
  for (let i = 0; i < butcher.id.length; i++) {
    hash = butcher.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const jitterX = (hash % 10) - 5; // -5% to +5%
  const jitterY = ((hash >> 4) % 10) - 5;

  return {
    x: Math.min(Math.max(countryPos.x + jitterX, 10), 90),
    y: Math.min(Math.max(countryPos.y + jitterY, 10), 90),
  };
}

// ─── Map pin component ────────────────────────────────────────────────────────
function MapPin({
  butcher,
  selected,
  onPress,
}: {
  butcher: ButcherProfile;
  selected: boolean;
  onPress: () => void;
}) {
  const pos = getPinPosition(butcher);

  return (
    <Pressable
      onPress={onPress}
      style={[
        mp.pin,
        { left: `${pos.x}%`, top: `${pos.y}%` },
        selected && mp.pinSelected,
      ]}
    >
      {butcher.subscriptionActive ? (
        <LinearGradient
          colors={[colors.gold, '#F59E0B']}
          style={mp.pinInner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="shield-checkmark" size={11} color="#1A1300" />
        </LinearGradient>
      ) : (
        <View style={[mp.pinInner, { backgroundColor: colors.electric }]}>
          <Text style={mp.pinIcon}>🥩</Text>
        </View>
      )}
      <View style={mp.pinTail} />
      {selected && (
        <View style={mp.pinLabel}>
          <Text style={mp.pinLabelText} numberOfLines={1}>
            {butcher.nameAr.split(' ').slice(0, 2).join(' ')}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Butcher bottom card ──────────────────────────────────────────────────────
function BottomCard({
  butcher,
  onProfile,
  onChat,
  onOrder,
}: {
  butcher: ButcherProfile;
  onProfile: () => void;
  onChat: () => void;
  onOrder: () => void;
}) {
  const currency = gccCurrencies[butcher.country];
  const country = countries[butcher.country];

  return (
    <View style={bc.card}>
      <LinearGradient
        colors={[colors.bgSurface, colors.bgElevated]}
        style={StyleSheet.absoluteFill}
      />
      {/* Header row */}
      <View style={bc.header}>
        <Image source={{ uri: butcher.logo }} style={bc.logo} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <View style={bc.nameRow}>
            <Text style={bc.name} numberOfLines={1}>{butcher.nameAr}</Text>
            {butcher.subscriptionActive && (
              <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
            )}
          </View>
          <View style={bc.locationRow}>
            <Text style={bc.countryFlag}>{country.flag}</Text>
            <Text style={bc.location}>{butcher.cityAr} · {country.ar}</Text>
          </View>
        </View>
        <View style={bc.ratingBadge}>
          <Ionicons name="star" size={12} color={colors.gold} />
          <Text style={bc.rating}>{butcher.rating.toFixed(1)}</Text>
        </View>
      </View>

      {/* Status + hours */}
      <View style={bc.infoRow}>
        <View style={[
          bc.statusPill,
          { backgroundColor: butcher.workingHours.isOpen ? colors.success + '22' : colors.danger + '22' },
        ]}>
          <View style={[
            bc.statusDot,
            { backgroundColor: butcher.workingHours.isOpen ? colors.success : colors.danger },
          ]} />
          <Text style={[
            bc.statusText,
            { color: butcher.workingHours.isOpen ? colors.success : colors.danger },
          ]}>
            {butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}
          </Text>
        </View>
        <View style={bc.hoursPill}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={bc.hoursText}>{butcher.workingHours.open}–{butcher.workingHours.close}</Text>
        </View>
        <View style={bc.completionPill}>
          <MaterialCommunityIcons name="check-circle-outline" size={12} color={colors.electricBright} />
          <Text style={bc.completionText}>{butcher.orderCompletionRate}%</Text>
        </View>
        <Text style={bc.currencyText}>{currency.symbol}</Text>
      </View>

      {/* Specialties */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={bc.chipsRow}>
          {butcher.specialties.map((s, i) => (
            <View key={i} style={bc.chip}>
              <Text style={bc.chipText}>{s}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={bc.actions}>
        <Pressable style={bc.chatBtn} onPress={onChat}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.electricBright} />
          <Text style={bc.chatBtnText}>محادثة</Text>
        </Pressable>
        <Pressable style={bc.orderBtn} onPress={onOrder}>
          <LinearGradient
            colors={[colors.electric, colors.cyan]}
            style={bc.orderBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="bag-add-outline" size={16} color="#fff" />
            <Text style={bc.orderBtnText}>اطلب الآن</Text>
          </LinearGradient>
        </Pressable>
        <Pressable style={bc.profileBtn} onPress={onProfile}>
          <Text style={bc.profileBtnText}>الملف الكامل</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.electricBright} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ButchersMapScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<Country | 'all'>('all');
  const [butchersList, setButchersList] = useState<ButcherProfile[]>([]);

  useEffect(() => {
    const fetchButchers = async () => {
      try {
        const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const res = await fetch(`${API_BASE}/api/butchers`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.butchers) {
            const mapped = json.data.butchers.map((b: any) => ({
              id: b.id,
              name: b.nameEn,
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
              bio: b.bioEn || '',
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
        console.warn('[ButchersMapScreen] Failed to fetch butchers:', err);
      }
    };
    fetchButchers();
  }, [accessToken]);

  const ranked = rankButchers(butchersList);
  const filtered = countryFilter === 'all'
    ? ranked
    : ranked.filter((b) => b.country === countryFilter);

  const mappableButchers = filtered.filter((b) => hasValidCoords(b.lat, b.lng));
  const selectedButcher = filtered.find((b) => b.id === selectedId) ?? null;

  const mapRegion = useMemo(() => {
    if (selectedButcher && hasValidCoords(selectedButcher.lat, selectedButcher.lng)) {
      return {
        latitude: selectedButcher.lat,
        longitude: selectedButcher.lng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    if (mappableButchers.length > 0) {
      const avgLat = mappableButchers.reduce((s, b) => s + b.lat, 0) / mappableButchers.length;
      const avgLng = mappableButchers.reduce((s, b) => s + b.lng, 0) / mappableButchers.length;
      return {
        latitude: avgLat,
        longitude: avgLng,
        latitudeDelta: 0.45,
        longitudeDelta: 0.45,
      };
    }
    const center = countryFilter !== 'all'
      ? COUNTRY_MAP_CENTER[countryFilter as Country]
      : COUNTRY_MAP_CENTER.SA;
    return {
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: center.delta * 2.5,
      longitudeDelta: center.delta * 2.5,
    };
  }, [mappableButchers, selectedButcher, countryFilter]);

  const GCC: { code: Country | 'all'; flag: string; label: string }[] = [
    { code: 'all', flag: '🌍', label: 'الكل' },
    { code: 'SA',  flag: '🇸🇦', label: 'السعودية' },
    { code: 'AE',  flag: '🇦🇪', label: 'الإمارات' },
    { code: 'KW',  flag: '🇰🇼', label: 'الكويت'   },
    { code: 'QA',  flag: '🇶🇦', label: 'قطر'       },
    { code: 'BH',  flag: '🇧🇭', label: 'البحرين'   },
    { code: 'OM',  flag: '🇴🇲', label: 'عُمان'     },
    { code: 'EG',  flag: '🇪🇬', label: 'مصر'       },
  ];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>خريطة الملاحم</Text>
          <Text style={s.headerSub}>{filtered.length} ملحمة في الخليج</Text>
        </View>
        <Pressable onPress={() => router.push('/butchers')} style={s.listBtn}>
          <MaterialCommunityIcons name="view-list" size={20} color={colors.electricBright} />
        </Pressable>
      </View>

      {/* Country filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
      >
        {GCC.map((c) => (
          <Pressable
            key={c.code}
            onPress={() => { setCountryFilter(c.code as Country | 'all'); setSelectedId(null); }}
            style={[s.filterChip, countryFilter === c.code && s.filterChipActive]}
          >
            <Text style={s.filterFlag}>{c.flag}</Text>
            <Text style={[s.filterLabel, countryFilter === c.code && s.filterLabelActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Map area */}
      <View style={s.mapContainer}>
        {Platform.OS !== 'web' && isNativeMapsEnabled() && mappableButchers.length > 0 ? (
          <NativeButchersMap
            region={mapRegion}
            butchers={mappableButchers}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <>
        {/* SVG-style map background of GCC region */}
        <LinearGradient
          colors={['#0B1A4E', '#102260', '#0B1A4E']}
          style={StyleSheet.absoluteFill}
        />
        {/* Grid lines (simulated map grid) */}
        {[...Array(8)].map((_, i) => (
          <View key={`h${i}`} style={[s.gridLine, s.gridLineH, { top: `${(i + 1) * 11}%` }]} />
        ))}
        {[...Array(8)].map((_, i) => (
          <View key={`v${i}`} style={[s.gridLine, s.gridLineV, { left: `${(i + 1) * 11}%` }]} />
        ))}

        {/* Region label */}
        <View style={s.regionLabel}>
          <Text style={s.regionText}>الخليج العربي · GCC Region</Text>
        </View>

        {/* Map pins */}
        {filtered.map((butcher) => (
          <MapPin
            key={butcher.id}
            butcher={butcher}
            selected={selectedId === butcher.id}
            onPress={() => setSelectedId(selectedId === butcher.id ? null : butcher.id)}
          />
        ))}
          </>
        )}

        {/* Legend */}
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.gold }]} />
            <Text style={s.legendText}>موثّق</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.electric }]} />
            <Text style={s.legendText}>عادي</Text>
          </View>
        </View>

        {/* Tap hint if nothing selected */}
        {!selectedId && (
          <View style={s.tapHint}>
            <MaterialCommunityIcons name="gesture-tap" size={16} color={colors.textMuted} />
            <Text style={s.tapHintText}>اضغط على أي دبوس لعرض تفاصيل الملحمة</Text>
          </View>
        )}
      </View>

      {/* Bottom card / list */}
      {selectedButcher ? (
        <BottomCard
          butcher={selectedButcher}
          onProfile={() =>
            router.push({ pathname: '/butchers/[id]', params: { id: selectedButcher.id } })
          }
          onChat={() =>
            router.push({ pathname: '/butchers/chat', params: { butcherId: selectedButcher.id } })
          }
          onOrder={() =>
            router.push({ pathname: '/butchers/order', params: { butcherId: selectedButcher.id } })
          }
        />
      ) : (
        /* Mini list when nothing selected */
        <View style={s.miniList}>
          <Text style={s.miniListTitle}>أقرب الملاحم</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.miniListRow}
          >
            {filtered.slice(0, 5).map((b) => {
              const ctr = countries[b.country];
              return (
                <Pressable
                  key={b.id}
                  style={s.miniCard}
                  onPress={() => setSelectedId(b.id)}
                >
                  <LinearGradient
                    colors={[colors.bgSurface, colors.bgElevated]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Image source={{ uri: b.logo }} style={s.miniLogo} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniName} numberOfLines={1}>{b.nameAr}</Text>
                    <View style={s.miniMeta}>
                      <Text style={s.miniFlag}>{ctr.flag}</Text>
                      <Text style={s.miniCity}>{b.cityAr}</Text>
                      {b.subscriptionActive && (
                        <Ionicons name="shield-checkmark" size={11} color={colors.gold} />
                      )}
                    </View>
                  </View>
                  <View style={s.miniRating}>
                    <Ionicons name="star" size={11} color={colors.gold} />
                    <Text style={s.miniRatingText}>{b.rating.toFixed(1)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.glow, marginTop: 1 },
  listBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
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
  filterChipActive: {
    backgroundColor: colors.electric,
    borderColor: colors.electric,
  },
  filterFlag: { fontSize: 13 },
  filterLabel: { ...typography.caption, color: colors.textMuted },
  filterLabelActive: { color: '#fff', fontWeight: '600' },

  // Map
  mapContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderMid,
    marginBottom: spacing.md,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(125,211,252,0.05)',
  },
  gridLineH: { left: 0, right: 0, height: 1 },
  gridLineV: { top: 0, bottom: 0, width: 1 },
  regionLabel: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(6,9,26,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  regionText: { ...typography.micro, color: colors.textMuted },
  legend: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: 'rgba(6,9,26,0.8)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.micro, color: colors.textMuted },
  tapHint: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6,9,26,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tapHintText: { ...typography.caption, color: colors.textMuted },

  // Mini list
  miniList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  miniListTitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  miniListRow: { flexDirection: 'row', gap: spacing.sm },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 220,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  miniLogo: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgElevated },
  miniName: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  miniMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  miniFlag: { fontSize: 11 },
  miniCity: { ...typography.micro, color: colors.textMuted },
  miniRating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  miniRatingText: { ...typography.micro, color: colors.gold, fontWeight: '700' },
});

// Map pin styles
const mp = StyleSheet.create({
  pin: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
    transform: [{ translateX: -18 }, { translateY: -38 }],
  },
  pinSelected: { zIndex: 20 },
  pinInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pinIcon: { fontSize: 14 },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -2,
  },
  pinLabel: {
    backgroundColor: 'rgba(6,9,26,0.9)',
    borderWidth: 1,
    borderColor: colors.borderMid,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    maxWidth: 120,
  },
  pinLabelText: { ...typography.micro, color: colors.textPrimary },
});

// Bottom card styles
const bc = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderMid,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5, borderColor: colors.borderMid,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  countryFlag: { fontSize: 13 },
  location: { ...typography.caption, color: colors.textMuted },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.gold + '22',
    borderWidth: 1, borderColor: colors.gold + '44',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  rating: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.micro, fontWeight: '700' },
  hoursPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  hoursText: { ...typography.micro, color: colors.textMuted },
  completionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.electric + '11',
    borderWidth: 1, borderColor: colors.electricBright + '33',
  },
  completionText: { ...typography.micro, color: colors.electricBright },
  currencyText: { ...typography.caption, color: colors.textMuted, marginLeft: 'auto' as any },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  chipText: { ...typography.micro, color: colors.glow },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.electricBright + '66',
    backgroundColor: colors.electric + '11',
  },
  chatBtnText: { ...typography.caption, color: colors.electricBright, fontWeight: '600' },
  orderBtn: { flex: 1, borderRadius: radius.xl, overflow: 'hidden' },
  orderBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
  },
  orderBtnText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  profileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft,
    backgroundColor: colors.bgElevated,
  },
  profileBtnText: { ...typography.micro, color: colors.electricBright },
});
