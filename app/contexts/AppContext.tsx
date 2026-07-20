// Powered by OnSpace.AI
// SAFAT — App Context (current user + global state)

import { createContext, ReactNode, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Post, Listing } from '@/services/types';
import { useAuth } from './AuthContext';
import { API_BASE } from '@/services/api';
import { parseApiError } from '@/services/apiError';
import { authFetch } from '@/services/authFetch';
import { fetchWithTimeout } from '@/services/fetchWithTimeout';
import { needsUpload } from '@/services/mediaUri';
import { uploadImageFromUri } from '@/services/upload';

const BOOKMARKS_STORAGE_KEY = 'sarouh:bookmarked_posts';

export type ActionResult = { ok: boolean; error?: string };

const DEFAULT_USER: User = {
  id: '',
  username: '',
  displayName: '',
  arabicName: '',
  avatar: undefined,
  verified: false,
  followers: 0,
  following: 0,
  rating: null,
  reviewCount: 0,
  country: 'SA',
  bio: '',
};

interface AppContextValue {
  me: User;
  updateMe: (updates: Partial<User>) => Promise<ActionResult>;
  posts: Post[];
  fetchPosts: (feed?: 'for_you' | 'following') => Promise<void>;
  addPost: (post: Omit<Post, 'id' | 'author' | 'likes' | 'reposts' | 'comments' | 'postedAt' | 'liked' | 'reposted'>) => Promise<boolean>;
  updatePost: (postId: string, data: { content: string; arabicContent: string; image?: string | null }) => Promise<boolean>;
  deletePost: (postId: string) => Promise<ActionResult>;
  listings: Listing[];
  addListing: (listingData: any) => Promise<ActionResult>;
  likedPosts: Set<string>;
  repostedPosts: Set<string>;
  bookmarkedPosts: Set<string>;
  toggleLike: (postId: string) => Promise<void>;
  toggleRepost: (postId: string) => Promise<void>;
  toggleBookmark: (postId: string) => void;
  addComment: (postId: string, content: string) => Promise<boolean>;
  removeListing: (listingId: string) => Promise<ActionResult>;
  refetchData: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, isAuthenticated } = useAuth();
  const [me, setMe] = useState<User>(DEFAULT_USER);
  const [posts, setPosts] = useState<Post[]>([]);
  const [listingsState, setListingsState] = useState<Listing[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());

  // Bookmarks are device-local (no backend model yet) — restore on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
        if (raw) setBookmarkedPosts(new Set(JSON.parse(raw)));
      } catch {
        /* ignore corrupt/missing storage */
      }
    })();
  }, []);

  const toggleBookmark = useCallback((postId: string) => {
    setBookmarkedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  // Helper mapping functions
  const mapBackendUser = useCallback((u: any): User => {
    if (!u || typeof u !== 'object') return { ...DEFAULT_USER };
    return {
      id: String(u.id ?? ''),
      username: u.username || '',
      displayName: u.displayName || '',
      arabicName: u.arabicName || '',
      avatar: u.avatar || undefined,
      coverImage: u.coverImage || undefined,
      verified: u.verified ?? false,
      isAI: u.isAI ?? false,
      followers: u.followersCount ?? 0,
      following: u.followingCount ?? 0,
      rating: typeof u.rating === 'number' ? u.rating : null,
      reviewCount: u.reviewCount ?? 0,
      country: u.country || 'SA',
      bio: u.bio || '',
    };
  }, []);

  const mapBackendPost = useCallback((p: any): Post | null => {
    if (!p?.id) return null;
    return {
      id: p.id,
      author: mapBackendUser(p.author),
      content: p.content,
      arabicContent: p.arabicContent,
      image: p.image,
      images: Array.isArray(p.images) && p.images.length > 0 ? p.images : p.image ? [p.image] : undefined,
      video: p.video ?? undefined,
      likes: p.likesCount ?? 0,
      reposts: p.repostsCount ?? 0,
      comments: p.commentsCount ?? 0,
      views: typeof p.viewsCount === 'number' ? p.viewsCount : undefined,
      postedAt: new Date(p.createdAt).toLocaleDateString('ar-SA'),
      createdAt: p.createdAt,
      liked: p.liked ?? false,
      reposted: p.reposted ?? false,
    };
  }, [mapBackendUser]);

  const mapBackendListing = useCallback((l: any): Listing | null => {
    if (!l?.id) return null;
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
      contactPhone: l.contactPhone || undefined,
      weightKg: typeof l.weightKg === 'number' ? l.weightKg : undefined,
      images: l.images && l.images.length > 0 ? l.images : [],
      description: l.description,
      arabicDescription: l.arabicDescription,
      seller: mapBackendUser(l.seller),
      featured: l.featured ?? false,
      postedAt: new Date(l.createdAt).toLocaleDateString('ar-SA'),
      createdAt: l.createdAt,
      views: typeof l.views === 'number' ? l.views : undefined,
    };
  }, [mapBackendUser]);

  const fetchUserData = useCallback(async () => {
    if (!isAuthenticated || !accessToken || !user) return;
    try {
      const res = await authFetch(`${API_BASE}/api/users/${user.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMe(mapBackendUser(json.data));
        }
      }
    } catch (err) {
      console.warn('[AppContext] Failed to fetch user profile:', err);
    }
  }, [isAuthenticated, accessToken, user, mapBackendUser]);

  const fetchListings = useCallback(async () => {
    try {
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const fetchList = async (url: string) => {
        const res = await (accessToken
          ? authFetch(url, { headers })
          : fetchWithTimeout(url, { headers }));
        if (!res.ok) return [] as Listing[];
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.listings)) {
          return json.data.listings
            .map(mapBackendListing)
            .filter((listing: Listing | null): listing is Listing =>
              Boolean(listing && listing.country !== 'EG'),
            );
        }
        return [] as Listing[];
      };

      const marketPromise = fetchList(`${API_BASE}/api/listings`);
      const minePromise =
        accessToken && user?.id
          ? fetchList(`${API_BASE}/api/listings?sellerId=${encodeURIComponent(user.id)}`)
          : Promise.resolve([] as Listing[]);

      const [market, mine] = await Promise.all([marketPromise, minePromise]);

      const byId = new Map<string, Listing>();
      for (const l of [...mine, ...market]) byId.set(l.id, l);
      setListingsState(Array.from(byId.values()));
    } catch (err) {
      console.warn('[AppContext] Failed to fetch listings:', err);
    }
  }, [accessToken, user?.id, mapBackendListing]);

  // Keep ownership checks working even before profile fetch finishes
  useEffect(() => {
    if (!user) {
      setMe(DEFAULT_USER);
      return;
    }
    setMe((prev) => ({
      ...prev,
      id: user.id || prev.id,
      username: user.username || prev.username,
      displayName: user.displayName || prev.displayName,
      arabicName: user.arabicName || user.displayName || prev.arabicName,
      avatar: user.avatar ?? prev.avatar,
      verified: user.verified ?? prev.verified,
      country: (user.country as User['country']) || prev.country || 'SA',
    }));
  }, [user]);

  const fetchPosts = useCallback(async (feed: 'for_you' | 'following' = 'for_you') => {
    try {
      const qs = feed === 'following' ? '?feed=following' : '';
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const res = await (accessToken
        ? authFetch(`${API_BASE}/api/posts${qs}`, { headers })
        : fetchWithTimeout(`${API_BASE}/api/posts${qs}`, { headers }));
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.posts) {
          const fetchedPosts = (json.data.posts as unknown[])
            .map(mapBackendPost)
            .filter((p: Post | null): p is Post => Boolean(p?.id));
          setPosts(fetchedPosts);

          // Initialize liked / reposted sets
          const liked = new Set<string>();
          const reposted = new Set<string>();
          fetchedPosts.forEach((p: Post) => {
            if (p.liked) liked.add(p.id);
            if (p.reposted) reposted.add(p.id);
          });
          setLikedPosts(liked);
          setRepostedPosts(reposted);
        }
      }
    } catch (err) {
      console.warn('[AppContext] Failed to fetch posts:', err);
    }
  }, [accessToken, mapBackendPost]);

  const refetchData = useCallback(async () => {
    await Promise.all([fetchUserData(), fetchListings(), fetchPosts()]);
  }, [fetchUserData, fetchListings, fetchPosts]);

  const lastBootstrapKey = useRef<string | null>(null);

  // Load once per auth session (token + user id), not on every callback identity change
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      lastBootstrapKey.current = null;
      if (!isAuthenticated) {
        setPosts([]);
        setListingsState([]);
        setLikedPosts(new Set());
        setRepostedPosts(new Set());
      }
      return;
    }
    const key = `${accessToken}:${user?.id ?? ''}`;
    if (lastBootstrapKey.current === key) return;
    lastBootstrapKey.current = key;
    void refetchData();
  }, [isAuthenticated, accessToken, user?.id, refetchData]);

  const updateMe = useCallback(async (updates: Partial<User>): Promise<ActionResult> => {
    if (!isAuthenticated || !accessToken || !user) {
      return { ok: false, error: 'يجب تسجيل الدخول أولاً' };
    }
    try {
      let avatar = updates.avatar;
      let coverImage = updates.coverImage;
      let uploadWarning: string | undefined;

      if (needsUpload(avatar)) {
        try {
          avatar = await uploadImageFromUri(accessToken, avatar, 'avatars');
        } catch (err) {
          uploadWarning =
            err instanceof Error ? err.message : 'تعذّر رفع صورة الملف الشخصي';
          avatar = undefined;
        }
      }
      if (needsUpload(coverImage)) {
        try {
          coverImage = await uploadImageFromUri(accessToken, coverImage, 'avatars');
        } catch (err) {
          uploadWarning =
            err instanceof Error ? err.message : 'تعذّر رفع صورة الغلاف';
          coverImage = undefined;
        }
      }

      const body: Record<string, unknown> = {};
      if (updates.displayName !== undefined) body.displayName = updates.displayName;
      if (updates.arabicName !== undefined) body.arabicName = updates.arabicName;
      if (updates.username !== undefined) body.username = updates.username;
      if (updates.bio !== undefined) body.bio = updates.bio;
      if (updates.country !== undefined) body.country = updates.country;
      if (avatar !== undefined) body.avatar = avatar;
      if (coverImage !== undefined) body.coverImage = coverImage;

      if (Object.keys(body).length === 0) {
        return {
          ok: false,
          error: uploadWarning || 'لا توجد تغييرات للحفظ',
        };
      }

      const res = await authFetch(`${API_BASE}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMe(mapBackendUser(json.data));
          return uploadWarning ? { ok: true, error: uploadWarning } : { ok: true };
        }
      }
      return { ok: false, error: uploadWarning ?? (await parseApiError(res)) };
    } catch (err) {
      console.warn('[AppContext] Update user profile failed:', err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'فشل حفظ التغييرات',
      };
    }
  }, [isAuthenticated, accessToken, user, mapBackendUser]);

  const addPost = useCallback(async (postData: Omit<Post, 'id' | 'author' | 'likes' | 'reposts' | 'comments' | 'postedAt' | 'liked'>): Promise<boolean> => {
    if (!isAuthenticated || !accessToken) return false;
    try {
      const res = await authFetch(`${API_BASE}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const mapped = mapBackendPost(json.data);
          if (mapped) setPosts((prev) => [mapped, ...prev]);
          return Boolean(mapped);
        }
      }
    } catch (err) {
      console.warn('[AppContext] Add post failed:', err);
    }
    return false;
  }, [isAuthenticated, accessToken, mapBackendPost]);

  const addListing = useCallback(async (listingData: any): Promise<ActionResult> => {
    if (!isAuthenticated || !accessToken) {
      return { ok: false, error: 'يجب تسجيل الدخول أولاً' };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const mapped = mapBackendListing(json.data);
          if (mapped) setListingsState((prev) => [mapped, ...prev]);
          return mapped ? { ok: true } : { ok: false, error: 'استجابة غير صالحة' };
        }
      }
      return { ok: false, error: await parseApiError(res) };
    } catch (err) {
      console.warn('[AppContext] Add listing failed:', err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'فشل نشر الإعلان',
      };
    }
  }, [isAuthenticated, accessToken, mapBackendListing]);

  const removeListing = useCallback(async (listingId: string): Promise<ActionResult> => {
    if (!isAuthenticated || !accessToken) {
      return { ok: false, error: 'يجب تسجيل الدخول أولاً' };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/listings/${listingId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setListingsState((prev) => prev.filter((l) => l.id !== listingId));
        return { ok: true };
      }
      return { ok: false, error: await parseApiError(res) };
    } catch (err) {
      console.warn('[AppContext] Delete listing failed:', err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'فشل حذف الإعلان',
      };
    }
  }, [isAuthenticated, accessToken]);

  const toggleLike = useCallback(async (postId: string) => {
    if (!isAuthenticated || !accessToken) return;
    try {
      const res = await authFetch(`${API_BASE}/api/posts/${postId}/like`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const isLikedNow = Boolean(json.data?.liked);
          setLikedPosts((prev) => {
            const next = new Set(prev);
            if (isLikedNow) {
              next.add(postId);
            } else {
              next.delete(postId);
            }
            return next;
          });

          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === postId) {
                return {
                  ...p,
                  likes: isLikedNow ? p.likes + 1 : Math.max(0, p.likes - 1),
                  liked: isLikedNow,
                };
              }
              return p;
            }),
          );
        }
      }
    } catch (err) {
      console.warn('[AppContext] Toggle like failed:', err);
    }
  }, [isAuthenticated, accessToken]);

  const toggleRepost = useCallback(async (postId: string) => {
    if (!isAuthenticated || !accessToken) return;
    try {
      const res = await authFetch(`${API_BASE}/api/posts/${postId}/repost`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const isRepostedNow = Boolean(json.data?.reposted);
          setRepostedPosts((prev) => {
            const next = new Set(prev);
            if (isRepostedNow) next.add(postId);
            else next.delete(postId);
            return next;
          });
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id !== postId) return p;
              return {
                ...p,
                reposts: isRepostedNow ? p.reposts + 1 : Math.max(0, p.reposts - 1),
                reposted: isRepostedNow,
              };
            }),
          );
        }
      }
    } catch (err) {
      console.warn('[AppContext] Toggle repost failed:', err);
    }
  }, [isAuthenticated, accessToken]);

  const addComment = useCallback(async (postId: string, content: string): Promise<boolean> => {
    if (!isAuthenticated || !accessToken || !content.trim()) return false;
    try {
      const res = await authFetch(`${API_BASE}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, comments: p.comments + 1 } : p)),
          );
          return true;
        }
      }
    } catch (err) {
      console.warn('[AppContext] Add comment failed:', err);
    }
    return false;
  }, [isAuthenticated, accessToken]);

  const updatePost = useCallback(async (
    postId: string,
    data: { content: string; arabicContent: string; image?: string | null },
  ): Promise<boolean> => {
    if (!isAuthenticated || !accessToken) return false;
    try {
      const res = await authFetch(`${API_BASE}/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    content: json.data.content,
                    arabicContent: json.data.arabicContent,
                    image: json.data.image ?? p.image,
                  }
                : p,
            ),
          );
          return true;
        }
      }
    } catch (err) {
      console.warn('[AppContext] Update post failed:', err);
    }
    return false;
  }, [isAuthenticated, accessToken]);

  const deletePost = useCallback(async (postId: string): Promise<ActionResult> => {
    if (!isAuthenticated || !accessToken) {
      return { ok: false, error: 'يجب تسجيل الدخول أولاً' };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/posts/${postId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setLikedPosts((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        setRepostedPosts((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        return { ok: true };
      }
      return { ok: false, error: await parseApiError(res) };
    } catch (err) {
      console.warn('[AppContext] Delete post failed:', err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'فشل حذف المنشور',
      };
    }
  }, [isAuthenticated, accessToken]);

  const value = useMemo<AppContextValue>(
    () => ({
      me,
      updateMe,
      posts,
      fetchPosts,
      addPost,
      updatePost,
      deletePost,
      listings: listingsState,
      addListing,
      likedPosts,
      repostedPosts,
      bookmarkedPosts,
      toggleLike,
      toggleRepost,
      toggleBookmark,
      addComment,
      removeListing,
      refetchData,
    }),
    [
      me,
      updateMe,
      posts,
      fetchPosts,
      addPost,
      updatePost,
      deletePost,
      listingsState,
      addListing,
      likedPosts,
      repostedPosts,
      bookmarkedPosts,
      toggleLike,
      toggleRepost,
      toggleBookmark,
      addComment,
      removeListing,
      refetchData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
