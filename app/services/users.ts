import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';

export type PublicUserProfile = {
  id: string;
  username: string;
  displayName: string;
  arabicName: string;
  avatar?: string;
  coverImage?: string;
  bio?: string;
  verified: boolean;
  country?: string;
  role?: string;
  /** Derived: USER | BUTCHER | LIVESTOCK_TRADER */
  accountType?: 'USER' | 'BUTCHER' | 'LIVESTOCK_TRADER';
  /** Account rating average (1–5), null when no reviews yet */
  rating: number | null;
  reviewCount: number;
  /** The current viewer's own rating of this account, if any (editable) */
  myRating?: number | null;
  followersCount: number;
  followingCount: number;
  listingsCount: number;
  postsCount: number;
  isFollowing: boolean;
};

export async function fetchUserProfile(userId: string): Promise<PublicUserProfile | null> {
  const res = await authFetch(`${API_BASE}/api/users/${userId}`);
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.success || !json.data) return null;
  return json.data as PublicUserProfile;
}

export type ConnectionUser = {
  id: string;
  username: string;
  displayName: string;
  arabicName: string;
  avatar?: string;
  verified: boolean;
  isFollowing: boolean;
};

export async function fetchUserConnections(
  userId: string,
  type: 'followers' | 'following',
): Promise<ConnectionUser[]> {
  const res = await authFetch(`${API_BASE}/api/users/${userId}/connections?type=${type}`);
  if (!res.ok) return [];
  const json = await res.json();
  if (!json.success || !json.data?.users) return [];
  return json.data.users as ConnectionUser[];
}

export async function toggleFollowUser(userId: string): Promise<{ following: boolean } | null> {
  const res = await authFetch(`${API_BASE}/api/users/${userId}/follow`, { method: 'POST' });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.success) return null;
  return json.data as { following: boolean };
}

export type RateUserResult = {
  rating: number | null;
  reviewCount: number;
  myRating: number;
};

/** Rate another user's account (1–5 stars). One rating per reviewer — calling again edits it. */
export async function rateUser(userId: string, rating: number): Promise<RateUserResult | null> {
  const res = await authFetch(`${API_BASE}/api/users/${userId}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.success) return null;
  return json.data as RateUserResult;
}
