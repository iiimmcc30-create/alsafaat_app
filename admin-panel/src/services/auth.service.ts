import { apiClient, unwrap } from './api.client';

export type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  arabicName: string;
  avatar: string | null;
  role: 'ADMIN' | 'MODERATOR';
};

export type LoginResult = {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
};

export async function adminLogin(login: string, password: string): Promise<LoginResult> {
  const res = await apiClient.post('/admin/auth/login', { login, password });
  return unwrap<LoginResult>(res);
}

export async function adminMe(): Promise<{ user: AdminUser }> {
  const res = await apiClient.get('/admin/auth/me');
  return unwrap(res);
}

export function persistSession(data: LoginResult) {
  localStorage.setItem('admin_access_token', data.accessToken);
  localStorage.setItem('admin_refresh_token', data.refreshToken);
  localStorage.setItem('admin_user', JSON.stringify(data.user));
  const maxAge = 60 * 60 * 12;
  document.cookie = `admin_token=${encodeURIComponent(data.accessToken)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearSession() {
  localStorage.removeItem('admin_access_token');
  localStorage.removeItem('admin_refresh_token');
  localStorage.removeItem('admin_user');
  document.cookie = 'admin_token=; path=/; max-age=0';
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('admin_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}
