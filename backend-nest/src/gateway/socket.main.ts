import '../load-env';
import { NestFactory } from '@nestjs/core';
import { LoggerService } from '../common/services/logger.service';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, { logger: false });
  const socketPort = parseInt(process.env.SOCKET_PORT || '3002', 10);
  const httpPort = parseInt(process.env.SOCKET_HTTP_PORT || '3003', 10);
  await app.listen(httpPort, '0.0.0.0');

  const logger = app.get(LoggerService);
  logger.info({ socketPort, httpPort }, '🔌 Socket.IO server running');
}

bootstrap().catch((err) => {
  console.error('Socket server failed', err);
  process.exit(1);
});
