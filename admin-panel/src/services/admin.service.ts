import { apiClient, unwrap } from './api.client';

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
};

export async function fetchUsers(params: ListParams = {}) {
  const res = await apiClient.get('/admin/users', { params });
  return unwrap<Paginated<Record<string, unknown>>>(res);
}

export async function fetchUser(id: string) {
  const res = await apiClient.get(`/admin/users/${id}`);
  return unwrap<{ user: Record<string, unknown> }>(res);
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const res = await apiClient.patch(`/admin/users/${id}`, data);
  return unwrap(res);
}

export async function deleteUser(id: string) {
  const res = await apiClient.delete(`/admin/users/${id}`);
  return unwrap(res);
}

export async function fetchPosts(params: ListParams & { hidden?: string } = {}) {
  const res = await apiClient.get('/admin/posts', { params });
  return unwrap<Paginated<Record<string, unknown>>>(res);
}

export async function setPostHidden(id: string, isHidden: boolean) {
  const res = await apiClient.patch(`/admin/posts/${id}`, { isHidden });
  return unwrap(res);
}

export async function deletePost(id: string) {
  const res = await apiClient.delete(`/admin/posts/${id}`);
  return unwrap(res);
}

export async function fetchListings(params: ListParams & { status?: string } = {}) {
  const res = await apiClient.get('/admin/listings', { params });
  return unwrap<Paginated<Record<string, unknown>>>(res);
}

export async function updateListing(id: string, data: Record<string, unknown>) {
  const res = await apiClient.patch(`/admin/listings/${id}`, data);
  return unwrap(res);
}

export async function deleteListing(id: string) {
  const res = await apiClient.delete(`/admin/listings/${id}`);
  return unwrap(res);
}

export async function fetchReports(params: ListParams & { status?: string; category?: string } = {}) {
  const res = await apiClient.get('/admin/reports', { params });
  return unwrap<Paginated<Record<string, unknown>>>(res);
}

export async function fetchReport(id: string) {
  const res = await apiClient.get(`/admin/reports/${id}`);
  return unwrap<{ ticket: Record<string, unknown> }>(res);
}

export async function updateReport(id: string, data: Record<string, unknown>) {
  const res = await apiClient.patch(`/admin/reports/${id}`, data);
  return unwrap(res);
}

export async function deleteReport(id: string) {
  const res = await apiClient.delete(`/admin/reports/${id}`);
  return unwrap(res);
}

export async function fetchLiveStreams(params: ListParams & { live?: string } = {}) {
  const res = await apiClient.get('/admin/livestreams', { params });
  return unwrap<Paginated<Record<string, unknown>>>(res);
}

export async function stopLiveStream(id: string) {
  const res = await apiClient.post(`/admin/livestreams/${id}`);
  return unwrap(res);
}

export async function deleteLiveStream(id: string) {
  const res = await apiClient.delete(`/admin/livestreams/${id}`);
  return unwrap(res);
}

export async function fetchButchers(params: ListParams = {}) {
  const res = await apiClient.get('/admin/butchers', { params });
  return unwrap<Paginated<Record<string, unknown>>>(res);
}

export async function fetchButcher(id: string) {
  const res = await apiClient.get(`/admin/butchers/${id}`);
  return unwrap<{ butcher: Record<string, unknown>; user: Record<string, unknown> }>(res);
}

export async function updateButcher(id: string, data: Record<string, unknown>) {
  const res = await apiClient.patch(`/admin/butchers/${id}`, data);
  return unwrap(res);
}

export async function fetchOrders(
  params: ListParams & {
    status?: string;
    butcherId?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    orderNumber?: string;
  } = {},
) {
  const res = await apiClient.get('/admin/orders', { params });
  return unwrap<Paginated<Record<string, unknown>>>(res);
}

export async function fetchOrder(id: string) {
  const res = await apiClient.get(`/admin/orders/${id}`);
  return unwrap<{ order: Record<string, unknown> }>(res);
}

