// src/middleware/auth.ts
// FIX: checks token blacklist in session DB (not cache DB), consistent error format
import { NextApiRequest, NextApiResponse } from 'next';
import { verifyAccessToken, JwtPayload } from '@/lib/jwt';
import { sessionGet } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { attachRequestId } from './requestId';
import prisma from '@/lib/prisma';

export interface AuthedRequest extends NextApiRequest {
  user: JwtPayload;
}

export type ApiHandler = (req: AuthedRequest, res: NextApiResponse) => Promise<void> | void;

/** Compare JWT passwordVersion with DB; legacy tokens without the claim are treated as 0. */
export async function isPasswordVersionValid(payload: JwtPayload): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { passwordVersion: true },
  });
  if (!user) return false;
  return (payload.passwordVersion ?? 0) === user.passwordVersion;
}

export async function withAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: ApiHandler,
): Promise<void> {
  // Attach request ID to every authenticated request for log tracing
  const requestId = attachRequestId(req, res);
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'unauthorized', messageAr: 'غير مصرح' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);

    // Check token blacklist (logout / password change)
    const blacklisted = await sessionGet<boolean>(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ success: false, error: 'token_revoked', messageAr: 'انتهت الجلسة' });
    }

    if (!(await isPasswordVersionValid(payload))) {
      return res.status(401).json({ success: false, error: 'token_revoked', messageAr: 'انتهت الجلسة' });
    }

    const user = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: { isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'token_revoked', messageAr: 'انتهت الجلسة' });
    }

    (req as AuthedRequest).user = payload;
    return handler(req as AuthedRequest, res);
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'token_expired', messageAr: 'انتهت صلاحية الجلسة' });
    }
    logger.warn({ err: err.message }, 'Invalid token');
    return res.status(401).json({ success: false, error: 'invalid_token', messageAr: 'رمز غير صالح' });
  }
}

export async function withOptionalAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: (req: NextApiRequest & { user?: JwtPayload }, res: NextApiResponse) => Promise<void>,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token);
      const blacklisted = await sessionGet<boolean>(`blacklist:${token}`);
      if (!blacklisted && (await isPasswordVersionValid(payload))) {
        (req as any).user = payload;
      }
    } catch {
      // Optional — ignore invalid tokens
    }
  }
  return handler(req as any, res);
}

export async function withAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: ApiHandler,
): Promise<void> {
  return withAuth(req, res, async (authedReq, authedRes) => {
    if (authedReq.user.role !== 'ADMIN') {
      return authedRes.status(403).json({ success: false, error: 'forbidden', messageAr: 'غير مسموح' });
    }
    return handler(authedReq, authedRes);
  });
}

export function apiResponse<T>(res: NextApiResponse, data: T, status = 200) {
  return res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}

export function apiError(
  res: NextApiResponse,
  status: number,
  error: string,
  messageAr: string,
  details?: unknown,
) {
  return res.status(status).json({
    success: false, error, messageAr,
    ...(details !== undefined && { details }),
    timestamp: new Date().toISOString(),
  });
}
