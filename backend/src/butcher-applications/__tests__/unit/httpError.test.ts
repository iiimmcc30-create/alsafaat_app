import { handleButcherApplicationError } from '../../helpers/httpError';
import { ButcherApplicationError } from '../../errors';
import { createMockRes, getResponseBody } from '../helpers/testUtils';

describe('handleButcherApplicationError', () => {
  it('maps domain errors to apiError envelope', () => {
    const res = createMockRes();
    handleButcherApplicationError(res, new ButcherApplicationError('APPLICATION_NOT_FOUND'));

    expect(res._status).toBe(404);
    const body = getResponseBody(res);
    expect(body).toMatchObject({
      success: false,
      error: 'APPLICATION_NOT_FOUND',
      messageAr: 'طلب التقديم غير موجود',
    });
  });

  it('maps unknown errors to server_error', () => {
    const res = createMockRes();
    handleButcherApplicationError(res, new Error('boom'));
    expect(res._status).toBe(500);
    expect(getResponseBody(res).error).toBe('server_error');
  });
});
