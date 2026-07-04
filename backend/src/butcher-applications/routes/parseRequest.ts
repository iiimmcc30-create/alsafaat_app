import type { NextApiRequest } from 'next';
import { uuidSchema } from './schemas';

export function parseApplicationId(query: NextApiRequest['query']): string | null {
  const raw = query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') return null;

  const parsed = uuidSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export function parseDocumentId(query: NextApiRequest['query']): string | null {
  const raw = query.documentId;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') return null;

  const parsed = uuidSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

/**
 * Phase C: optional If-Unmodified-Since carrying the last known updatedAt (ISO-8601).
 * Returns undefined when absent; null when present but invalid.
 */
export function parseIfUnmodifiedSince(
  req: NextApiRequest,
): Date | undefined | null {
  const raw = req.headers['if-unmodified-since'];
  if (!raw) return undefined;

  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}
