import {
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { UsersRepository } from './repositories/users.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import {
  RefreshTokenRepository,
  hashJti,
} from './repositories/refresh-token.repository';
import { LoginDto } from './dto/login.dto';
import { LoginServiceResult } from './dto/login-response.dto';
import { RefreshServiceResult } from './dto/refresh-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import {
  AuthenticatedUser,
  JwtPayload,
  RefreshTokenPayload,
} from './interfaces/jwt-payload.interface';
import { REFRESH_COOKIE_NAME, RefreshCookieOptions } from './auth.constants';

export interface RequestMetadata {
  ip: string | null;
  userAgent: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec: number;
  refreshExpiresInMs: number;
}

const MS_IN_SECOND = 1000;

const parseTtlToMs = (ttl: string): number => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(ttl);
  if (!match) {
    return 8 * 60 * 60 * 1000;
  }
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'ms':
      return value;
    case 's':
      return value * MS_IN_SECOND;
    case 'm':
      return value * 60 * MS_IN_SECOND;
    case 'h':
      return value * 60 * 60 * MS_IN_SECOND;
    case 'd':
      return value * 24 * 60 * 60 * MS_IN_SECOND;
    default:
      return 8 * 60 * 60 * MS_IN_SECOND;
  }
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptSaltRounds: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly lockoutMaxAttempts: number;
  private readonly lockoutDurationMin: number;
  private readonly cookieName = REFRESH_COOKIE_NAME;
  private readonly cookiePath = '/api/auth';
  private readonly accessExpiresInSec: number;

  constructor(
    private readonly users: UsersRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly audit: AuditLogRepository,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.bcryptSaltRounds = config.getOrThrow<number>('app.bcryptSaltRounds');
    this.accessSecret = config.getOrThrow<string>('auth.accessSecret');
    this.refreshSecret = config.getOrThrow<string>('auth.refreshSecret');
    this.accessTtl = config.getOrThrow<string>('auth.accessTtl');
    this.refreshTtl = config.getOrThrow<string>('auth.refreshTtl');
    this.lockoutMaxAttempts = config.getOrThrow<number>(
      'auth.lockoutMaxAttempts',
    );
    this.lockoutDurationMin = config.getOrThrow<number>(
      'auth.lockoutDurationMin',
    );
    this.accessExpiresInSec = Math.floor(
      parseTtlToMs(this.accessTtl) / MS_IN_SECOND,
    );
  }

  getCookieOptions(): RefreshCookieOptions {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: this.cookiePath,
      maxAgeMs: parseTtlToMs(this.refreshTtl),
    };
  }

  getCookieName(): string {
    return this.cookieName;
  }

  async login(
    dto: LoginDto,
    meta: RequestMetadata,
  ): Promise<LoginServiceResult> {
    const user = await this.users.findByEmail(dto.email);

    if (!user) {
      await this.audit.create({
        event: 'LOGIN_FAIL',
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { email: dto.email, reason: 'unknown_email' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = new Date();

    if (user.locked_until && user.locked_until > now) {
      await this.audit.create({
        userId: user.id,
        event: 'LOGIN_LOCKED',
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'attempt_while_locked' },
      });
      const minutes = Math.ceil(
        (user.locked_until.getTime() - now.getTime()) / 60000,
      );
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'ACCOUNT_LOCKED',
        message: `Account locked. Try again in ${minutes} minute(s).`,
      });
    }

    const passwordOk = await compare(dto.password, user.passwordHash);

    if (!passwordOk) {
      const nextAttempts = user.failed_attempts + 1;
      const shouldLock = nextAttempts >= this.lockoutMaxAttempts;
      const lockedUntil = shouldLock
        ? new Date(now.getTime() + this.lockoutDurationMin * 60 * 1000)
        : null;

      await this.users.registerFailedAttempt(
        user.id,
        nextAttempts,
        lockedUntil,
        now,
      );

      if (shouldLock) {
        await this.audit.create({
          userId: user.id,
          event: 'LOGIN_LOCKED',
          ip: meta.ip,
          userAgent: meta.userAgent,
          metadata: { reason: 'max_attempts_reached', attempts: nextAttempts },
        });
      } else {
        await this.audit.create({
          userId: user.id,
          event: 'LOGIN_FAIL',
          ip: meta.ip,
          userAgent: meta.userAgent,
          metadata: { attempts: nextAttempts },
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.users.registerSuccessfulLogin(user.id, now);

    const issued = await this.issueTokens(user);
    await this.audit.create({
      userId: user.id,
      event: 'LOGIN_SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { jti: this.hashJtiForAudit(issued.refreshToken) },
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      expiresIn: issued.accessExpiresInSec,
      user: this.toUserResponse(user),
    };
  }

  async refresh(
    refreshTokenJwt: string | undefined,
    meta: RequestMetadata,
  ): Promise<RefreshServiceResult> {
    if (!refreshTokenJwt) {
      await this.audit.create({
        event: 'REFRESH_FAIL',
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'missing_refresh_token' },
      });
      throw new UnauthorizedException('Refresh token required');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshTokenJwt,
        {
          secret: this.refreshSecret,
        },
      );
    } catch {
      await this.audit.create({
        event: 'REFRESH_FAIL',
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'invalid_signature_or_expired' },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.refreshTokens.findActiveByHashedJti(
      hashJti(payload.jti),
    );
    if (!stored || stored.expires_at < new Date()) {
      await this.audit.create({
        userId: payload.sub,
        event: 'REFRESH_FAIL',
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'unknown_or_expired_jti' },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revoked_at) {
      await this.audit.create({
        userId: stored.user_id,
        event: 'REFRESH_FAIL',
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'jti_revoked' },
      });
      throw new UnauthorizedException('Refresh token revoked');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.active) {
      await this.audit.create({
        userId: payload.sub,
        event: 'REFRESH_FAIL',
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'user_inactive' },
      });
      throw new UnauthorizedException('User not found or inactive');
    }

    const newJti = randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + parseTtlToMs(this.refreshTtl),
    );
    const newRefreshJwt = this.signRefresh({ sub: user.id, jti: newJti });
    await this.refreshTokens.rotate({
      oldTokenId: stored.id,
      newJti,
      newExpiresAt: refreshExpiresAt,
    });

    const accessToken = this.signAccess({
      sub: user.id,
      role: user.roleName,
    });

    await this.audit.create({
      userId: user.id,
      event: 'REFRESH_SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { rotatedFrom: hashJti(payload.jti), newJti: hashJti(newJti) },
    });

    return {
      accessToken,
      refreshToken: newRefreshJwt,
      expiresIn: this.accessExpiresInSec,
      user: this.toUserResponse(user),
    };
  }

  async logout(
    refreshTokenJwt: string | undefined,
    userId: string | undefined,
    meta: RequestMetadata,
  ): Promise<void> {
    if (refreshTokenJwt) {
      try {
        const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
          refreshTokenJwt,
          { secret: this.refreshSecret },
        );
        await this.refreshTokens.revoke(hashJti(payload.jti));
      } catch {
        // best-effort: invalid/expired token, nothing to revoke
      }
    }
    await this.audit.create({
      userId: userId ?? null,
      event: 'LOGOUT',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async hashPassword(plain: string): Promise<string> {
    return hash(plain, this.bcryptSaltRounds);
  }

  private async issueTokens(user: User): Promise<IssuedTokens> {
    const jti = randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + parseTtlToMs(this.refreshTtl),
    );
    const accessToken = this.signAccess({ sub: user.id, role: user.roleName });
    const refreshToken = this.signRefresh({ sub: user.id, jti });
    await this.refreshTokens.create({
      userId: user.id,
      jti,
      expiresAt: refreshExpiresAt,
    });
    return {
      accessToken,
      refreshToken,
      accessExpiresInSec: this.accessExpiresInSec,
      refreshExpiresInMs: refreshExpiresAt.getTime() - Date.now(),
    };
  }

  private signAccess(payload: Omit<JwtPayload, 'iat'>): string {
    return this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: Math.floor(parseTtlToMs(this.accessTtl) / MS_IN_SECOND),
    });
  }

  private signRefresh(
    payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
  ): string {
    return this.jwt.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: Math.floor(parseTtlToMs(this.refreshTtl) / MS_IN_SECOND),
    });
  }

  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.roleName,
    };
  }

  private hashJtiForAudit(refreshJwt: string): string {
    const parts = refreshJwt.split('.');
    if (parts.length !== 3) return 'malformed';
    try {
      const payload = JSON.parse(
        Buffer.from(
          parts[1].replace(/-/g, '+').replace(/_/g, '/'),
          'base64',
        ).toString(),
      ) as RefreshTokenPayload;
      return hashJti(payload.jti);
    } catch {
      return 'unparseable';
    }
  }
}

export type { AuthenticatedUser };
