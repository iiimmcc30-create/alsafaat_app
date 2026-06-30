// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma =
  global.__prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;

  (prisma as any).$on('query', (e: any) => {
    if (process.env.LOG_QUERIES === 'true') {
      logger.debug({ query: e.query, duration: e.duration }, 'DB query');
    }
  });
}

(prisma as any).$on('error', (e: any) => {
  logger.error({ message: e.message }, 'Prisma error');
});

export default prisma;
