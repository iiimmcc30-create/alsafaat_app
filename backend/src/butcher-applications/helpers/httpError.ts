import type { NextApiResponse } from 'next';
import { apiError } from '@/middleware/auth';
import { logger } from '@/lib/logger';
import { ButcherApplicationError, isButcherApplicationError } from '../errors';

/**
 * Maps domain errors to the standard SAFAT API envelope.
 * Step 2+ routes should catch and delegate here.
 */
export function handleButcherApplicationError(res: NextApiResponse, err: unknown): void {
  if (isButcherApplicationError(err)) {
    apiError(res, err.httpStatus, err.code, err.messageAr, err.details);
    return;
  }

  logger.error({ err }, 'Unhandled butcher application error');
  apiError(res, 500, 'server_error', 'خطأ في الخادم');
}
