// Butcher Application API — user endpoints (authFetch only).

import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';
import type {
  ApplicationDetail,
  ApplicationDocument,
  ApplicationListQuery,
  ApplicationListResult,
  ApplicationSnapshotInput,
  DocumentReplaceInput,
  DocumentUploadInput,
  SubmitInput,
  WithdrawInput,
} from '@/services/butcherApplicationTypes';
import { ButcherApplicationApiError } from '@/services/butcherApplicationTypes';

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  messageAr?: string;
  message_ar?: string;
  message?: string;
  details?: unknown;
};

async function parseEnvelope<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!res.ok || json.success === false) {
    throw new ButcherApplicationApiError(
      res.status,
      json.error ?? (res.status === 401 ? 'unauthorized' : 'server_error'),
      json.messageAr ?? json.message_ar ?? json.message ?? 'خطأ في الخادم',
      json.details,
    );
  }

  if (json.success === true && json.data !== undefined) {
    return json.data;
  }

  return json as unknown as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

const BASE = `${API_BASE}/api/butcher-applications`;

export async function createApplicationDraft(
  snapshot: ApplicationSnapshotInput = {},
): Promise<ApplicationDetail> {
  const res = await authFetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  return parseEnvelope<ApplicationDetail>(res);
}

export async function listApplications(
  query: ApplicationListQuery = {},
): Promise<ApplicationListResult> {
  const res = await authFetch(
    `${BASE}${buildQuery({
      cursor: query.cursor,
      status: query.status,
      limit: query.limit,
    })}`,
  );
  return parseEnvelope<ApplicationListResult>(res);
}

export async function getApplication(applicationId: string): Promise<ApplicationDetail> {
  const res = await authFetch(`${BASE}/${applicationId}`);
  return parseEnvelope<ApplicationDetail>(res);
}

export async function updateApplicationDraft(
  applicationId: string,
  snapshot: ApplicationSnapshotInput,
  expectedUpdatedAt?: string | Date,
): Promise<ApplicationDetail> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (expectedUpdatedAt !== undefined) {
    const value =
      expectedUpdatedAt instanceof Date
        ? expectedUpdatedAt.toISOString()
        : expectedUpdatedAt;
    headers['If-Unmodified-Since'] = value;
  }

  const res = await authFetch(`${BASE}/${applicationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(snapshot),
  });
  return parseEnvelope<ApplicationDetail>(res);
}

export async function submitApplication(
  applicationId: string,
  input: SubmitInput,
): Promise<ApplicationDetail> {
  const res = await authFetch(`${BASE}/${applicationId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseEnvelope<ApplicationDetail>(res);
}

export async function withdrawApplication(
  applicationId: string,
  input: WithdrawInput = {},
): Promise<ApplicationDetail> {
  const res = await authFetch(`${BASE}/${applicationId}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseEnvelope<ApplicationDetail>(res);
}

export async function registerApplicationDocument(
  applicationId: string,
  input: DocumentUploadInput,
): Promise<ApplicationDocument> {
  const res = await authFetch(`${BASE}/${applicationId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseEnvelope<ApplicationDocument>(res);
}

export async function replaceApplicationDocument(
  applicationId: string,
  documentId: string,
  input: DocumentReplaceInput,
): Promise<ApplicationDocument> {
  const res = await authFetch(`${BASE}/${applicationId}/documents/${documentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseEnvelope<ApplicationDocument>(res);
}

export async function deleteApplicationDocument(
  applicationId: string,
  documentId: string,
): Promise<void> {
  const res = await authFetch(`${BASE}/${applicationId}/documents/${documentId}`, {
    method: 'DELETE',
  });

  if (res.status === 204) return;

  await parseEnvelope<unknown>(res);
}

export function toApiError(err: unknown): ButcherApplicationApiError | null {
  return err instanceof ButcherApplicationApiError ? err : null;
}
