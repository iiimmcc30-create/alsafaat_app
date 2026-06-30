// pages/api/health.ts — enhanced: checks DB, Redis cache, Redis sessions, queue
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getRedis, getSessionRedis, isRedisEnabled } from '@/lib/redis';
import { getNotificationQueueForHealth } from '@/lib/queue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const start = Date.now();
  const checks = {
    db:          false,
    redis_cache: false,
    redis_session: false,
    queue:       false,
  };

  await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`.then(() => { checks.db = true; }),
    isRedisEnabled()
      ? getRedis().ping().then(() => { checks.redis_cache = true; })
      : Promise.resolve(),
    isRedisEnabled()
      ? getSessionRedis().ping().then(() => { checks.redis_session = true; })
      : Promise.resolve(),
    (() => {
      const q = getNotificationQueueForHealth();
      return q ? q.getJobCounts().then(() => { checks.queue = true; }) : Promise.resolve();
    })(),
  ]);

  const healthy = checks.db && (!isRedisEnabled() || (checks.redis_cache && checks.redis_session));
  const duration = Date.now() - start;

  return res.status(healthy ? 200 : 503).json({
    status:    healthy ? 'ok' : 'degraded',
    checks,
    duration:  `${duration}ms`,
    uptime:    Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || '1.0.0',
  });
}
