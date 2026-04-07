import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'CORS_ORIGIN'];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  if (process.env.CORS_ORIGIN === '*') {
    throw new Error('CORS_ORIGIN must not be wildcard (*) in production. Set it to your frontend domain.');
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());

  const origins = process.env.CORS_ORIGIN!.split(',').map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
