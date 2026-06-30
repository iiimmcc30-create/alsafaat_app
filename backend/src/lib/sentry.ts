// src/lib/sentry.ts — Sentry runtime initialisation
// Called once at server startup. next.config.js handles build-time source maps.
import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';

let initialised = false;

export function initialiseSentry(): void {
  if (initialised) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('SENTRY_DSN not set — error tracking disabled in production');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment:       process.env.NODE_ENV || 'development',
    release:           process.env.npm_package_version || '1.0.0',
    tracesSampleRate:  process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.05,

    // Ignore noisy non-actionable errors
    ignoreErrors: [
      'TokenExpiredError',
      'JsonWebTokenError',
      /^ECONNRESET$/,
      /^EPIPE$/,
    ],

    beforeSend(event, hint) {
      // Strip PII from request bodies before sending to Sentry
      if (event.request?.data) {
        const body = event.request.data as Record<string, unknown>;
        ['password', 'currentPassword', 'newPassword', 'refreshToken', 'accessToken', 'fcmToken'].forEach(
          (key) => { if (key in body) body[key] = '[REDACTED]'; }
        );
      }
      return event;
    },
  });

  initialised = true;
  logger.info({ dsn: dsn.slice(0, 30) + '...' }, 'Sentry initialised');
}

// Wrap async route handlers so unhandled errors are captured with context
export function withSentry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, unknown>,
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      Sentry.withScope((scope) => {
        if (context) scope.setExtras(context);
        Sentry.captureException(err);
      });
      throw err;
    }
  }) as T;
}

export { Sentry };
