import type { Router } from 'expo-router';

export function openUserProfile(router: Router, userId?: string | null) {
  if (!userId) return;
  router.push({ pathname: '/users/[id]', params: { id: userId } } as any);
}
