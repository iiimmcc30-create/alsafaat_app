// pages/api/search/trending.ts
// GET /api/search/trending — hashtags from recent posts (real DB aggregation)
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { apiResponse } from '@/middleware/auth';
import { apiRateLimit } from '@/middleware/rateLimiter';

const HASHTAG_RE = /#[\u0600-\u06FF\w_]+/g;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!(await apiRateLimit(req, res))) return;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const posts = await prisma.post.findMany({
    where: { createdAt: { gte: since } },
    select: { content: true, arabicContent: true },
    take: 500,
    orderBy: { createdAt: 'desc' },
  });

  const counts = new Map<string, number>();
  for (const post of posts) {
    const text = `${post.content} ${post.arabicContent}`;
    const matches = text.match(HASHTAG_RE) ?? [];
    for (const tag of matches) {
      const normalized = tag.toLowerCase();
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  const trending = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return apiResponse(res, { trending });
}
