'use client';

import { ResourcePage, Badge } from '@/components/ui/ResourcePage';
import { Button } from '@/components/ui/Button';
import { fetchListings, updateListing, deleteListing } from '@/services/admin.service';
import { getApiErrorMessage } from '@/services/api.client';

type ListingRow = {
  id: string;
  arabicTitle: string;
  price: number;
  status: string;
  seller?: { arabicName?: string };
};

export default function ListingsPage() {
  return (
    <ResourcePage<ListingRow>
      title="إدارة الإعلانات"
      description="عرض وتعديل وإخفاء الإعلانات"
      fetchPage={({ page, search }) => fetchListings({ page, search })}
      columns={[
        { key: 'arabicTitle', label: 'العنوان' },
        {
          key: 'price',
          label: 'السعر',
          render: (r) => `${r.price} ر.س`,
        },
        {
          key: 'status',
          label: 'الحالة',
          render: (r) => (
            <Badge tone={r.status === 'active' ? 'success' : r.status === 'suspended' ? 'danger' : 'default'}>
              {r.status}
            </Badge>
          ),
        },
        {
          key: 'seller',
          label: 'البائع',
          render: (r) => r.seller?.arabicName ?? '—',
        },
      ]}
      actions={(row, reload) => (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const next = row.status === 'active' ? 'suspended' : 'active';
              await updateListing(row.id, { status: next });
              reload();
            }}
          >
            {row.status === 'active' ? 'إخفاء' : 'تفعيل'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!confirm('أرشفة الإعلان؟ سيختفي من التطبيق ويمكن استرجاعه خلال 90 يوماً.')) return;
              try {
                await deleteListing(row.id);
                reload();
              } catch (err) {
                alert(getApiErrorMessage(err, 'فشل أرشفة الإعلان'));
              }
            }}
          >
            أرشفة
          </Button>
        </div>
      )}
    />
  );
}
