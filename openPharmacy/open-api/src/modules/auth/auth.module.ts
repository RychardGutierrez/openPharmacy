import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './repositories/users.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuditInterceptor } from './interceptors/audit.interceptor';

const parseTtlToSec = (ttl: string): number => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(ttl);
  if (!match) return 28800;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'ms':
      return Math.max(1, Math.floor(value / 1000));
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 28800;
  }
};

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.accessSecret'),
        signOptions: {
          expiresIn: parseTtlToSec(config.getOrThrow<string>('auth.accessTtl')),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'short',
          ttl: config.getOrThrow<number>('throttle.shortTtl'),
          limit: config.getOrThrow<number>('throttle.shortLimit'),
        },
        {
          name: 'medium',
          ttl: config.getOrThrow<number>('throttle.mediumTtl'),
          limit: config.getOrThrow<number>('throttle.mediumLimit'),
        },
        {
          name: 'long',
          ttl: config.getOrThrow<number>('throttle.longTtl'),
          limit: config.getOrThrow<number>('throttle.longLimit'),
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    AuditLogRepository,
    RefreshTokenRepository,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    AuditInterceptor,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
