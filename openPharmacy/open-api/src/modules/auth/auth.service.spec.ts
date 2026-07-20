/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersRepository } from './repositories/users.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { UserRole } from '@prisma/client';

const buildUser = (
  overrides: Partial<{
    id: string;
    full_name: string;
    ci: string;
    email: string;
    passwordHash: string;
    roleName: UserRole;
    reg_number: string | null;
    active: boolean;
    deleted_at: Date | null;
    last_login: Date | null;
    failed_attempts: number;
    locked_until: Date | null;
    last_failed_at: Date | null;
    password_changed_at: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) => ({
  id: 'u-1',
  full_name: 'Test User',
  ci: '1234567',
  email: 'test@example.com',
  passwordHash: bcrypt.hashSync('correct-password', 4),
  roleName: UserRole.PHARMACIST as UserRole,
  reg_number: null,
  active: true,
  deleted_at: null,
  last_login: null,
  failed_attempts: 0,
  locked_until: null,
  last_failed_at: null,
  password_changed_at: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const META = { ip: '127.0.0.1', userAgent: 'jest' };

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersRepository>;
  let refreshTokens: jest.Mocked<RefreshTokenRepository>;
  let audit: jest.Mocked<AuditLogRepository>;
  let jwt: jest.Mocked<JwtService>;
  let config: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    const configMap: Record<string, unknown> = {
      'app.bcryptSaltRounds': 4,
      'auth.accessSecret': 'a'.repeat(40),
      'auth.refreshSecret': 'b'.repeat(40),
      'auth.accessTtl': '8h',
      'auth.refreshTtl': '7d',
      'auth.lockoutMaxAttempts': 5,
      'auth.lockoutDurationMin': 15,
    };
    config = {
      getOrThrow: jest.fn((key: string) => {
        if (!(key in configMap)) throw new Error(`Missing test config: ${key}`);
        return configMap[key];
      }),
    };

    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      registerSuccessfulLogin: jest.fn(),
      registerFailedAttempt: jest.fn(),
      setPasswordChangedAt: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    refreshTokens = {
      findActiveByHashedJti: jest.fn(),
      create: jest.fn(),
      rotate: jest.fn(),
      revoke: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenRepository>;

    audit = {
      create: jest.fn(),
      countByUserAndEvent: jest.fn(),
    } as unknown as jest.Mocked<AuditLogRepository>;

    jwt = {
      sign: jest.fn().mockImplementation(() => 'signed.jwt.token'),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: config },
        { provide: UsersRepository, useValue: users },
        { provide: RefreshTokenRepository, useValue: refreshTokens },
        { provide: AuditLogRepository, useValue: audit },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('returns access+refresh and audits LOGIN_SUCCESS on valid credentials', async () => {
      const user = buildUser();
      users.findByEmail.mockResolvedValue(user);
      refreshTokens.create.mockResolvedValue({} as never);

      const result = await service.login(
        { email: 'Test@Example.com', password: 'correct-password' },
        META,
      );

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('test@example.com');
      expect(users.registerSuccessfulLogin).toHaveBeenCalledWith(
        user.id,
        expect.any(Date),
      );
      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'LOGIN_SUCCESS', userId: user.id }),
      );
    });

    it('throws UnauthorizedException for unknown email and audits LOGIN_FAIL', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'x' }, META),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_FAIL',
          metadata: { email: 'nobody@example.com', reason: 'unknown_email' },
        }),
      );
      expect(users.registerFailedAttempt).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException and increments counter on wrong password', async () => {
      const user = buildUser({ failed_attempts: 1 });
      users.findByEmail.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'wrong' }, META),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(users.registerFailedAttempt).toHaveBeenCalledWith(
        user.id,
        2,
        null,
        expect.any(Date),
      );
      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_FAIL',
          metadata: { attempts: 2 },
        }),
      );
    });

    it('locks the account on the 5th failed attempt and audits LOGIN_LOCKED', async () => {
      const user = buildUser({ failed_attempts: 4 });
      users.findByEmail.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'wrong' }, META),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(users.registerFailedAttempt).toHaveBeenCalledWith(
        user.id,
        5,
        expect.any(Date),
        expect.any(Date),
      );
      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_LOCKED',
          metadata: { reason: 'max_attempts_reached', attempts: 5 },
        }),
      );
    });

    it('throws 422 (locked) when account is currently locked', async () => {
      const future = new Date(Date.now() + 10 * 60 * 1000);
      const user = buildUser({ locked_until: future });
      users.findByEmail.mockResolvedValue(user);

      await expect(
        service.login(
          { email: user.email, password: 'correct-password' },
          META,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_LOCKED',
          metadata: { reason: 'attempt_while_locked' },
        }),
      );
    });
  });

  describe('refresh', () => {
    it('rejects when no refresh token provided', async () => {
      await expect(service.refresh(undefined, META)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when token signature is invalid', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));

      await expect(service.refresh('bad.token', META)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'REFRESH_FAIL' }),
      );
    });

    it('rotates the token on success and audits REFRESH_SUCCESS', async () => {
      const user = buildUser();
      jwt.verifyAsync.mockResolvedValue({ sub: user.id, jti: 'old-jti' });
      refreshTokens.findActiveByHashedJti.mockResolvedValue({
        id: 'rt-1',
        user_id: user.id,
        hashed_jti: 'hashed-old',
        expires_at: new Date(Date.now() + 60_000),
        revoked_at: null,
        created_at: new Date(),
        replaced_by: null,
      });
      users.findById.mockResolvedValue(user);
      refreshTokens.rotate.mockResolvedValue({} as never);
      // In the refresh flow the service calls signRefresh first, then signAccess.
      jwt.sign
        .mockReturnValueOnce('new-refresh-jwt')
        .mockReturnValueOnce('new-access-jwt');

      const result = await service.refresh('valid.token', META);

      expect(result.accessToken).toBe('new-access-jwt');
      expect(result.refreshToken).toBe('new-refresh-jwt');
      expect(refreshTokens.rotate).toHaveBeenCalledWith({
        oldTokenId: 'rt-1',
        newJti: expect.any(String),
        newExpiresAt: expect.any(Date),
      });
      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'REFRESH_SUCCESS' }),
      );
    });

    it('rejects an already-revoked refresh token', async () => {
      const user = buildUser();
      jwt.verifyAsync.mockResolvedValue({ sub: user.id, jti: 'old-jti' });
      refreshTokens.findActiveByHashedJti.mockResolvedValue({
        id: 'rt-1',
        user_id: user.id,
        hashed_jti: 'hashed-old',
        expires_at: new Date(Date.now() + 60_000),
        revoked_at: new Date(Date.now() - 1000),
        created_at: new Date(),
        replaced_by: null,
      });

      await expect(service.refresh('valid.token', META)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the token and writes a LOGOUT audit row', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u-1', jti: 'old' });
      refreshTokens.revoke.mockResolvedValue({ count: 1 });

      await service.logout('valid.token', 'u-1', META);

      expect(refreshTokens.revoke).toHaveBeenCalled();
      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'LOGOUT', userId: 'u-1' }),
      );
    });

    it('still writes a LOGOUT audit row when no token provided', async () => {
      await service.logout(undefined, 'u-1', META);

      expect(refreshTokens.revoke).not.toHaveBeenCalled();
      expect(audit.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'LOGOUT', userId: 'u-1' }),
      );
    });
  });
});