export async function fetchApplications(params: Record<string, string> = {}) {
  const res = await apiClient.get('/admin/butcher-applications', { params });
  return unwrap(res);
}

export async function fetchApplication(id: string) {
  const res = await apiClient.get(`/admin/butcher-applications/${id}`);
  return unwrap<Record<string, unknown>>(res);
}

export async function approveApplication(id: string, comment?: string) {
  const res = await apiClient.post(`/admin/butcher-applications/${id}/approve`, {
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  });
  return unwrap(res);
}

export async function rejectApplication(id: string, rejectionReason: string, comment?: string) {
  const res = await apiClient.post(`/admin/butcher-applications/${id}/reject`, {
    rejectionReason: rejectionReason.trim(),
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  });
  return unwrap(res);
}

export async function fetchSettings() {
  const res = await apiClient.get('/admin/settings');
  return unwrap<{ settings: Record<string, unknown>[] }>(res);
}

export async function updateSetting(data: { key: string; value: unknown; labelAr?: string; category?: string }) {
  const res = await apiClient.put('/admin/settings', data);
  return unwrap(res);
}

export async function fetchSections() {
  const res = await apiClient.get('/admin/sections');
  return unwrap<{ sections: Record<string, unknown>[] }>(res);
}

export async function createSection(data: Record<string, unknown>) {
  const res = await apiClient.post('/admin/sections', data);
  return unwrap(res);
}

export async function updateSection(id: string, data: Record<string, unknown>) {
  const res = await apiClient.patch(`/admin/sections/${id}`, data);
  return unwrap(res);
}

export async function deleteSection(id: string) {
  const res = await apiClient.delete(`/admin/sections/${id}`);
  return unwrap(res);
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export type AdminPlan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  audience: 'USER' | 'BUTCHER';
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  yearlyDiscount: number;
  isActive: boolean;
  sortOrder: number;
  features: Array<{
    id?: string;
    key: string;
    value: string;
    valueType: 'BOOLEAN' | 'NUMBER' | 'STRING' | 'JSON';
  }>;
};

export type PlanFeatureCatalogItem = {
  key: string;
  labelAr: string;
  descriptionAr: string;
  valueType: 'BOOLEAN' | 'NUMBER' | 'STRING' | 'JSON';
  audiences: Array<'USER' | 'BUTCHER'>;
  suggestedValue?: string;
};

export async function fetchPlans(audience?: 'USER' | 'BUTCHER') {
  const res = await apiClient.get('/admin/plans', {
    params: audience ? { audience } : undefined,
  });
  return unwrap<{ plans: AdminPlan[] }>(res);
}

export async function fetchPlan(id: string) {
  const res = await apiClient.get(`/admin/plans/${id}`);
  return unwrap<{ plan: AdminPlan }>(res);
}

export async function fetchPlanFeatureCatalog(audience?: 'USER' | 'BUTCHER') {
  const res = await apiClient.get('/admin/plans/feature-catalog/list', {
    params: audience ? { audience } : undefined,
  });
  return unwrap<{ features: PlanFeatureCatalogItem[] }>(res);
}

export async function createPlan(data: Record<string, unknown>) {
  const res = await apiClient.post('/admin/plans', data);
  return unwrap(res);
}

export async function updatePlan(id: string, data: Record<string, unknown>) {
  const res = await apiClient.patch(`/admin/plans/${id}`, data);
  return unwrap(res);
}

export async function deactivatePlan(id: string) {
  const res = await apiClient.post(`/admin/plans/${id}/deactivate`);
  return unwrap(res);
}

export async function duplicatePlan(id: string) {
  const res = await apiClient.post(`/admin/plans/${id}/duplicate`);
  return unwrap(res);
}

export async function deletePlan(id: string) {
  const res = await apiClient.delete(`/admin/plans/${id}`);
  return unwrap(res);
}
