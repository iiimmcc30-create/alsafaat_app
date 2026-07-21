// Powered by OnSpace.AI
// SAFAT — useButcher hook

import { useMemo, useState, useEffect } from 'react';
import { API_BASE } from '@/services/api';
import {
  ButcherOffer,
  ButcherProduct,
  ButcherProfile,
  ButcherStory,
  Country,
  mapButcherFromApi,
  rankButchers,
} from '@/services/butcherData';

export type ButcherFilter = {
  country: Country | 'all';
  verifiedOnly: boolean;
  searchQuery: string;
  isOpenNow: boolean;
};

const DEFAULT_FILTER: ButcherFilter = {
  country: 'all',
  verifiedOnly: false,
  searchQuery: '',
  isOpenNow: false,
};

const BUTCHER_CACHE_TTL_MS = 60_000;
type ButcherCatalogCache = {
  butchers: ButcherProfile[];
  stories: ButcherStory[];
  fetchedAt: number;
};
let butcherCatalogCache: ButcherCatalogCache | null = null;
let butcherCatalogInflight: Promise<ButcherCatalogCache> | null = null;

async function loadButcherCatalog(): Promise<ButcherCatalogCache> {
  const now = Date.now();
  if (butcherCatalogCache && now - butcherCatalogCache.fetchedAt < BUTCHER_CACHE_TTL_MS) {
    return butcherCatalogCache;
  }
  if (butcherCatalogInflight) return butcherCatalogInflight;

  butcherCatalogInflight = (async () => {
    const [resB, resS] = await Promise.all([
      fetch(`${API_BASE}/api/butchers`),
      fetch(`${API_BASE}/api/butchers/stories`),
    ]);

    let butchers: ButcherProfile[] = butcherCatalogCache?.butchers ?? [];
    let stories: ButcherStory[] = butcherCatalogCache?.stories ?? [];

    if (resB.ok) {
      const json = await resB.json();
      const rawButchers = Array.isArray(json.data) ? json.data : json.data?.butchers;
      if (json.success && Array.isArray(rawButchers)) {
        butchers = rawButchers.map((b: Record<string, unknown>) => mapButcherFromApi(b));
      }
    }

    if (resS.ok) {
      const json = await resS.json();
      if (json.success && Array.isArray(json.data)) {
        stories = json.data.map((s: any) => ({
          id: s.id,
          butcherId: s.butcherId ?? s.butcher?.id ?? '',
          butcherName: s.butcher?.nameAr ?? s.butcher?.nameEn ?? 'ملحمة',
          butcherNameAr: s.butcher?.nameAr ?? s.butcher?.nameEn ?? 'ملحمة',
          butcherLogo: s.butcher?.logo ?? s.thumbnail ?? '',
          isVerified: s.butcher?.subscriptionActive ?? false,
          thumbnail: s.thumbnail ?? '',
          mediaUrl: s.mediaUrl ?? undefined,
          caption: s.caption ?? undefined,
          captionAr: s.captionAr ?? undefined,
          postedAt: s.createdAt ?? new Date().toISOString(),
          duration: s.duration ?? 15,
          seen: false,
          type: s.type ?? 'update',
        }));
      }
    }

    const next: ButcherCatalogCache = { butchers, stories, fetchedAt: Date.now() };
    butcherCatalogCache = next;
    return next;
  })().finally(() => {
    butcherCatalogInflight = null;
  });

  return butcherCatalogInflight;
}

/**
 * Primary hook for the butchers marketplace.
 * Provides ranked + filtered butcher list, story management,
 * and per-butcher data helpers.
 */
