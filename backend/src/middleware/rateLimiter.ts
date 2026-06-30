// src/middleware/rateLimiter.ts
// منع IP spoofing + الانتقال التلقائي للذاكرة المؤقتة (Memory Fallback) في حال توقف Redis

import { NextApiRequest, NextApiResponse } from 'next';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { getRedis, isRedisEnabled } from '@/lib/redis';
import { logger } from '@/lib/logger';

const TRUSTED_PROXIES = new Set(
  (process.env.TRUSTED_PROXIES || '127.0.0.1,::1,172.0.0.0/8,10.0.0.0/8').split(',').map(s => s.trim())
);

let limiterInstance:     RateLimiterRedis | RateLimiterMemory | null = null;
let authLimiterInstance: RateLimiterRedis | RateLimiterMemory | null = null;
let paymentLimiterInstance: RateLimiterRedis | RateLimiterMemory | null = null;

let memoryLimiters: Record<string, RateLimiterMemory> = {};

function getMemoryLimiter(points: number, duration: number, keyPrefix: string) {
  const key = `${keyPrefix}:${points}:${duration}`;
  if (!memoryLimiters[key]) {
    memoryLimiters[key] = new RateLimiterMemory({ keyPrefix, points, duration });
  }
  return memoryLimiters[key];
}

function getLimiter(points: number, duration: number, keyPrefix: string, blockDuration = 60) {
  if (!isRedisEnabled()) {
    return new RateLimiterMemory({ keyPrefix, points, duration });
  }
  try {
    return new RateLimiterRedis({
      storeClient: getRedis(),
      keyPrefix,
      points,
      duration,
      blockDuration,
    });
  } catch {
    logger.warn({ keyPrefix }, 'Redis unavailable at setup, falling back to memory rate limiter');
    return new RateLimiterMemory({ keyPrefix, points, duration });
  }
}

function getApiLimiter() {
  if (!limiterInstance) {
    limiterInstance = getLimiter(
      parseInt(process.env.RATE_LIMIT_MAX || '100'),
      parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000,
      'rl:api'
    );
  }
  return limiterInstance;
}

function getAuthLimiter() {
  if (!authLimiterInstance) {
    authLimiterInstance = getLimiter(5, 900, 'rl:auth', 900);
  }
  return authLimiterInstance;
}

function getPaymentLimiter() {
  if (!paymentLimiterInstance) {
    paymentLimiterInstance = getLimiter(10, 3600, 'rl:payment', 3600);
  }
  return paymentLimiterInstance;
}

export function getClientIp(req: NextApiRequest): string {
  const directIp = req.socket.remoteAddress || 'unknown';

  const isTrustedProxy = TRUSTED_PROXIES.has(directIp) ||
    directIp.startsWith('172.') ||
    directIp.startsWith('10.');

  if (isTrustedProxy) {
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      const ips = forwarded.split(',').map(s => s.trim());
      return ips[ips.length - 1] || directIp;
    }
    const realIp = req.headers['x-real-ip'] as string;
    if (realIp) return realIp;
  }

  return directIp;
}

export async function apiRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  type: 'api' | 'auth' | 'payment' = 'api'
): Promise<boolean> {
  // Bypass rate limiting in development mode
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const ip = getClientIp(req);
  const limits = { api: 100, auth: 5, payment: 10 };
  const windows = { api: 900, auth: 900, payment: 3600 };

  const redisClient = getRedis();
  const isRedisReady = redisClient.status === 'ready';

  let result;
  try {
    if (isRedisReady) {
      const limiterMap = { api: getApiLimiter, auth: getAuthLimiter, payment: getPaymentLimiter };
      const limiter = limiterMap[type]();
      result = await limiter.consume(ip);
    } else {
      // إذا كان Redis متوقفاً، استخدم محدد الذاكرة المؤقتة (Memory fallback)
      const memoryLimiter = getMemoryLimiter(limits[type], windows[type], `rl:mem:${type}`);
      result = await memoryLimiter.consume(ip);
    }

    res.setHeader('X-RateLimit-Limit',     limits[type]);
    res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
    res.setHeader('X-RateLimit-Reset',     new Date(Date.now() + result.msBeforeNext).toISOString());
    return true;
  } catch (rejRes: any) {
    // في حال حدوث خطأ برمجي أو انقطاع من جانب اتصال Redis (Fail-open)
    if (rejRes instanceof Error) {
      logger.error({ err: rejRes.message, ip, type }, 'Rate limiter Redis error, failing open');
      return true;
    }

    // تجاوز حد الطلبات الفعلي (Rate Limit Exceeded)
    logger.warn({ ip, type }, 'Rate limit exceeded');
    res.setHeader('Retry-After', Math.round(rejRes.msBeforeNext / 1000));
    res.status(429).json({
      error:      'too_many_requests',
      messageAr:  'طلبات كثيرة جداً، حاول لاحقاً',
      message:    'Too many requests, please try again later',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000),
    });
    return false;
  }
}
