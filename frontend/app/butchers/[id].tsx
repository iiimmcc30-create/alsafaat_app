// Powered by OnSpace.AI
// SAFAT — Butcher Profile Screen (صفحة الملحمة)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';
import { countries } from '@/services/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import {
  CATEGORY_LABELS,
  CUT_LABELS,
  ButcherOffer,
  ButcherProduct,
  ButcherProfile,
  ButcherReview,
  ButcherStory,
  gccCurrencies,
  MeatCategory,
  ChatMessage,
} from '@/services/butcherData';

type Tab = 'products' | 'offers' | 'stories' | 'about' | 'chat';

const TABS: { id: Tab; labelAr: string; icon: string }[] = [
  { id: 'products', labelAr: 'المنتجات', icon: '🥩' },
  { id: 'offers',   labelAr: 'العروض',   icon: '🏷️' },
  { id: 'stories',  labelAr: 'القصص',    icon: '📸' },
  { id: 'about',    labelAr: 'عن الملحمة', icon: 'ℹ️' },
  { id: 'chat',     labelAr: 'المحادثة', icon: '💬' },
];

// ─── Tab: Products ────────────────────────────────────────────────────────────
function ProductsTab({ products, currencySymbol, onOrder }: {
  products: ButcherProduct[];
  currencySymbol: string;
  onOrder: (p: ButcherProduct) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const categories = ['all', ...new Set(products.map((p) => p.category))];

  const filtered = activeCategory === 'all'
    ? products
    : products.filter((p) => p.category === activeCategory);

  return (
    <View>
      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pt.catRow}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[pt.catChip, activeCategory === cat && pt.catChipActive]}
          >
            {cat !== 'all' && (
              <Text style={pt.catIcon}>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]?.icon}</Text>
            )}
            <Text style={[pt.catLabel, activeCategory === cat && pt.catLabelActive]}>
              {cat === 'all' ? 'الكل' : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]?.ar}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.map((product) => (
        <View key={product.id} style={pt.card}>
          <Image
            source={{ uri: product.images[0] }}
            style={pt.productImg}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(6,9,26,0.9)']}
            style={pt.productGrad}
          />
          {/* Freshness badge */}
          <View style={[
            pt.freshnessBadge,
            {
              backgroundColor:
                product.freshness === 'fresh' ? colors.success + 'CC' :
                product.freshness === 'chilled' ? colors.electric + 'CC' :
                colors.textSubtle + 'CC',
            },
          ]}>
            <Text style={pt.freshnessText}>
              {product.freshness === 'fresh' ? '🟢 طازج' :
               product.freshness === 'chilled' ? '🔵 مبرد' : '❄️ مجمد'}
            </Text>
          </View>

          <View style={pt.productBody}>
            <View style={pt.productHeader}>
              <View style={{ flex: 1 }}>
                <Text style={pt.productName}>{product.nameAr}</Text>
                <Text style={pt.productDesc} numberOfLines={2}>{product.descriptionAr}</Text>
              </View>
              <View style={pt.priceBlock}>
                {product.pricePerKg ? (
                  <>
                    <Text style={pt.price}>{product.pricePerKg}</Text>
                    <Text style={pt.priceSub}>{currencySymbol}/كغ</Text>
                  </>
                ) : (
                  <>
                    <Text style={pt.price}>{product.priceFixed?.toLocaleString()}</Text>
                    <Text style={pt.priceSub}>{currencySymbol}</Text>
                  </>
                )}
              </View>
            </View>

            {/* Available cuts */}
            <View style={pt.cutsRow}>
              {product.availableCuts.map((cut) => (
                <View key={cut} style={pt.cutChip}>
                  <Text style={pt.cutLabel}>{CUT_LABELS[cut].ar}</Text>
                </View>
              ))}
            </View>

            {/* Weight range */}
            {product.weightRange && (
              <Text style={pt.weightNote}>
                الوزن: {product.weightRange.min}–{product.weightRange.max} كغ
              </Text>
            )}
            {product.pricingNoteAr && (
              <Text style={pt.weightNote}>{product.pricingNoteAr}</Text>
            )}

            {/* Order button */}
            <Pressable
              style={({ pressed }) => [pt.orderBtn, pressed && { opacity: 0.85 }]}
              onPress={() => onOrder(product)}
            >
              <LinearGradient
                colors={[colors.electric, colors.cyan]}
                style={pt.orderBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="bag-add-outline" size={16} color="#fff" />
                <Text style={pt.orderBtnText}>
                  {product.inStock ? 'اطلب الآن' : 'غير متوفر'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Tab: Offers ─────────────────────────────────────────────────────────────
function OffersTab({ offers, currencySymbol }: {
  offers: ButcherOffer[];
  currencySymbol: string;
}) {
  if (!offers.length) {
    return (
      <View style={emptyState.wrap}>
        <Text style={emptyState.icon}>🏷️</Text>
        <Text style={emptyState.title}>لا توجد عروض حالياً</Text>
      </View>
    );
  }

  return (
    <View>
      {offers.map((offer) => (
        <View key={offer.id} style={ot.card}>
          <Image source={{ uri: offer.image }} style={ot.img} contentFit="cover" />
          <LinearGradient
            colors={[colors.amber + '33', colors.gold + '22']}
            style={ot.body}
          >
            <View style={ot.discountBadge}>
              <Text style={ot.discountText}>-{offer.discountPercent}%</Text>
            </View>
            <Text style={ot.offerTitle}>{offer.titleAr}</Text>
            <Text style={ot.offerDesc} numberOfLines={2}>{offer.descriptionAr}</Text>
            <View style={ot.priceRow}>
              <Text style={ot.offerPrice}>
                {offer.offerPrice?.toLocaleString()} {currencySymbol}
              </Text>
              <Text style={ot.originalPrice}>
                {offer.originalPrice?.toLocaleString()}
              </Text>
            </View>
            <View style={ot.footer}>
              <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
              <Text style={ot.validText}>
                صالح حتى: {new Date(offer.validUntil).toLocaleDateString('ar-SA')}
              </Text>
            </View>
          </LinearGradient>
        </View>
      ))}
    </View>
  );
}

// ─── Tab: Stories ─────────────────────────────────────────────────────────────
function StoriesTab({ stories }: { stories: ButcherStory[] }) {
  if (!stories.length) {
    return (
      <View style={emptyState.wrap}>
        <Text style={emptyState.icon}>📸</Text>
        <Text style={emptyState.title}>لا توجد قصص بعد</Text>
      </View>
    );
  }

  const typeLabels: Record<string, string> = {
    daily_slaughter: 'ذبح يومي',
    offer: 'عرض',
    new_stock: 'مخزون جديد',
    update: 'تحديث',
  };

  return (
    <View style={stt.grid}>
      {stories.map((story) => (
        <Pressable key={story.id} style={stt.item}>
          <Image source={{ uri: story.thumbnail }} style={stt.img} contentFit="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(6,9,26,0.9)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={stt.badge}>
            <Text style={stt.badgeText}>{typeLabels[story.type]}</Text>
          </View>
          {story.captionAr && (
            <Text style={stt.caption} numberOfLines={2}>{story.captionAr}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Tab: About ───────────────────────────────────────────────────────────────
function AboutTab({ butcher }: { butcher: ButcherProfile }) {
  if (!butcher) return null;
  const country = countries[butcher.country];

  return (
    <View style={abt.wrap}>
      {/* Bio */}
      <View style={abt.section}>
        <Text style={abt.sectionTitle}>عن الملحمة</Text>
        <Text style={abt.bio}>{butcher.bioAr}</Text>
      </View>

      {/* Info grid */}
      <View style={abt.infoGrid}>
        <InfoRow icon="map-marker-outline" label="الموقع" value={`${butcher.cityAr}، ${country.ar}`} />
        <InfoRow icon="clock-outline" label="ساعات العمل" value={`${butcher.workingHours.open} – ${butcher.workingHours.close}`} />
        <InfoRow icon="phone-outline" label="الهاتف" value={butcher.phone} />
        {butcher.commercialReg && (
          <InfoRow icon="file-document-outline" label="السجل التجاري" value={butcher.commercialReg} />
        )}
        <InfoRow icon="bag-check-outline" label="إجمالي الطلبات" value={butcher.totalOrders.toLocaleString()} />
        <InfoRow icon="trending-up" label="معدل الإتمام" value={`${butcher.orderCompletionRate}%`} />
      </View>

      {/* Specialties */}
      <View style={abt.section}>
        <Text style={abt.sectionTitle}>التخصصات</Text>
        <View style={abt.chipsWrap}>
          {butcher.specialties.map((s, i) => (
            <View key={i} style={abt.chip}>
              <Text style={abt.chipText}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Verification */}
      {butcher.subscriptionActive && (
        <LinearGradient
          colors={[colors.gold + '22', colors.amber + '11']}
          style={abt.verifiedCard}
        >
          <Ionicons name="shield-checkmark" size={28} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={abt.verifiedTitle}>ملحمة موثّقة ✓</Text>
            <Text style={abt.verifiedSub}>
              اشتراك نشط · صالح حتى {butcher.subscriptionExpiry
                ? new Date(butcher.subscriptionExpiry).toLocaleDateString('ar-SA')
                : 'غير محدد'}
            </Text>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={abt.infoRow}>
      <MaterialCommunityIcons name={icon as any} size={16} color={colors.electricBright} />
      <Text style={abt.infoLabel}>{label}</Text>
      <Text style={abt.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Tab: Chat ────────────────────────────────────────────────────────────────
function ChatTab({ butcherName, butcherId, currentUserId }: { butcherName: string; butcherId: string; currentUserId?: string }) {
  const router = useRouter();
  const previewMessages: ChatMessage[] = [];
  return (
    <View style={cht.wrap}>
      {/* Preview messages */}
      {previewMessages.map((msg) => {
        const isMe = msg.senderId === currentUserId;
        return (
          <View key={msg.id} style={[cht.bubble, isMe ? cht.bubbleMe : cht.bubbleThem]}>
            <Text style={[cht.bubbleText, isMe ? cht.textMe : cht.textThem]}>{msg.text}</Text>
            <Text style={cht.bubbleTime}>
              {new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        );
      })}

      {/* Open full chat CTA */}
      <Pressable
        style={({ pressed }) => [cht.openChatBtn, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: '/butchers/chat', params: { butcherId } } as any)}
      >
        <LinearGradient
          colors={[colors.electric, colors.cyan]}
          style={cht.openChatGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
          <Text style={cht.openChatText}>فتح المحادثة الكاملة مع {butcherName}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Reviews Strip ────────────────────────────────────────────────────────────
function ReviewsStrip({ reviews }: { reviews: ButcherReview[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rv.row}>
      {reviews.map((r) => (
        <View key={r.id} style={rv.card}>
          <View style={rv.header}>
            <Image source={{ uri: r.authorAvatar }} style={rv.avatar} />
            <View>
              <Text style={rv.author}>{r.authorNameAr}</Text>
              <View style={rv.stars}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons
                    key={i}
                    name="star"
                    size={11}
                    color={i < r.rating ? colors.gold : colors.borderSoft}
                  />
                ))}
              </View>
            </View>
          </View>
          <Text style={rv.comment} numberOfLines={3}>{r.commentAr}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ButcherProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [orderModalProduct, setOrderModalProduct] = useState<ButcherProduct | null>(null);

  const [butcher, setButcher] = useState<ButcherProfile | null>(null);
  const [products, setProducts] = useState<ButcherProduct[]>([]);
  const [offers, setOffers] = useState<ButcherOffer[]>([]);
  const [reviews, setReviews] = useState<ButcherReview[]>([]);
  const [storiesList, setStoriesList] = useState<ButcherStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchButcherDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const [res, resS] = await Promise.all([
          fetch(`${API_BASE}/api/butchers/${id}`, { headers }),
          fetch(`${API_BASE}/api/butchers/stories`),
        ]);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const b = json.data;
            const mappedButcher: ButcherProfile = {
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
            };
            setButcher(mappedButcher);
            
            if (b.products) {
              setProducts(b.products.map((p: any) => ({
                id: p.id,
                butcherId: p.butcherId,
                name: p.nameEn,
                nameAr: p.nameAr,
                category: p.category,
                images: p.images || [],
                pricePerKg: p.pricePerKg,
                priceFixed: p.priceFixed,
                pricingNote: p.pricingNoteAr,
                pricingNoteAr: p.pricingNoteAr,
                availableCuts: p.availableCuts || [],
                weightRange: p.weightMin ? { min: p.weightMin, max: p.weightMax || p.weightMin } : undefined,
                inStock: p.inStock ?? true,
                freshness: p.freshness || 'fresh',
                description: p.descriptionEn,
                descriptionAr: p.descriptionAr,
                country: p.country,
              })));
            }
            
            if (b.offers) {
              setOffers(b.offers.map((o: any) => ({
                id: o.id,
                butcherId: o.butcherId,
                title: o.titleEn,
                titleAr: o.titleAr,
                description: o.descriptionEn,
                descriptionAr: o.descriptionAr,
                discountPercent: o.discountPercent,
                originalPrice: o.originalPrice,
                offerPrice: o.offerPrice,
                image: o.image || undefined,
                validUntil: o.validUntil,
                country: o.country,
              })));
            }
            
            if (b.reviews) {
              setReviews(b.reviews.map((r: any) => ({
                id: r.id,
                butcherId: r.butcherId,
                authorName: r.authorName || 'عميل الصفاة',
                authorNameAr: r.authorNameAr || 'عميل الصفاة',
                authorAvatar: r.authorAvatar || undefined,
                rating: r.rating ?? 5,
                comment: r.comment || '',
                commentAr: r.comment || '',
                postedAt: r.createdAt,
              })));
            }
          }
        }
        if (resS.ok) {
          const json = await resS.json();
          if (json.success && Array.isArray(json.data)) {
            setStoriesList(json.data);
          }
        }
      } catch (err) {
        console.warn('[ButcherProfileScreen] Failed to fetch details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchButcherDetails();
  }, [id, accessToken]);

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 80 }}>جاري تحميل تفاصيل الملحمة...</Text>
      </SafeAreaView>
    );
  }

  if (!butcher) {
    return (
      <SafeAreaView style={s.screen}>
        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 80 }}>الملحمة غير موجودة</Text>
      </SafeAreaView>
    );
  }

  const stories = storiesList.filter((s) => s.butcherId === butcher.id);
  const currency = gccCurrencies[butcher.country as Country] || gccCurrencies['SA'];
  const country = countries[butcher.country as 'SA' | 'AE' | 'KW' | 'QA' | 'BH' | 'OM'] || countries['SA'];

  const handleOrder = (product: ButcherProduct) => {
    router.push({
      pathname: '/butchers/order',
      params: { productId: product.id, butcherId: butcher.id },
    });
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Cover + Back ── */}
        <View style={s.coverWrap}>
          <Image source={{ uri: butcher.cover }} style={s.cover} contentFit="cover" />
          <LinearGradient
            colors={['rgba(6,9,26,0.5)', 'transparent', 'rgba(6,9,26,0.85)']}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={s.backBtn}
          >
            <Ionicons name={rtlBackIcon} size={22} color="#fff" />
          </Pressable>
          <View style={s.coverActions}>
            <Pressable style={s.coverAction}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable style={s.coverAction}>
              <Ionicons name="heart-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ── Profile Header ── */}
        <View style={s.profileHeader}>
          {/* Logo */}
          <View style={s.logoWrap}>
            <Image source={{ uri: butcher.logo }} style={s.logo} contentFit="cover" />
            {butcher.subscriptionActive && (
              <View style={s.verifiedRing}>
                <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
              </View>
            )}
          </View>

          {/* Name + badges */}
          <View style={s.nameBlock}>
            <View style={s.nameRow}>
              <Text style={s.name}>{butcher.nameAr}</Text>
              {butcher.subscriptionActive && (
                <LinearGradient
                  colors={[colors.gold, '#F59E0B']}
                  style={s.verifiedBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="shield-checkmark" size={11} color="#1A1300" />
                  <Text style={s.verifiedText}>موثّق</Text>
                </LinearGradient>
              )}
            </View>
            <View style={s.locationRow}>
              <Text style={s.countryFlag}>{country.flag}</Text>
              <Text style={s.locationText}>{butcher.cityAr}، {country.ar}</Text>
            </View>
          </View>

          {/* Rating */}
          <View style={s.ratingBlock}>
            <View style={s.ratingRow}>
              <Ionicons name="star" size={16} color={colors.gold} />
              <Text style={s.ratingScore}>{butcher.rating.toFixed(1)}</Text>
            </View>
            <Text style={s.ratingCount}>({butcher.reviewCount})</Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={s.statsStrip}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{butcher.totalOrders.toLocaleString()}</Text>
            <Text style={s.statLabel}>طلب</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{butcher.orderCompletionRate}%</Text>
            <Text style={s.statLabel}>إتمام</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: butcher.workingHours.isOpen ? colors.success : colors.danger }]}>
              {butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}
            </Text>
            <Text style={s.statLabel}>{butcher.workingHours.open}–{butcher.workingHours.close}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{currency.symbol}</Text>
            <Text style={s.statLabel}>{currency.nameAr}</Text>
          </View>
        </View>

        {/* ── Chat + Order CTAs ── */}
        <View style={s.ctaRow}>
          <Pressable
            style={s.chatCta}
            onPress={() => setActiveTab('chat')}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.electricBright} />
            <Text style={s.chatCtaText}>محادثة</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.orderCta, pressed && { opacity: 0.88 }]}
            onPress={() => router.push({ pathname: '/butchers/order', params: { butcherId: butcher.id } })}
          >
            <LinearGradient
              colors={[colors.electric, colors.cyan]}
              style={s.orderCtaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="bag-add-outline" size={18} color="#fff" />
              <Text style={s.orderCtaText}>اطلب الآن</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsRow}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
            >
              <Text style={s.tabIcon}>{tab.icon}</Text>
              <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>
                {tab.labelAr}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Tab Content ── */}
        <View style={s.tabContent}>
          {activeTab === 'products' && (
            <ProductsTab
              products={products}
              currencySymbol={currency.symbol}
              onOrder={handleOrder}
            />
          )}
          {activeTab === 'offers' && (
            <OffersTab offers={offers} currencySymbol={currency.symbol} />
          )}
          {activeTab === 'stories' && <StoriesTab stories={stories} />}
          {activeTab === 'about' && (
            <>
              <AboutTab butcher={butcher} />
              {reviews.length > 0 && (
                <View style={{ marginTop: spacing.xl }}>
                  <Text style={[s.sectionTitle, { paddingHorizontal: spacing.lg }]}>
                    آراء العملاء ({butcher.reviewCount})
                  </Text>
                  <ReviewsStrip reviews={reviews} />
                </View>
              )}
            </>
          )}
          {activeTab === 'chat' && <ChatTab butcherName={butcher.nameAr} butcherId={butcher.id} currentUserId={user?.id} />}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },

  coverWrap: { height: 240, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  backBtn: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(6,9,26,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  coverActions: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  coverAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(6,9,26,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  logoWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: colors.borderMid,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    position: 'relative',
  },
  logo: { width: '100%', height: '100%' },
  verifiedRing: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  nameBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { ...typography.h2, color: colors.textPrimary },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  verifiedText: { ...typography.micro, color: '#1A1300', fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  countryFlag: { fontSize: 14 },
  locationText: { ...typography.caption, color: colors.textMuted },
  ratingBlock: { alignItems: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingScore: { ...typography.h3, color: colors.gold },
  ratingCount: { ...typography.micro, color: colors.textMuted, marginTop: 2 },

  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...typography.bodyStrong, color: colors.textPrimary },
  statLabel: { ...typography.micro, color: colors.textMuted },
  statDivider: { width: 1, height: 28, backgroundColor: colors.borderSoft },

  ctaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  chatCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.electricBright + '88',
    backgroundColor: colors.electric + '11',
  },
  chatCtaText: { ...typography.bodyStrong, color: colors.electricBright },
  orderCta: { flex: 2, borderRadius: radius.xl, overflow: 'hidden' },
  orderCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.xl,
  },
  orderCtaText: { ...typography.bodyStrong, color: '#fff' },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tabBtnActive: {
    backgroundColor: colors.electric,
    borderColor: colors.electric,
  },
  tabIcon: { fontSize: 14 },
  tabLabel: { ...typography.caption, color: colors.textMuted },
  tabLabelActive: { color: '#fff', fontWeight: '600' },
  tabContent: { paddingTop: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
});

const emptyState = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 60, gap: spacing.sm },
  icon: { fontSize: 40 },
  title: { ...typography.h3, color: colors.textMuted },
});

// Products tab
const pt = StyleSheet.create({
  catRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  catChip: {
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
  catChipActive: { backgroundColor: colors.electric, borderColor: colors.electric },
  catIcon: { fontSize: 13 },
  catLabel: { ...typography.caption, color: colors.textMuted },
  catLabelActive: { color: '#fff', fontWeight: '600' },

  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  productImg: { width: '100%', height: 180 },
  productGrad: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    height: 80,
  },
  freshnessBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  freshnessText: { ...typography.micro, color: '#fff' },
  productBody: { padding: spacing.lg },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  productName: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  productDesc: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  priceBlock: { alignItems: 'flex-end' },
  price: { fontSize: 24, fontWeight: '800', color: colors.gold },
  priceSub: { ...typography.micro, color: colors.textMuted },
  cutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.md,
  },
  cutChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cutLabel: { ...typography.micro, color: colors.glow },
  weightNote: { ...typography.caption, color: colors.textMuted, marginTop: 6 },
  orderBtn: { marginTop: spacing.md, borderRadius: radius.xl, overflow: 'hidden' },
  orderBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  orderBtnText: { ...typography.bodyStrong, color: '#fff' },
});

// Offers tab
const ot = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  img: { width: '100%', height: 160 },
  body: { padding: spacing.lg },
  discountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  discountText: { ...typography.micro, color: '#fff', fontWeight: '700' },
  offerTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  offerDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: spacing.md,
  },
  offerPrice: { ...typography.h3, color: colors.gold },
  originalPrice: {
    ...typography.body,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  validText: { ...typography.caption, color: colors.textMuted },
});

// Stories tab
const stt = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  item: {
    width: '47.5%',
    aspectRatio: 0.75,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgSurface,
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.bgGlassStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { ...typography.micro, color: colors.glow },
  caption: {
    ...typography.micro,
    color: '#fff',
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    lineHeight: 14,
  },
});

// About tab
const abt = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  bio: { ...typography.body, color: colors.textSecondary, lineHeight: 22, textAlign: 'right' },
  infoGrid: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  infoLabel: { ...typography.caption, color: colors.textMuted, flex: 1 },
  infoValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600', textAlign: 'right' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  chipText: { ...typography.caption, color: colors.glow },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    marginBottom: spacing.xl,
  },
  verifiedTitle: { ...typography.bodyStrong, color: colors.gold },
  verifiedSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});

// Chat tab
const cht = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  bubble: {
    maxWidth: '80%',
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: colors.electric + 'CC',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { ...typography.body, lineHeight: 20 },
  textMe: { color: '#fff' },
  textThem: { color: colors.textPrimary },
  bubbleTime: { ...typography.micro, color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'right' },
  openChatBtn: {
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  openChatGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  openChatText: { ...typography.bodyStrong, color: '#fff' },
});

// Reviews
const rv = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  card: {
    width: 220,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgElevated },
  author: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  stars: { flexDirection: 'row', gap: 2, marginTop: 2 },
  comment: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
});
