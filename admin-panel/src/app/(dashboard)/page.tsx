'use client';

import { useEffect, useState } from 'react';
import { Users, FileText, Tag, Flag, Radio } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { fetchDashboardStats, type DashboardStats } from '@/services/dashboard.service';
import { BRAND_TAGLINE_AR } from '@/constants/brandCopy';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <p className="text-rose-400">{error}</p>;
  }

  if (!stats) {
    return <p className="text-slate-400">جارٍ تحميل الإحصائيات...</p>;
  }

  return (
    <div>
      <PageHeader title="لوحة التحكم" description={BRAND_TAGLINE_AR} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="المستخدمون" value={stats.users.total} subtitle={`+${stats.users.newToday} اليوم`} icon={Users} />
        <StatCard title="المنشورات" value={stats.posts.total} subtitle={`${stats.posts.hidden} مخفي`} icon={FileText} accent="blue" />
        <StatCard title="الإعلانات" value={stats.listings.total} subtitle={`${stats.listings.active} نشط`} icon={Tag} accent="amber" />
        <StatCard title="البلاغات" value={stats.tickets.open} subtitle={`${stats.tickets.urgent} عاجل`} icon={Flag} accent="rose" />
        <StatCard title="بث مباشر" value={stats.liveStreams.liveNow} subtitle={`من ${stats.liveStreams.total}`} icon={Radio} accent="violet" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">مستخدمون جدد (7 أيام)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.charts.usersByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">البلاغات حسب التصنيف</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.charts.ticketsByCategory}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(props) => {
                    const entry = props as { category?: string; count?: number };
                    return `${entry.category ?? ''}: ${entry.count ?? 0}`;
                  }}
                >
                  {stats.charts.ticketsByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
