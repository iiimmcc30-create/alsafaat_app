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
  rating: number | null;
  reviewCount: number;
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

export async function toggleFollowUser(userId: string): Promise<{ following: boolean } | null> {
  const res = await authFetch(`${API_BASE}/api/users/${userId}/follow`, { method: 'POST' });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.success) return null;
  return json.data as { following: boolean };
}
