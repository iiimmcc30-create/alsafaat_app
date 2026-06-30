// pages/api/stories/[id].ts — حذف قصة المستخدم

import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { withAuth, apiResponse, apiError, AuthedRequest } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';
import { cacheDel } from '@/lib/redis';
import { logger } from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method === 'DELETE') return withAuth(req, res, deleteStory);
  return res.status(405).end();
}

async function deleteStory(req: AuthedRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return apiError(res, 400, 'invalid_id', 'معرّف غير صالح');

  const story = await prisma.story.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!story) return apiError(res, 404, 'not_found', 'القصة غير موجودة');
  if (story.userId !== req.user.userId && req.user.role !== 'ADMIN') {
    return apiError(res, 403, 'forbidden', 'غير مسموح');
  }

  await prisma.story.delete({ where: { id } });
  await cacheDel('stories:active');

  logger.info({ storyId: id, userId: req.user.userId }, 'User story deleted');
  return apiResponse(res, { deleted: true });
}
