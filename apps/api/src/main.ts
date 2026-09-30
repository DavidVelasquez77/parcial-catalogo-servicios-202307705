import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Pool } from 'pg';
import * as session from 'express-session';
import connectPgSimple = require('connect-pg-simple');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const PgSession = connectPgSimple(session);
  app.use(session({
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false }),
    secret: process.env.SESSION_SECRET ?? 'local-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 },
  }));
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:8080', credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  const config = new DocumentBuilder().setTitle('Catálogo de Servicios TI').setDescription('API del parcial práctico').setVersion('2.0').build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env.API_PORT ?? 3000), '0.0.0.0');
}

bootstrap();
