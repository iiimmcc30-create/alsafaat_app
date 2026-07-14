import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';

export type MessageThreadType = 'DIRECT' | 'BUTCHER';

export interface MessageThreadItem {
  id: string;
  type: MessageThreadType;
  butcherId?: string | null;
  butcher?: {
    id: string;
    nameAr: string;
    nameEn?: string;
    logo?: string | null;
  } | null;
  participant: {
    id: string;
    displayName: string;
    arabicName: string;
    avatar?: string;
    verified: boolean;
  } | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
}

export function useMessageThreads(
  accessToken: string | null,
  type: MessageThreadType = 'DIRECT',
) {
  const [threads, setThreads] = useState<MessageThreadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    if (!accessToken) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/messages?type=${encodeURIComponent(type)}`,
      );
      if (res.status === 401) {
        setError('unauthorized');
        setThreads([]);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setThreads(
            json.data.map((t: any) => ({
              id: t.id,
              type: (t.type as MessageThreadType) || type,
              butcherId: t.butcherId ?? null,
              butcher: t.butcher
                ? {
                    id: t.butcher.id,
                    nameAr: t.butcher.nameAr,
                    nameEn: t.butcher.nameEn,
                    logo: t.butcher.logo,
                  }
                : null,
              participant: t.participant
                ? {
                    id: t.participant.id,
                    displayName:
                      t.participant.displayName || t.participant.username || '',
                    arabicName:
                      t.participant.arabicName ||
                      t.participant.displayName ||
                      '',
                    avatar: t.participant.avatar || undefined,
                    verified: t.participant.verified ?? false,
                  }
                : null,
              lastMessage: t.lastMessage,
              lastMessageAt: t.lastMessageAt,
              unread: t.unread ?? 0,
            })),
          );
          return;
        }
      }
      setError('fetch_failed');
    } catch {
      setError('fetch_failed');
    } finally {
      setLoading(false);
    }
  }, [accessToken, type]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  return { threads, loading, error, refetch: fetchThreads };
}
