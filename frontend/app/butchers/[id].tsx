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
import { gradients, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';
import { countries, Country } from '@/services/types';
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
  const { colors } = useTheme();
  const productsStyles = useThemedStyles(({ colors }) => createProductsStyles(colors));
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
        contentContainerStyle={productsStyles.catRow}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[productsStyles.catChip, activeCategory === cat && productsStyles.catChipActive]}
          >
            {cat !== 'all' && (
              <Text style={productsStyles.catIcon}>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]?.icon}</Text>
            )}
            <Text style={[productsStyles.catLabel, activeCategory === cat && productsStyles.catLabelActive]}>
              {cat === 'all' ? 'الكل' : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]?.ar}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.map((product) => (
        <View key={product.id} style={productsStyles.card}>
          <Image
            source={{ uri: product.images[0] }}
            style={productsStyles.productImg}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(6,9,26,0.9)']}
            style={productsStyles.productGrad}
          />
          {/* Freshness badge */}
          <View style={[
            productsStyles.freshnessBadge,
            {
              backgroundColor:
                product.freshness === 'fresh' ? colors.success + 'CC' :
                product.freshness === 'chilled' ? colors.electric + 'CC' :
                colors.textSubtle + 'CC',
            },
          ]}>
            <Text style={productsStyles.freshnessText}>
              {product.freshness === 'fresh' ? '🟢 طازج' :
               product.freshness === 'chilled' ? '🔵 مبرد' : '❄️ مجمد'}
            </Text>
          </View>

          <View style={productsStyles.productBody}>
            <View style={productsStyles.productHeader}>
              <View style={{ flex: 1 }}>
                <Text style={productsStyles.productName}>{product.nameAr}</Text>
                <Text style={productsStyles.productDesc} numberOfLines={2}>{product.descriptionAr}</Text>
              </View>
              <View style={productsStyles.priceBlock}>
                {product.pricePerKg ? (
                  <>
                    <Text style={productsStyles.price}>{product.pricePerKg}</Text>
                    <Text style={productsStyles.priceSub}>{currencySymbol}/كغ</Text>
                  </>
                ) : (
                  <>
                    <Text style={productsStyles.price}>{product.priceFixed?.toLocaleString()}</Text>
                    <Text style={productsStyles.priceSub}>{currencySymbol}</Text>
                  </>
                )}
              </View>
            </View>

            {/* Available cuts */}
            <View style={productsStyles.cutsRow}>
              {product.availableCuts.map((cut) => (
                <View key={cut} style={productsStyles.cutChip}>
                  <Text style={productsStyles.cutLabel}>{CUT_LABELS[cut].ar}</Text>
                </View>
              ))}
            </View>

            {/* Weight range */}
            {product.weightRange && (
              <Text style={productsStyles.weightNote}>
                الوزن: {product.weightRange.min}–{product.weightRange.max} كغ
              </Text>
            )}
            {product.pricingNoteAr && (
              <Text style={productsStyles.weightNote}>{product.pricingNoteAr}</Text>
            )}

            {/* Order button */}
            <Pressable
              style={({ pressed }) => [productsStyles.orderBtn, pressed && { opacity: 0.85 }]}
              onPress={() => onOrder(product)}
            >
              <LinearGradient
                colors={[colors.electric, colors.cyan]}
                style={productsStyles.orderBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="bag-add-outline" size={16} color="#fff" />
                <Text style={productsStyles.orderBtnText}>
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
  const { colors } = useTheme();
  const offersStyles = useThemedStyles(({ colors }) => createOffersStyles(colors));
  const emptyStyles = useThemedStyles(({ colors }) => createEmptyStyles(colors));
  if (!offers.length) {
    return (
      <View style={emptyStyles.wrap}>
        <Text style={emptyStyles.icon}>🏷️</Text>
        <Text style={emptyStyles.title}>لا توجد عروض حالياً</Text>
      </View>
    );
  }

  return (
    <View>
      {offers.map((offer) => (
        <View key={offer.id} style={offersStyles.card}>
          <Image source={{ uri: offer.image }} style={offersStyles.img} contentFit="cover" />
          <LinearGradient
            colors={[colors.amber + '33', colors.gold + '22']}
            style={offersStyles.body}
          >
            <View style={offersStyles.discountBadge}>
              <Text style={offersStyles.discountText}>-{offer.discountPercent}%</Text>
            </View>
            <Text style={offersStyles.offerTitle}>{offer.titleAr}</Text>
            <Text style={offersStyles.offerDesc} numberOfLines={2}>{offer.descriptionAr}</Text>
            <View style={offersStyles.priceRow}>
              <Text style={offersStyles.offerPrice}>
                {offer.offerPrice?.toLocaleString()} {currencySymbol}
              </Text>
              <Text style={offersStyles.originalPrice}>
                {offer.originalPrice?.toLocaleString()}
              </Text>
            </View>
            <View style={offersStyles.footer}>
              <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
              <Text style={offersStyles.validText}>
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
  const storiesStyles = useThemedStyles(({ colors }) => createStoriesStyles(colors));
  const emptyStyles = useThemedStyles(({ colors }) => createEmptyStyles(colors));
  if (!stories.length) {
    return (
      <View style={emptyStyles.wrap}>
        <Text style={emptyStyles.icon}>📸</Text>
        <Text style={emptyStyles.title}>لا توجد قصص بعد</Text>
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
    <View style={storiesStyles.grid}>
      {stories.map((story) => (
        <Pressable key={story.id} style={storiesStyles.item}>
          <Image source={{ uri: story.thumbnail }} style={storiesStyles.img} contentFit="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(6,9,26,0.9)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={storiesStyles.badge}>
            <Text style={storiesStyles.badgeText}>{typeLabels[story.type]}</Text>
          </View>
          {story.captionAr && (
            <Text style={storiesStyles.caption} numberOfLines={2}>{story.captionAr}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Tab: About ───────────────────────────────────────────────────────────────
function AboutTab({ butcher }: { butcher: ButcherProfile }) {
  const { colors } = useTheme();
  const aboutStyles = useThemedStyles(({ colors }) => createAboutStyles(colors));
  if (!butcher) return null;
  const country = countries[butcher.country];

  return (
    <View style={aboutStyles.wrap}>
      {/* Bio */}
      <View style={aboutStyles.section}>
        <Text style={aboutStyles.sectionTitle}>عن الملحمة</Text>
        <Text style={aboutStyles.bio}>{butcher.bioAr}</Text>
      </View>

      {/* Info grid */}
      <View style={aboutStyles.infoGrid}>
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
      <View style={aboutStyles.section}>
        <Text style={aboutStyles.sectionTitle}>التخصصات</Text>
        <View style={aboutStyles.chipsWrap}>
          {butcher.specialties.map((s, i) => (
            <View key={i} style={aboutStyles.chip}>
              <Text style={aboutStyles.chipText}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Verification */}
      {butcher.subscriptionActive && (
        <LinearGradient
          colors={[colors.gold + '22', colors.amber + '11']}
          style={aboutStyles.verifiedCard}
        >
          <Ionicons name="shield-checkmark" size={28} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={aboutStyles.verifiedTitle}>ملحمة موثّقة ✓</Text>
            <Text style={aboutStyles.verifiedSub}>
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
  const { colors } = useTheme();
  const aboutStyles = useThemedStyles(({ colors }) => createAboutStyles(colors));
  return (
    <View style={aboutStyles.infoRow}>
      <MaterialCommunityIcons name={icon as any} size={16} color={colors.electricBright} />
      <Text style={aboutStyles.infoLabel}>{label}</Text>
      <Text style={aboutStyles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Tab: Chat ────────────────────────────────────────────────────────────────
function ChatTab({ butcherName, butcherId, currentUserId }: { butcherName: string; butcherId: string; currentUserId?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const chatStyles = useThemedStyles(({ colors }) => createChatStyles(colors));
  const previewMessages: ChatMessage[] = [];
  return (
    <View style={chatStyles.wrap}>
      {/* Preview messages */}
      {previewMessages.map((msg) => {
        const isMe = msg.senderId === currentUserId;
        return (
          <View key={msg.id} style={[chatStyles.bubble, isMe ? chatStyles.bubbleMe : chatStyles.bubbleThem]}>
            <Text style={[chatStyles.bubbleText, isMe ? chatStyles.textMe : chatStyles.textThem]}>{msg.text}</Text>
            <Text style={chatStyles.bubbleTime}>
              {new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        );
      })}

      {/* Open full chat CTA */}
      <Pressable
        style={({ pressed }) => [chatStyles.openChatBtn, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: '/butchers/chat', params: { butcherId } } as any)}
      >
        <LinearGradient
          colors={[colors.electric, colors.cyan]}
          style={chatStyles.openChatGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
          <Text style={chatStyles.openChatText}>فتح المحادثة الكاملة مع {butcherName}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Reviews Strip ────────────────────────────────────────────────────────────
function ReviewsStrip({ reviews }: { reviews: ButcherReview[] }) {
  const { colors } = useTheme();
  const reviewsStyles = useThemedStyles(({ colors }) => createReviewsStyles(colors));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={reviewsStyles.row}>
      {reviews.map((r) => (
        <View key={r.id} style={reviewsStyles.card}>
          <View style={reviewsStyles.header}>
            <Image source={{ uri: r.authorAvatar }} style={reviewsStyles.avatar} />
            <View>
              <Text style={reviewsStyles.author}>{r.authorNameAr}</Text>
              <View style={reviewsStyles.stars}>
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
          <Text style={reviewsStyles.comment} numberOfLines={3}>{r.commentAr}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ButcherProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createMainStyles(colors));
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
      <SafeAreaView style={styles.screen}>
        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 80 }}>جاري تحميل تفاصيل الملحمة...</Text>
      </SafeAreaView>
    );
  }

  if (!butcher) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 80 }}>الملحمة غير موجودة</Text>
      </SafeAreaView>
    );
  }

  const stories = storiesList.filter((s) => s.butcherId === butcher.id);
  const currency = gccCurrencies[butcher.country as Country] || gccCurrencies['SA'];
  const country = countries[butcher.country as Country] || countries['SA'];

  const handleOrder = (product: ButcherProduct) => {
    router.push({
      pathname: '/butchers/order',
      params: { productId: product.id, butcherId: butcher.id },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Cover + Back ── */}
        <View style={styles.coverWrap}>
          <Image source={{ uri: butcher.cover }} style={styles.cover} contentFit="cover" />
          <LinearGradient
            colors={['rgba(6,9,26,0.5)', 'transparent', 'rgba(6,9,26,0.85)']}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name={rtlBackIcon} size={22} color="#fff" />
          </Pressable>
          <View style={styles.coverActions}>
            <Pressable style={styles.coverAction}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable style={styles.coverAction}>
              <Ionicons name="heart-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ── Profile Header ── */}
        <View style={styles.profileHeader}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={{ uri: butcher.logo }} style={styles.logo} contentFit="cover" />
            {butcher.subscriptionActive && (
              <View style={styles.verifiedRing}>
                <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
              </View>
            )}
          </View>

          {/* Name + badges */}
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{butcher.nameAr}</Text>
              {butcher.subscriptionActive && (
                <LinearGradient
                  colors={[colors.gold, '#F59E0B']}
                  style={styles.verifiedBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="shield-checkmark" size={11} color="#1A1300" />
                  <Text style={styles.verifiedText}>موثّق</Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.locationRow}>
              <Text style={styles.countryFlag}>{country.flag}</Text>
              <Text style={styles.locationText}>{butcher.cityAr}، {country.ar}</Text>
            </View>
          </View>

          {/* Rating */}
          <View style={styles.ratingBlock}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color={colors.gold} />
              <Text style={styles.ratingScore}>{butcher.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.ratingCount}>({butcher.reviewCount})</Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{butcher.totalOrders.toLocaleString()}</Text>
            <Text style={styles.statLabel}>طلب</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{butcher.orderCompletionRate}%</Text>
            <Text style={styles.statLabel}>إتمام</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: butcher.workingHours.isOpen ? colors.textBrandSuccess : colors.danger }]}>
              {butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}
            </Text>
            <Text style={styles.statLabel}>{butcher.workingHours.open}–{butcher.workingHours.close}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currency.symbol}</Text>
            <Text style={styles.statLabel}>{currency.nameAr}</Text>
          </View>
        </View>

        {/* ── Chat + Order CTAs ── */}
        <View style={styles.ctaRow}>
          <Pressable
            style={styles.chatCta}
            onPress={() => setActiveTab('chat')}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.electricBright} />
            <Text style={styles.chatCtaText}>محادثة</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.orderCta, pressed && { opacity: 0.88 }]}
            onPress={() => router.push({ pathname: '/butchers/order', params: { butcherId: butcher.id } })}
          >
            <LinearGradient
              colors={[colors.electric, colors.cyan]}
              style={styles.orderCtaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="bag-add-outline" size={18} color="#fff" />
              <Text style={styles.orderCtaText}>اطلب الآن</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                {tab.labelAr}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Tab Content ── */}
        <View style={styles.tabContent}>
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
                  <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.lg }]}>
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

function createMainStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  chatCtaText: { ...typography.bodyStrong, color: colors.textBrandStrong },
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
}

function createEmptyStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 60, gap: spacing.sm },
  icon: { fontSize: 40 },
  title: { ...typography.h3, color: colors.textMuted },
  });
}

// Products tab
function createProductsStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  cutLabel: { ...typography.micro, color: colors.textBrand },
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
}

// Offers tab
function createOffersStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}

// Stories tab
function createStoriesStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  badgeText: { ...typography.micro, color: colors.textBrand },
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
}

// About tab
function createAboutStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  chipText: { ...typography.caption, color: colors.textBrand },
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
}

// Chat tab
function createChatStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}

// Reviews
function createReviewsStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}
