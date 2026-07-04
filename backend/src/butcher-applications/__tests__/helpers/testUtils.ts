import type { NextApiRequest, NextApiResponse } from 'next';
import type { JwtPayload } from '@/lib/jwt';

export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
export const TEST_ADMIN_ID = '22222222-2222-2222-2222-222222222222';
export const TEST_OTHER_USER_ID = '33333333-3333-3333-3333-333333333333';
export const TEST_APP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const TEST_DOC_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

export function userPayload(userId = TEST_USER_ID, role: JwtPayload['role'] = 'USER'): JwtPayload {
  return { userId, role, passwordVersion: 1, username: 'testuser' };
}

export function createMockReq(
  overrides: Partial<NextApiRequest> & { user?: JwtPayload } = {},
): NextApiRequest & { user?: JwtPayload } {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as NextApiRequest & { user?: JwtPayload };
}

export function createMockRes(): NextApiResponse & {
  _status: number;
  _json: unknown;
} {
  const res = {
    _status: 200,
    _json: undefined as unknown,
  } as NextApiResponse & { _status: number; _json: unknown };

  (res as any).status = jest.fn((code: number) => {
    res._status = code;
    return res;
  });

  (res as any).json = jest.fn((body: unknown) => {
    res._json = body;
    return res;
  });

  (res as any).end = jest.fn(() => res);
  (res as any).setHeader = jest.fn();

  return res;
}

export function getResponseBody<T = Record<string, unknown>>(res: ReturnType<typeof createMockRes>): T {
  return res._json as T;
}
