import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../backend/.env') });
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  json,
  urlencoded,
  static as expressStatic,
  Request,
  Response,
  NextFunction,
} from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { logger } from './shared/lib/logger';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function resolveAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes('*')) return origin;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (process.env.NODE_ENV !== 'production') {
    if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
  }
  return null;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const url = req.url ?? '';
    if (url.startsWith('/api/v1/')) {
      req.url = url.replace('/api/v1/', '/api/');
    }
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.path === '/api/payments/webhook' ||
      req.path === '/api/upload/direct'
    )
      return next();
    return json({ limit: '64kb' })(req, res, next);
  });

  app.use(urlencoded({ extended: true, limit: '64kb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = resolveAllowedOrigin(req.headers.origin);
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization,Content-Type,X-Requested-With,X-Request-ID,x-cron-secret,x-signature,x-ni-signature',
    );
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(
    '/uploads',
    expressStatic(join(process.cwd(), 'public', 'uploads'), {
      maxAge: '7d',
      fallthrough: true,
    }),
  );

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('سرح API')
      .setDescription(
        'NestJS migration — backward compatible with React Native client',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port, '0.0.0.0');
  logger.info({ port }, 'سرح NestJS API running');
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start NestJS API');
  process.exit(1);
});
