'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Users,
  FileText,
  Tag,
  Flag,
  Radio,
  Store,
  ClipboardList,
  Settings,
  Layers,
  LogOut,
} from 'lucide-react';
import { clearSession, getStoredUser } from '@/services/auth.service';
import { BRAND_ADMIN_SUBTITLE_AR, BRAND_NAME_AR, BRAND_NAME_EN } from '@/constants/brandCopy';

const nav = [
  { href: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/users', label: 'المستخدمون', icon: Users },
  { href: '/posts', label: 'المنشورات', icon: FileText },
  { href: '/listings', label: 'الإعلانات', icon: Tag },
  { href: '/reports', label: 'البلاغات', icon: Flag },
  { href: '/live', label: 'البث المباشر', icon: Radio },
  { href: '/butchers', label: 'الملاحم', icon: Store },
  { href: '/applications', label: 'طلبات الملاحم', icon: ClipboardList },
  { href: '/content', label: 'المحتوى', icon: Layers },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = getStoredUser();

  return (
    <aside className="flex h-screen w-64 flex-col border-l border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 p-5">
        <p className="text-lg font-bold text-emerald-400">{BRAND_NAME_AR}</p>
        <p className="text-xs font-medium text-emerald-300/70">{BRAND_NAME_EN}</p>
        <p className="mt-1 text-xs text-slate-500">{BRAND_ADMIN_SUBTITLE_AR}</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                active
                  ? 'bg-emerald-600/15 text-emerald-300'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <p className="truncate text-sm font-medium text-slate-200">{user?.arabicName ?? '—'}</p>
        <p className="text-xs text-slate-500">{user?.role === 'ADMIN' ? 'مسؤول' : 'مشرف'}</p>
        <button
          type="button"
          onClick={() => {
            clearSession();
            window.location.href = '/login';
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-rose-400 hover:bg-slate-900"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
