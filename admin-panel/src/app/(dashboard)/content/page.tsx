'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { fetchSections, createSection, deleteSection } from '@/services/admin.service';
import { getApiErrorMessage } from '@/services/api.client';

export default function ContentPage() {
  const [sections, setSections] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ slug: '', titleAr: '', bodyAr: '' });

  const load = () => fetchSections().then((r) => setSections(r.sections));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="إدارة المحتوى" description="أقسام المحتوى العام في التطبيق" />
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h3 className="mb-3 font-semibold text-white">قسم جديد</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <input placeholder="العنوان" value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <input placeholder="المحتوى" value={form.bodyAr} onChange={(e) => setForm({ ...form, bodyAr: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </div>
        <Button className="mt-3" onClick={async () => {
          await createSection(form);
          setForm({ slug: '', titleAr: '', bodyAr: '' });
          load();
        }}>إضافة</Button>
      </div>
      <div className="space-y-3">
        {sections.map((s) => (
          <div key={String(s.id)} className="flex items-center justify-between rounded-xl border border-slate-800 p-4">
            <div>
              <p className="font-medium text-white">{String(s.titleAr)}</p>
              <p className="text-xs text-slate-500">{String(s.slug)}</p>
            </div>
            <Button variant="danger" size="sm" onClick={async () => {
              if (!confirm('أرشفة القسم؟')) return;
              try {
                await deleteSection(String(s.id));
                load();
              } catch (err) {
                alert(getApiErrorMessage(err, 'فشل أرشفة القسم'));
              }
            }}>أرشفة</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
