// Powered by OnSpace.AI
// SAFAT — Auth Context (JWT + OTP + Google)

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerAuthFetch } from '@/services/authFetch';
import { fetchWithTimeout } from '@/services/fetchWithTimeout';
import { API_BASE } from '@/services/api';
import { clearPushTokenOnLogout } from '@/lib/notifications';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  displayName: string;
  arabicName?: string;
  username: string;
  avatar?: string;
  verified: boolean;
  country?: string;
  role?: string;
  subscription?: { plan: string; expiresAt: string } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // TODO(Migration): replace activeMode with capability-based navigation after Butcher Application workflow.
  activeMode: 'USER' | 'BUTCHER';
  switchMode: (mode: 'USER' | 'BUTCHER') => void;
  // OTP flow
  sendOtp:   (phone: string, channel?: 'sms' | 'whatsapp') => Promise<{ success: boolean; devMode?: boolean; error?: string }>;
  verifyOtp: (phone: string, code: string, purpose?: 'login' | 'reset_password') => Promise<{ success: boolean; isNew?: boolean; phone?: string; phoneToken?: string; error?: string }>;
  // Google flow
  signInWithGoogle: (idToken: string) => Promise<{ success: boolean; isNew?: boolean; googleData?: any; error?: string }>;
  // Password flow
  signInWithPassword: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (phone: string, phoneToken: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  // Register (بعد OTP أو Google)
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  // Session
  signOut:        () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

export interface RegisterData {
  phone:        string;
  phone_token:  string;
  displayName:  string;
  arabicName?:  string;
  username:     string;
  country:      string;
  password?:    string;
  // إذا عبر Google
  googleId?:    string;
  email?:       string;
  avatar?:      string;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN:  'safat_access_token',
  REFRESH_TOKEN: 'safat_refresh_token',
  USER:          'safat_user',
} as const;

// ── Context ───────────────────────────────────────────────────────────────────
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [activeMode, setActiveMode]   = useState<'USER' | 'BUTCHER'>('USER');
  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken;

  const clearSession = useCallback(async () => {
    await AsyncStorage.multiRemove([...Object.values(STORAGE_KEYS), 'safat_active_mode']);
    setUser(null);
    setAccessToken(null);
    setActiveMode('USER');
  }, []);

  const persistTokens = useCallback(async (access: string, refresh?: string) => {
    const pairs: [string, string][] = [[STORAGE_KEYS.ACCESS_TOKEN, access]];
    if (refresh) pairs.push([STORAGE_KEYS.REFRESH_TOKEN, refresh]);
    await AsyncStorage.multiSet(pairs);
    setAccessToken(access);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const refresh = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refresh) return false;

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: refresh, refreshToken: refresh }),
      });

      if (res.status === 401) {
        await clearSession();
        return false;
      }
      if (!res.ok) return false;

      const responseJson = await res.json().catch(() => ({}));
      const data = (responseJson && responseJson.success && responseJson.data !== undefined)
        ? responseJson.data
        : responseJson;
      const access = data.access_token ?? data.accessToken;
      const newRefresh = data.refresh_token ?? data.refreshToken;
      if (!access) return false;

      await persistTokens(access, newRefresh);
      return true;
    } catch {
      return false;
    }
  }, [clearSession, persistTokens]);

  const refreshSessionRef = useRef(refreshSession);
  refreshSessionRef.current = refreshSession;

  useEffect(() => {
    registerAuthFetch({
      getToken: () => accessTokenRef.current,
      refresh: () => refreshSessionRef.current(),
    });
  }, []);

  // ── Restore session ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser, storedMode, storedRefresh] = await AsyncStorage.multiGet([
          STORAGE_KEYS.ACCESS_TOKEN,
          STORAGE_KEYS.USER,
          'safat_active_mode',
          STORAGE_KEYS.REFRESH_TOKEN,
        ]);
        const token    = storedToken[1];
        const userJson = storedUser[1];
        const mode     = storedMode[1];
        const refresh  = storedRefresh[1];
        if (token && userJson) {
          setAccessToken(token);
          const parsedUser = JSON.parse(userJson);
          setUser(parsedUser);
          if (mode === 'USER' || mode === 'BUTCHER') {
            setActiveMode('USER');
          } else if (parsedUser.role === 'BUTCHER') {
            setActiveMode('USER');
          }
          // Validate stored session and pick up rotated refresh tokens
          if (refresh) {
            await refreshSessionRef.current();
          }
        }
      } catch {
        // Storage read failed — start fresh
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Helper: حفظ الجلسة ────────────────────────────────────────────────────
  const saveSession = useCallback(async (userData: AuthUser, access: string, refresh: string) => {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.ACCESS_TOKEN,  access],
      [STORAGE_KEYS.REFRESH_TOKEN, refresh],
      [STORAGE_KEYS.USER,          JSON.stringify(userData)],
    ]);
    setAccessToken(access);
    setUser(userData);

    setActiveMode('USER');
    await AsyncStorage.setItem('safat_active_mode', 'USER');
  }, []);

  // ── تبديل الوضع ────────────────────────────────────────────────────────────
  const switchMode = useCallback(async (mode: 'USER' | 'BUTCHER') => {
    setActiveMode(mode);
    await AsyncStorage.setItem('safat_active_mode', mode);
  }, []);

  // ── إرسال OTP ─────────────────────────────────────────────────────────────
  const sendOtp = useCallback(async (phone: string, channel: 'sms' | 'whatsapp' = 'sms') => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, channel }),
      });
      const responseJson = await res.json().catch(() => ({}));
      const data = (responseJson && responseJson.success && responseJson.data !== undefined) ? responseJson.data : responseJson;
      
      if (!res.ok) {
        return { success: false, error: responseJson.messageAr ?? responseJson.message_ar ?? 'فشل إرسال الرمز' };
      }
      return { success: true, devMode: data.dev_mode ?? false };
    } catch {
      return { success: false, error: 'تعذّر الاتصال بالخادم' };
    }
  }, []);

  // ── التحقق من OTP ─────────────────────────────────────────────────────────
  const verifyOtp = useCallback(async (phone: string, code: string, purpose: 'login' | 'reset_password' = 'login') => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, purpose }),
      });
      const responseJson = await res.json().catch(() => ({}));
      const data = (responseJson && responseJson.success && responseJson.data !== undefined) ? responseJson.data : responseJson;

      if (!res.ok) {
        return { success: false, error: responseJson.messageAr ?? responseJson.message_ar ?? 'الرمز غير صحيح' };
      }

      if (data.is_new_user || purpose === 'reset_password') {
        return { success: true, isNew: data.is_new_user ?? false, phone, phoneToken: data.phone_token };
      }

      // مستخدم موجود — احفظ الجلسة
      await saveSession(data.user, data.access_token ?? data.accessToken, data.refresh_token ?? data.refreshToken);
      return { success: true, isNew: false };
    } catch {
      return { success: false, error: 'تعذّر الاتصال بالخادم' };
    }
  }, [saveSession]);

  // ── Google Sign In ─────────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async (idToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      const responseJson = await res.json().catch(() => ({}));
      const data = (responseJson && responseJson.success && responseJson.data !== undefined) ? responseJson.data : responseJson;

      if (!res.ok) {
        return { success: false, error: responseJson.messageAr ?? responseJson.message_ar ?? 'فشل الدخول بـ Google' };
      }

      if (data.is_new_user) {
        return {
          success:    true,
          isNew:      true,
          googleData: {
            googleId:    data.google_id,
            email:       data.email,
            displayName: data.display_name,
            avatar:      data.avatar,
          },
        };
      }

      await saveSession(data.user, data.access_token ?? data.accessToken, data.refresh_token ?? data.refreshToken);
      return { success: true, isNew: false };
    } catch {
      return { success: false, error: 'تعذّر الاتصال بالخادم' };
    }
  }, [saveSession]);

  // ── تسجيل الدخول بكلمة المرور ──────────────────────────────────────────────
  const signInWithPassword = useCallback(async (login: string, password: string) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const responseJson = await res.json().catch(() => ({}));
      const data = (responseJson && responseJson.success && responseJson.data !== undefined) ? responseJson.data : responseJson;

      if (!res.ok) {
        return { success: false, error: responseJson.messageAr ?? responseJson.message_ar ?? 'بيانات الدخول غير صحيحة' };
      }

      const access = data.accessToken ?? data.access_token;
      const refresh = data.refreshToken ?? data.refresh_token;

      await saveSession(data.user, access, refresh);
      return { success: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          success: false,
          error: __DEV__
            ? `انتهت مهلة الاتصال بالخادم (${API_BASE}). تأكدي أن الباك إند شغال (npm run dev:all) وعلى USB استخدمي npm run android:usb`
            : 'انتهت مهلة الاتصال بالخادم',
        };
      }
      return {
        success: false,
        error: __DEV__
          ? `تعذّر الاتصال بالخادم (${API_BASE})`
          : 'تعذّر الاتصال بالخادم',
      };
    }
  }, [saveSession]);

  const resetPassword = useCallback(async (phone: string, phoneToken: string, newPassword: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, phone_token: phoneToken, newPassword }),
      });
      const responseJson = await res.json().catch(() => ({}));
      const data = (responseJson && responseJson.success && responseJson.data !== undefined) ? responseJson.data : responseJson;

      if (!res.ok) {
        return { success: false, error: responseJson.messageAr ?? responseJson.message_ar ?? 'فشل إعادة تعيين كلمة المرور' };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'تعذّر الاتصال بالخادم' };
    }
  }, []);

  // ── تسجيل مستخدم جديد ────────────────────────────────────────────────────
  const register = useCallback(async (regData: RegisterData) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
      });
      const responseJson = await res.json().catch(() => ({}));
      const data = (responseJson && responseJson.success && responseJson.data !== undefined) ? responseJson.data : responseJson;

      if (!res.ok) {
        return { success: false, error: responseJson.messageAr ?? responseJson.message_ar ?? 'فشل إنشاء الحساب' };
      }

      await saveSession(data.user, data.access_token ?? data.accessToken, data.refresh_token ?? data.refreshToken);
      return { success: true };
    } catch {
      return { success: false, error: 'تعذّر الاتصال بالخادم' };
    }
  }, [saveSession]);

  // ── تسجيل الخروج ──────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      const refresh = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (user?.id && accessToken) {
        await clearPushTokenOnLogout(user.id, accessToken);
      }
      if (refresh && accessToken) {
        fetch(`${API_BASE}/api/auth/logout`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ refresh_token: refresh, refreshToken: refresh }),
        }).catch(() => {});
      }
    } finally {
      await clearSession();
    }
  }, [accessToken, clearSession, user?.id]);

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      isLoading,
      isAuthenticated: !!user && !!accessToken,
      activeMode,
      switchMode,
      sendOtp,
      verifyOtp,
      signInWithGoogle,
      signInWithPassword,
      resetPassword,
      register,
      signOut,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
