export const isRedisEnabled = () => process.env.REDIS_ENABLED !== 'false';

export const QUEUE_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: 1,
};

export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
  PUSH: 'push-notifications',
  FEE_CHECKS: 'fee-checks',
  IMAGE_PROCESSING: 'image-processing',
  SUBSCRIPTIONS: 'subscriptions',
} as const;
