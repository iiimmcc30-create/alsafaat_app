// src/lib/redis.ts
// FIX: connection pool separation (cache vs queues vs sessions on different DBs),
//      proper error handling, memory limits, dev fallback when Redis is offline
import IORedis from 'ioredis';
import { logger } from './logger';

// DB 0 = application cache | DB 1 = BullMQ | DB 2 = sessions + rate limiting | DB 3 = Socket.IO

const IS_DEV = process.env.NODE_ENV !== 'production';

let redisMarkedUnavailable = false;
let unavailableLogged = false;

/** True when Redis should be used. Set REDIS_ENABLED=false in .env for local dev without Docker. */
export function isRedisEnabled(): boolean {
  if (process.env.REDIS_ENABLED === 'false') return false;
  if (redisMarkedUnavailable && IS_DEV) return false;
  return true;
}

function markRedisUnavailable(err?: unknown): void {
  if (!IS_DEV || process.env.REDIS_ENABLED === 'false') return;
  redisMarkedUnavailable = true;
  if (!unavailableLogged) {
    unavailableLogged = true;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Redis unavailable — cache/session skipped (dev). Set REDIS_ENABLED=false in .env or run `npm run db:up`'
    );
  }
}

const baseOpts = {
  host:                 process.env.REDIS_HOST || 'localhost',
  port:                 parseInt(process.env.REDIS_PORT || '6379'),
  password:             process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 1,
  enableReadyCheck:     false,
  connectTimeout:       3000,
  commandTimeout:       3000,
  lazyConnect:          true,
  retryStrategy(times: number) {
    if (times > 2) return null;
    return Math.min(times * 200, 1000);
  },
};

let cacheClient: IORedis | null = null;
let sessionClient: IORedis | null = null;
let cacheErrorLogged = false;
let sessionErrorLogged = false;

function attachCacheErrorHandler(client: IORedis) {
  client.on('error', (err) => {
    if (!cacheErrorLogged) {
      cacheErrorLogged = true;
      logger.error({ err: err.message }, 'Redis cache error');
    }
    markRedisUnavailable(err);
  });
}

function attachSessionErrorHandler(client: IORedis) {
  client.on('error', (err) => {
    if (!sessionErrorLogged) {
      sessionErrorLogged = true;
      logger.error({ err: err.message }, 'Redis session error');
    }
    markRedisUnavailable(err);
  });
}

export function getRedis(): IORedis {
  if (!isRedisEnabled()) {
    throw new Error('Redis disabled');
  }
  if (!cacheClient) {
    cacheClient = new IORedis({ ...baseOpts, db: 0 });
    attachCacheErrorHandler(cacheClient);
    cacheClient.on('connect', () => logger.info('Redis cache connected'));
  }
  return cacheClient;
}

export function getSessionRedis(): IORedis {
  if (!isRedisEnabled()) {
    throw new Error('Redis disabled');
  }
  if (!sessionClient) {
    sessionClient = new IORedis({ ...baseOpts, db: 2 });
    attachSessionErrorHandler(sessionClient);
  }
  return sessionClient;
}

// ─── Cache helpers (DB 0) ─────────────────────────────────────────────────────

const DEFAULT_TTL = 300;

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisEnabled()) return null;
  try {
    const val = await getRedis().get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch (err) {
    markRedisUnavailable(err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    markRedisUnavailable(err);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!keys.length || !isRedisEnabled()) return;
  try {
    await getRedis().del(...keys);
  } catch (err) {
    markRedisUnavailable(err);
  }
}

export async function cacheGetOrSet<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await fn();
  await cacheSet(key, value, ttl);
  return value;
}

export async function cacheDelPattern(pattern: string): Promise<number> {
  if (!isRedisEnabled()) return 0;
  try {
    const redis = getRedis();
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    return deleted;
  } catch (err) {
    markRedisUnavailable(err);
    return 0;
  }
}

// ─── Session helpers (DB 2) ───────────────────────────────────────────────────

export async function sessionSet(key: string, value: unknown, ttl: number): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    await getSessionRedis().set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    markRedisUnavailable(err);
    if (!IS_DEV) throw err;
  }
}

export async function sessionGet<T>(key: string): Promise<T | null> {
  if (!isRedisEnabled()) return null;
  try {
    const val = await getSessionRedis().get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch (err) {
    markRedisUnavailable(err);
    return null;
  }
}

export async function sessionDel(...keys: string[]): Promise<void> {
  if (!keys.length || !isRedisEnabled()) return;
  try {
    await getSessionRedis().del(...keys);
  } catch (err) {
    markRedisUnavailable(err);
  }
}

// ─── Canonical cache keys ─────────────────────────────────────────────────────
export const CacheKeys = {
  user:      (id: string)                      => `user:${id}`,
  listing:   (id: string)                      => `listing:${id}`,
  listings:  (page: number, filters: string)   => `listings:${page}:${filters}`,
  post:      (id: string)                      => `post:${id}`,
  posts:     (page: number)                    => `posts:${page}`,
  butcher:   (id: string)                      => `butcher:${id}`,
  butchers:  (country: string, page: number)   => `butchers:${country}:${page}`,
  userFeed:  (userId: string, page: number)    => `feed:${userId}:${page}`,
  liveStreams: ()                              => 'streams:live',
};
