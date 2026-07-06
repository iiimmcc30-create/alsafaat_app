'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin, persistSession } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import {
  BRAND_ADMIN_SUBTITLE_AR,
  BRAND_NAME_AR,
  BRAND_NAME_EN,
  BRAND_TAGLINE_AR,
} from '@/constants/brandCopy';

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await adminLogin(login, password);
      persistSession(session);
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/90 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-emerald-400">{BRAND_NAME_AR}</h1>
          <p className="mt-1 text-sm font-medium tracking-wide text-emerald-300/80">{BRAND_NAME_EN}</p>
          <p className="mt-3 text-sm text-slate-300">{BRAND_TAGLINE_AR}</p>
          <p className="mt-2 text-xs text-slate-500">{BRAND_ADMIN_SUBTITLE_AR}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">البريد / اسم المستخدم</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-600">Admin / Moderator فقط</p>
      </div>
    </div>
  );
}
