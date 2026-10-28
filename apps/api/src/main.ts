import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Pool } from 'pg';
import * as session from 'express-session';
import connectPgSimple = require('connect-pg-simple');
import { AppModule } from './app.module';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const sessionSecret = process.env.SESSION_SECRET ?? '';
    if (sessionSecret.length < 32 || /change[_-]?(this|me)|demo[_-]?only|local[_-]?demo/i.test(sessionSecret)) {
      throw new Error('En producción, SESSION_SECRET debe ser aleatorio y tener al menos 32 caracteres.');
    }

    let databasePassword: string;
    try {
      databasePassword = decodeURIComponent(new URL(process.env.DATABASE_URL ?? '').password);
    } catch (error) {
      throw new Error('En producción, DATABASE_URL debe incluir una contraseña PostgreSQL fuerte.');
    }
    if (databasePassword.length < 16 || /change[_-]?(this|me)|demo[_-]?only|local[_-]?demo/i.test(databasePassword)) {
      throw new Error('La contraseña de PostgreSQL de demostración no se permite en producción.');
    }

    const demoPasswords = [
      ['DEMO_ADMIN_PASSWORD','Admin123!'],
      ['DEMO_QUERY_PASSWORD','Consulta123!'],
      ['DEMO_REQUESTER_PASSWORD','Solicita123!'],
      ['DEMO_AGENT1_PASSWORD','Agente123!'],
      ['DEMO_AGENT2_PASSWORD','Agente123!'],
      ['DEMO_APPROVER_PASSWORD','Aprueba123!'],
    ];
    if (demoPasswords.some(([key, demoPassword]) => {
      const configured = process.env[key] ?? '';
      return configured.length < 12 || configured === demoPassword;
    })) {
      throw new Error('En producción deben reemplazarse todas las contraseñas demo por claves de al menos 12 caracteres.');
    }
  }

  const app = await NestFactory.create(AppModule);
  if (isProduction) app.getHttpAdapter().getInstance().set('trust proxy', 1);
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
