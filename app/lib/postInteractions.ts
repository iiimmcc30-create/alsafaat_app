// lib/postInteractions.ts — shared post action handlers for feed screens

import { Alert, Share } from 'react-native';
import { Router } from 'expo-router';
import { Post, User } from '@/services/types';

export function requireAuth(isAuthenticated: boolean, action: string): boolean {
  if (isAuthenticated) return true;
  Alert.alert('تسجيل الدخول', `يجب تسجيل الدخول لـ${action}`);
  return false;
}

export async function sharePost(post: Post) {
  try {
    await Share.share({
      message: `${post.arabicContent}\n\n— ${post.author.arabicName} (@${post.author.username}) عبر تطبيق سروح 🐪`,
      title: 'مشاركة منشور',
    });
  } catch {
    // dismissed
  }
}

export function showPostMenu(
  post: Post,
  me: User,
  router: Router,
  deletePost: (id: string) => Promise<boolean>,
) {
  const isOwner = post.author.id === me.id;
  if (!isOwner) {
    Alert.alert('المنشور', undefined, [{ text: 'إغلاق', style: 'cancel' }]);
    return;
  }
  Alert.alert('إدارة المنشور', undefined, [
    {
      text: 'تعديل',
      onPress: () => router.push({ pathname: '/create/post', params: { editId: post.id } }),
    },
    {
      text: 'حذف',
      style: 'destructive',
      onPress: () => {
        Alert.alert('حذف المنشور', 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.', [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'حذف',
            style: 'destructive',
            onPress: async () => {
              const ok = await deletePost(post.id);
              if (!ok) Alert.alert('خطأ', 'فشل حذف المنشور');
            },
          },
        ]);
      },
    },
    { text: 'إلغاء', style: 'cancel' },
  ]);
}
