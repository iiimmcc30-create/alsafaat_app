// sentry.edge.config.ts — for Next.js Edge runtime (middleware, etc.)
import * as Sentry from '@sentry/nextjs';
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:              process.env.SENTRY_DSN,
    environment:      process.env.NODE_ENV,
    tracesSampleRate: 0.05,
  });
}
