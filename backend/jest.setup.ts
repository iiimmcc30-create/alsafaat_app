// Silence pino during tests unless DEBUG is set.
if (!process.env.DEBUG) {
  jest.mock('@/lib/logger', () => ({
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    },
  }));
}

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-with-at-least-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-min!!';
