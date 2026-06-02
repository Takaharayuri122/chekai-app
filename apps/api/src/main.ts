import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Função principal que inicializa a aplicação NestJS.
 * Configura validação global, CORS e documentação Swagger.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:3031',
        'http://localhost:3001',
        process.env.CORS_ORIGIN,
      ].filter(Boolean);
      
      // Permite requisições sem origin (apps mobile, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Permite domínios da Vercel (*.vercel.app)
      const isVercelDomain = /^https:\/\/.*\.vercel\.app$/.test(origin);
      
      // Permite IPs de rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      const isLocalNetwork = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

      // Next dev usa --hostname 0.0.0.0; o browser envia Origin com 0.0.0.0 ou 127.0.0.1
      const isLocalDevHost = /^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin);

      if (allowedOrigins.includes(origin) || isVercelDomain || isLocalNetwork || isLocalDevHost) {
        return callback(null, true);
      }
      
      return callback(new Error('Origem não permitida pelo CORS'), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Meta App API')
    .setDescription('API para Consultoria em Segurança de Alimentos com IA')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API rodando em: http://localhost:${port}`);
  console.log(`📚 Swagger disponível em: http://localhost:${port}/api/docs`);
}

bootstrap();

