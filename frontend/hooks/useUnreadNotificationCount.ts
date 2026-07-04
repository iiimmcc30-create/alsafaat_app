// Lightweight unread badge count for header bell icon

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUnreadNotificationCount } from '@/services/notifications';

const POLL_MS = 45_000;

export function useUnreadNotificationCount() {
  const { isAuthenticated, accessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await fetchUnreadNotificationCount();
      if (mountedRef.current) setUnreadCount(count);
    } catch {
      // Keep last known count on transient failures
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { unreadCount, refresh };
}
