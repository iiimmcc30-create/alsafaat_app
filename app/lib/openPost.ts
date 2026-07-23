import type { Router } from 'expo-router';

export function openPostDetail(
  router: Router,
  postId: string,
  opts?: { focusComment?: boolean },
) {
  router.push({
    pathname: '/post/[id]',
    params: {
      id: postId,
      ...(opts?.focusComment ? { focusComment: '1' } : {}),
    },
  } as never);
}
