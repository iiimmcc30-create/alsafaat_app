// src/middleware/requestId.ts
// Adds X-Request-ID to every request and response.
// Every logger call should include { requestId } so a full request trace
// can be reconstructed from logs even across async operations.
import { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';

export function getRequestId(req: NextApiRequest): string {
  // Honour forwarded request ID from client (useful for mobile retry correlation)
  // Validate it — don't trust arbitrary header values
  const forwarded = req.headers['x-request-id'] as string;
  if (forwarded && /^[a-zA-Z0-9_\-]{8,64}$/.test(forwarded)) {
    return forwarded;
  }
  return randomUUID();
}

export function attachRequestId(
  req: NextApiRequest,
  res: NextApiResponse,
): string {
  const id = getRequestId(req);
  (req as any).requestId = id;
  res.setHeader('X-Request-ID', id);
  return id;
}

// Higher-order wrapper: adds requestId to all subsequent logger calls
export function withRequestId<T extends (req: NextApiRequest, res: NextApiResponse) => any>(
  handler: T,
): T {
  return (async (req: NextApiRequest, res: NextApiResponse) => {
    const requestId = attachRequestId(req, res);
    (req as any).requestId = requestId;
    return handler(req, res);
  }) as T;
}
