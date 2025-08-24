import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Obter as origens CORS do .env e converter em array
  const corsOrigins: string[] =
    configService.get<string>('CORS_ORIGINS')?.split(',') || [];
  // Configurar CORS para permitir SSE
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Cache-Control',
    ],
  });

  await app.listen(3000);
}
bootstrap();
