// Powered by OnSpace.AI
// SAFAT — App Context (current user + global state)

import { createContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { User, Post, Listing } from '@/services/types';
import { useAuth } from './AuthContext';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';

const DEFAULT_USER: User = {
  id: '',
  username: '',
  displayName: '',
  arabicName: '',
  avatar: undefined,
  verified: false,
  followers: 0,
  rating: null,
  reviewCount: 0,
  country: 'SA',
  bio: '',
};

interface AppContextValue {
  me: User;
  updateMe: (updates: Partial<User>) => Promise<boolean>;
  posts: Post[];
  addPost: (post: Omit<Post, 'id' | 'author' | 'likes' | 'reposts' | 'comments' | 'postedAt' | 'liked' | 'reposted'>) => Promise<boolean>;
  updatePost: (postId: string, data: { content: string; arabicContent: string; image?: string | null }) => Promise<boolean>;
  deletePost: (postId: string) => Promise<boolean>;
  listings: Listing[];
  addListing: (listingData: any) => Promise<boolean>;
  likedPosts: Set<string>;
  repostedPosts: Set<string>;
  toggleLike: (postId: string) => Promise<void>;
  toggleRepost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<boolean>;
  removeListing: (listingId: string) => Promise<boolean>;
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

  // Helper mapping functions
  const mapBackendUser = useCallback((u: any): User => {
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName || '',
      arabicName: u.arabicName || '',
      avatar: u.avatar || undefined,
      verified: u.verified ?? false,
      followers: u.followersCount ?? 0,
      rating: typeof u.rating === 'number' ? u.rating : null,
      reviewCount: u.reviewCount ?? 0,
      country: u.country || 'SA',
      bio: u.bio || '',
    };
  }, []);

  const mapBackendPost = useCallback((p: any): Post => {
    return {
      id: p.id,
      author: mapBackendUser(p.author),
      content: p.content,
      arabicContent: p.arabicContent,
      image: p.image,
      likes: p.likesCount ?? 0,
      reposts: p.repostsCount ?? 0,
      comments: p.commentsCount ?? 0,
      postedAt: new Date(p.createdAt).toLocaleDateString('ar-SA'),
      liked: p.liked ?? false,
      reposted: p.reposted ?? false,
    };
  }, [mapBackendUser]);

  const mapBackendListing = useCallback((l: any): Listing => {
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
      images: l.images && l.images.length > 0 ? l.images : [],
      description: l.description,
      arabicDescription: l.arabicDescription,
      seller: mapBackendUser(l.seller),
      featured: l.featured ?? false,
      postedAt: new Date(l.createdAt).toLocaleDateString('ar-SA'),
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
      const res = await (accessToken
        ? authFetch(`${API_BASE}/api/listings`, { headers })
        : fetch(`${API_BASE}/api/listings`, { headers }));
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.listings) {
          setListingsState(json.data.listings.map(mapBackendListing));
        }
      }
    } catch (err) {
      console.warn('[AppContext] Failed to fetch listings:', err);
    }
  }, [accessToken, mapBackendListing]);

  const fetchPosts = useCallback(async () => {
    try {
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const res = await (accessToken
        ? authFetch(`${API_BASE}/api/posts`, { headers })
        : fetch(`${API_BASE}/api/posts`, { headers }));
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.posts) {
          const fetchedPosts = json.data.posts.map(mapBackendPost);
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

  // Trigger loading when auth state updates
  useEffect(() => {
    refetchData();
  }, [refetchData, isAuthenticated, accessToken]);

  const updateMe = async (updates: Partial<User>): Promise<boolean> => {
    if (!isAuthenticated || !accessToken || !user) return false;
    try {
      const res = await authFetch(`${API_BASE}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: updates.displayName,
          arabicName: updates.arabicName,
          bio: updates.bio,
          avatar: updates.avatar,
          country: updates.country,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMe(mapBackendUser(json.data));
          return true;
        }
      }
    } catch (err) {
      console.warn('[AppContext] Update user profile failed:', err);
    }
    return false;
  };

  const addPost = async (postData: Omit<Post, 'id' | 'author' | 'likes' | 'reposts' | 'comments' | 'postedAt' | 'liked'>): Promise<boolean> => {
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
          setPosts((prev) => [mapBackendPost(json.data), ...prev]);
          return true;
        }
      }
    } catch (err) {
      console.warn('[AppContext] Add post failed:', err);
    }
    return false;
  };

  const addListing = async (listingData: any): Promise<boolean> => {
    if (!isAuthenticated || !accessToken) return false;
    try {
      const res = await authFetch(`${API_BASE}/api/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setListingsState((prev) => [mapBackendListing(json.data), ...prev]);
          return true;
        }
      }
    } catch (err) {
      console.warn('[AppContext] Add listing failed:', err);
    }
    return false;
  };

  const removeListing = async (listingId: string): Promise<boolean> => {
    if (!isAuthenticated || !accessToken) return false;
    try {
      const res = await authFetch(`${API_BASE}/api/listings/${listingId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setListingsState((prev) => prev.filter((l) => l.id !== listingId));
        return true;
      }
    } catch (err) {
      console.warn('[AppContext] Delete listing failed:', err);
    }
    return false;
  };

  const toggleLike = async (postId: string) => {
    if (!isAuthenticated || !accessToken) return;
    try {
      const res = await authFetch(`${API_BASE}/api/posts/${postId}/like`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const isLikedNow = json.data.liked;
          setLikedPosts((prev) => {
            const next = new Set(prev);
            if (isLikedNow) {
              next.add(postId);
            } else {
              next.delete(postId);
            }
            return next;
          });
          
          // Update post likes count in state
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
            })
          );
        }
      }
    } catch (err) {
      console.warn('[AppContext] Toggle like failed:', err);
    }
  };

  const toggleRepost = async (postId: string) => {
    if (!isAuthenticated || !accessToken) return;
    try {
      const res = await authFetch(`${API_BASE}/api/posts/${postId}/repost`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const isRepostedNow = json.data.reposted;
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
  };

  const addComment = async (postId: string, content: string): Promise<boolean> => {
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
  };

  const updatePost = async (
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
  };

  const deletePost = async (postId: string): Promise<boolean> => {
    if (!isAuthenticated || !accessToken) return false;
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
        return true;
      }
    } catch (err) {
      console.warn('[AppContext] Delete post failed:', err);
    }
    return false;
  };

  return (
    <AppContext.Provider
      value={{
        me,
        updateMe,
        posts,
        addPost,
        updatePost,
        deletePost,
        listings: listingsState,
        addListing,
        likedPosts,
        repostedPosts,
        toggleLike,
        toggleRepost,
        addComment,
        removeListing,
        refetchData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
