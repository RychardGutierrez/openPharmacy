import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditLogRepository } from './repositories/audit-log.repository';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            getCookieOptions: jest.fn().mockReturnValue({
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              path: '/api/auth',
              maxAgeMs: 7 * 24 * 60 * 60 * 1000,
            }),
            getCookieName: jest.fn().mockReturnValue('refresh'),
          },
        },
        {
          provide: AuditLogRepository,
          useValue: { create: jest.fn() },
        },
        {
          provide: AuditInterceptor,
          useValue: {
            intercept: (_: unknown, next: { handle: () => unknown }) =>
              next.handle(),
          },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });
});
