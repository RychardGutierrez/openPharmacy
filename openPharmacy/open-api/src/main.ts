import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

/**
 * openPharmacy API entry point.
 *
 * Configures:
 * - Global prefix `/api` for all routes
 * - Helmet security headers
 * - Cookie parsing (for the refresh-token cookie)
 * - CORS with credentials support
 * - Global ValidationPipe (whitelist, forbidNonWhitelisted, auto-transform)
 * - Global ClassSerializerInterceptor (hides @Exclude() fields from responses)
 * - Graceful shutdown hooks
 * - Swagger UI at `/docs` (development only)
 * - Rate limiting via @nestjs/throttler (configured in AuthModule)
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Config ─────────────────────────────────────────────────────────────────
  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3000);
  const env = config.get<string>('app.env', 'development');
  const corsOrigin = config.get<string>('app.corsOrigin', '*');
  const cookieSecret = config.getOrThrow<string>('app.cookieSecret');

  // ── Security middleware ────────────────────────────────────────────────────
  // Sets common HTTP security headers (CSP, X-Frame-Options, HSTS, etc.).
  // Tighten contentSecurityPolicy when the API starts serving HTML.
  app.use(helmet());

  // Signs the refresh-token cookie so the client cannot tamper with it.
  // The cookie is HttpOnly / SameSite=Lax and not readable from JavaScript.
  app.use(cookieParser(cookieSecret));

  // CORS — the frontend sends credentials: 'include' to send the refresh cookie.
  // In production, CORS_ORIGIN can be a comma-separated list of allowed origins.
  // Each origin is trimmed to avoid whitespace-induced mismatches.
  app.enableCors({
    origin:
      env === 'production'
        ? corsOrigin.split(',').map((o) => o.trim())
        : corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Validation & serialization ─────────────────────────────────────────────
  // Rejects incoming requests with:
  //   - unknown properties (forbidNonWhitelisted)
  //   - malformed data per class-validator decorators on DTOs
  // Strips unknown properties silently (whitelist).
  // Auto-converts types (query strings to numbers, etc.) via enableImplicitConversion.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Excludes properties annotated with @Exclude() from JSON responses.
  // E.g., User.passwordHash is never sent to the client.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // All routes are nested under /api (e.g., /api/auth/login, /api/users).
  app.setGlobalPrefix('api');

  // Listens for SIGTERM / SIGINT and calls lifecycle hooks (onApplicationShutdown).
  // Prevents abrupt connection drops during deployments.
  app.enableShutdownHooks();

  // ── Swagger (dev only) ─────────────────────────────────────────────────────
  // Interactive API docs at http://localhost:3000/docs.
  // Uses Bearer token authorization for protected endpoints.
  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('openPharmacy API')
      .setDescription('openPharmacy REST API')
      .setVersion('0.0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  await app.listen(port);

  console.log(
    `openPharmacy API listening on http://localhost:${port}/api (docs: /docs)`,
  );
}

void bootstrap();

