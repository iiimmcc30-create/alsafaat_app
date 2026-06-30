// pages/api/users/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { apiResponse } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await apiRateLimit(req, res))) return;
  if (req.method !== 'GET') return res.status(405).end();

  const search = req.query.search as string | undefined;

  const where: any = { isActive: true };
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
      { arabicName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    take: 20,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      arabicName: true,
      avatar: true,
      verified: true,
      bio: true,
      country: true,
      _count: {
        select: { followers: true },
      },
    },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    arabicName: u.arabicName,
    avatar: u.avatar,
    verified: u.verified,
    bio: u.bio,
    country: u.country,
    followers: u._count.followers,
  }));

  return apiResponse(res, formattedUsers);
}
