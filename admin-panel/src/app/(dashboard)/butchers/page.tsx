'use client';

import { useState } from 'react';
import { ResourcePage, Badge } from '@/components/ui/ResourcePage';
import { Button } from '@/components/ui/Button';
import { ButcherDetailModal } from '@/components/butchers/ButcherDetailModal';
import { fetchButchers, updateButcher } from '@/services/admin.service';

type ButcherRow = {
  id: string;
  nameAr: string;
  cityAr: string;
  type: string;
  isOpen: boolean;
  user?: { id?: string; arabicName?: string; username?: string };
};

export default function ButchersPage() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [verifiedJustNow, setVerifiedJustNow] = useState(false);

  const openDetails = (id: string, justVerified = false) => {
    setVerifiedJustNow(justVerified);
    setDetailId(id);
  };

  const closeDetails = () => {
    setDetailId(null);
    setVerifiedJustNow(false);
  };

  return (
    <>
      <ResourcePage<ButcherRow>
        title="إدارة الملاحم"
        description="الملاحم المسجّلة في المنصة"
        fetchPage={async ({ page, search }) => {
          const res = await fetchButchers({ page, search });
          return {
            ...res,
            items: res.items as ButcherRow[],
          };
        }}
        columns={[
          { key: 'nameAr', label: 'الاسم' },
          { key: 'cityAr', label: 'المدينة' },
          {
            key: 'type',
            label: 'النوع',
            render: (r) => (
              <Badge tone={r.type === 'verified' ? 'success' : 'default'}>{r.type}</Badge>
            ),
          },
          {
            key: 'isOpen',
            label: 'مفتوح',
            render: (r) => (r.isOpen ? 'نعم' : 'لا'),
          },
          {
            key: 'user',
            label: 'المالك',
            render: (r) => r.user?.arabicName ?? r.user?.username ?? '—',
          },
        ]}
        actions={(row, reload) => (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => openDetails(row.id)}>
              تفاصيل
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const willVerify = row.type !== 'verified';
                await updateButcher(row.id, {
                  type: willVerify ? 'verified' : 'regular',
                });
                reload();
                openDetails(row.id, willVerify);
              }}
            >
              {row.type === 'verified' ? 'إلغاء التوثيق' : 'توثيق'}
            </Button>
          </div>
        )}
      />

      <ButcherDetailModal
        butcherId={detailId}
        open={detailId !== null}
        onClose={closeDetails}
        verifiedJustNow={verifiedJustNow}
      />
    </>
  );
}
