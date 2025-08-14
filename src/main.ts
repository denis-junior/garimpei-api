import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
      transform: true,
    }),
  );

  // CORS configuration
  app.enableCors({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    origin: configService.get('cors.origins'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Cache-Control',
    ],
  });

  // Swagger setup (apenas em desenvolvimento)
  if (configService.get('nodeEnv') === 'development') {
    const config = new DocumentBuilder()
      .setTitle('Garimpei API')
      .setDescription(
        'API do aplicativo Garimpei - Sistema de Leilão de Roupas',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const port = configService.get('port');
  await app.listen(port);

  console.log(`🚀 Application running on port ${port}`);
  console.log(`📝 Environment: ${configService.get('nodeEnv')}`);

  if (configService.get('nodeEnv') === 'development') {
    console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
