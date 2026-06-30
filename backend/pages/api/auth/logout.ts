// pages/api/auth/logout.ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, AuthedRequest } from '@/middleware/auth';
import { sessionSet } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { disconnectUserSockets } from '@/socket-server';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  return withAuth(req, res, logout);
}

async function logout(req: AuthedRequest, res: NextApiResponse) {
  const accessToken = req.headers.authorization!.slice(7);
  const { refreshToken, allDevices } = req.body;

  // Blacklist current access token until natural expiry (15m)
  await sessionSet(`blacklist:${accessToken}`, true, 15 * 60);

  if (allDevices) {
    await prisma.userSession.deleteMany({ where: { userId: req.user.userId } });
    logger.info({ userId: req.user.userId }, 'Logged out from all devices');
  } else {
    if (refreshToken && typeof refreshToken === 'string') {
      await prisma.userSession.deleteMany({
        where: { userId: req.user.userId, refreshToken },
      });
    }
    logger.info({ userId: req.user.userId }, 'Logged out from current device');
  }

  await disconnectUserSockets(req.user.userId);

  return apiResponse(res, { loggedOut: true });
}