export function useButcher() {
  const [filter, setFilter] = useState<ButcherFilter>(DEFAULT_FILTER);
  const [seenStoryIds, setSeenStoryIds] = useState<Set<string>>(new Set());
  const [selectedButcherId, setSelectedButcherId] = useState<string | null>(null);

  const [butchers, setButchers] = useState<ButcherProfile[]>([]);
  const [butcherStories, setButcherStories] = useState<ButcherStory[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProducts, setSelectedProducts] = useState<ButcherProduct[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<ButcherOffer[]>([]);
  const [selectedReviews, setSelectedReviews] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const fetchAll = async () => {
      try {
        const catalog = await loadButcherCatalog();
        if (!active) return;
        setButchers(catalog.butchers);
        setButcherStories(catalog.stories);
      } catch (err) {
        console.warn('[useButcher] Failed to fetch butchers:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchAll();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedButcherId) {
      setSelectedProducts([]);
      setSelectedOffers([]);
      setSelectedReviews([]);
      return;
    }
    const fetchDetails = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/butchers/${selectedButcherId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const b = json.data;
            if (b.products) {
              setSelectedProducts(b.products.map((p: any) => ({
                id: p.id,
                butcherId: p.butcherId,
                name: p.nameAr || p.nameEn,
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
              setSelectedOffers(b.offers.map((o: any) => ({
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
              setSelectedReviews(b.reviews.map((r: any) => ({
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
      } catch (err) {
        console.warn('[useButcher] Failed to fetch selected butcher details:', err);
      }
    };
    fetchDetails();
  }, [selectedButcherId]);

  // ── Ranked list ────────────────────────────────────────────────────────────
  const rankedAll = useMemo(() => rankButchers(butchers), [butchers]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredButchers = useMemo<ButcherProfile[]>(() => {
    return rankedAll.filter((b) => {
      if (filter.country !== 'all' && b.country !== filter.country) return false;
      if (filter.verifiedOnly && !b.subscriptionActive) return false;
      if (filter.isOpenNow && !b.workingHours.isOpen) return false;
      if (filter.searchQuery.trim()) {
        const q = filter.searchQuery.toLowerCase();
        return (
          b.nameAr.includes(q) ||
          b.name.toLowerCase().includes(q) ||
          b.cityAr.includes(q) ||
          b.specialties.some((s) => s.includes(q))
        );
      }
      return true;
    });
  }, [rankedAll, filter]);

  // ── Stories ────────────────────────────────────────────────────────────────
  const stories = useMemo<ButcherStory[]>(
    () =>
      butcherStories.map((s) => ({
        ...s,
        seen: seenStoryIds.has(s.id),
      })),
    [butcherStories, seenStoryIds]
  );

  const unseenCount = useMemo(
    () => stories.filter((s) => !s.seen).length,
    [stories]
  );

  const markStorySeen = (storyId: string) => {
    setSeenStoryIds((prev) => new Set([...prev, storyId]));
  };

  // ── Selected butcher data ──────────────────────────────────────────────────
  const selectedButcher = useMemo<ButcherProfile | null>(
    () => (selectedButcherId ? (butchers.find((b) => b.id === selectedButcherId) ?? null) : null),
    [selectedButcherId, butchers]
  );

  const selectedStories = useMemo<ButcherStory[]>(
    () => (selectedButcherId ? stories.filter((s) => s.butcherId === selectedButcherId) : []),
    [selectedButcherId, stories]
  );

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const setCountry = (country: Country | 'all') =>
    setFilter((f) => ({ ...f, country }));

  const setVerifiedOnly = (val: boolean) =>
    setFilter((f) => ({ ...f, verifiedOnly: val }));

  const setSearchQuery = (query: string) =>
    setFilter((f) => ({ ...f, searchQuery: query }));

  const setOpenNow = (val: boolean) =>
    setFilter((f) => ({ ...f, isOpenNow: val }));

  const resetFilters = () => setFilter(DEFAULT_FILTER);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: butchers.length,
      verified: butchers.filter((b) => b.subscriptionActive).length,
      regular: butchers.filter((b) => !b.subscriptionActive).length,
      openNow: butchers.filter((b) => b.workingHours.isOpen).length,
      countries: [...new Set(butchers.map((b) => b.country))].length,
    }),
    [butchers]
  );

  return {
    // Lists
    filteredButchers,
    rankedAll,
    stories,
    unseenCount,
    loading,

    // Selected butcher
    selectedButcherId,
    selectedButcher,
    selectedProducts,
    selectedOffers,
    selectedReviews,
    selectedStories,
    setSelectedButcherId,

    // Filters
    filter,
    setCountry,
    setVerifiedOnly,
    setSearchQuery,
    setOpenNow,
    resetFilters,

    // Stories
    markStorySeen,

    // Stats
    stats,
  };
}

export type UseButcherReturn = ReturnType<typeof useButcher>;

