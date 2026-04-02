import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOriginEnv = process.env.CORS_ORIGIN;
  if (corsOriginEnv) {
    app.enableCors({
      origin: corsOriginEnv.split(',').map(o => o.trim()),
      credentials: true,
    });
  } else {
    app.enableCors();
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
