import { API_BASE } from './api';
import type { Listing } from './types';

export type ListingSearchParams = {
  search?: string;
  category?: string;
  country?: string;
  minPrice?: number;
  maxPrice?: number;
  cursor?: string;
};

type BackendListing = {
  id: string;
  title: string;
  arabicTitle: string;
  price: number;
  currency?: string;
  category: Listing['category'];
  breed?: string;
  age?: string;
  location: string;
  arabicLocation: string;
  country: Listing['country'];
  images?: string[];
  description: string;
  arabicDescription: string;
  featured?: boolean;
  createdAt: string;
  seller: {
    id: string;
    username: string;
    displayName?: string;
    arabicName?: string;
    avatar?: string;
    verified?: boolean;
    country?: string;
  };
};

function mapListing(l: BackendListing): Listing {
  return {
    id: l.id,
    title: l.title,
    arabicTitle: l.arabicTitle,
    price: l.price,
    currency: l.currency || 'SAR',
    category: l.category,
    breed: l.breed || '',
    age: l.age || '',
    location: l.location,
    arabicLocation: l.arabicLocation,
    country: l.country,
    images: l.images?.length ? l.images : [],
    description: l.description,
    arabicDescription: l.arabicDescription,
    seller: {
      id: l.seller.id,
      username: l.seller.username,
      displayName: l.seller.displayName || '',
      arabicName: l.seller.arabicName || '',
      avatar: l.seller.avatar,
      verified: l.seller.verified ?? false,
      followers: 0,
      following: 0,
      rating: null,
      reviewCount: 0,
      country: l.seller.country || 'SA',
      bio: '',
    },
    featured: l.featured ?? false,
    postedAt: new Date(l.createdAt).toLocaleDateString('ar-SA'),
    createdAt: l.createdAt,
  };
}

export async function searchListings(
  params: ListingSearchParams,
  accessToken?: string | null,
): Promise<Listing[]> {
  const qs = new URLSearchParams();
  if (params.search && params.search.length >= 2) qs.set('search', params.search);
  if (params.category) qs.set('category', params.category);
  if (params.country) qs.set('country', params.country);
  if (params.minPrice != null) qs.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) qs.set('maxPrice', String(params.maxPrice));
  if (params.cursor) qs.set('cursor', params.cursor);

  const headers: HeadersInit = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};
  const res = await fetch(`${API_BASE}/api/listings?${qs.toString()}`, { headers });
  if (!res.ok) return [];

  const json = await res.json();
  if (!json.success || !Array.isArray(json.data?.listings)) return [];
  return json.data.listings.map(mapListing);
}
