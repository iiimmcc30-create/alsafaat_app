// sentry.server.config.ts — loaded by Next.js at server startup (not build time)
// This file MUST exist at the project root for @sentry/nextjs to pick it up.
import { initialiseSentry } from '@/lib/sentry';
initialiseSentry();
