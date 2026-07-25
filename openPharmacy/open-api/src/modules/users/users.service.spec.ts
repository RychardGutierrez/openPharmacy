/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LastAdminDeactivationException } from './exceptions/last-admin-deactivation.exception';

const mockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'u-1',
  full_name: 'Test User',
  ci: '1234567',
  email: 'test@example.com',
  passwordHash: 'hashed',
  roleName: UserRole.PHARMACIST,
  reg_number: 'FARM-001',
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

const mockTx = {} as never;

describe('UsersService', () => {
  let service: UsersService;
  let users: jest.Mocked<UsersRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let jwt: jest.Mocked<JwtService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let audit: jest.Mocked<AuditLogRepository>;
  let config: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    const configMap: Record<string, unknown> = {
      'app.bcryptSaltRounds': 4,
      'auth.accessSecret': 'a'.repeat(40),
      'mailer.frontendUrl': 'http://localhost:4200',
    };
    config = {
      getOrThrow: jest.fn((key: string) => {
        if (!(key in configMap)) throw new Error(`Missing test config: ${key}`);
        return configMap[key];
      }),
    };

    users = {
      existsActiveByEmail: jest.fn(),
      existsActiveByCi: jest.fn(),
      existsActiveByEmailExcept: jest.fn(),
      existsActiveByCiExcept: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      findAllPaginated: jest.fn(),
      createWithHashedPasswordTx: jest.fn(),
      updateTx: jest.fn(),
      softDeleteTx: jest.fn(),
      restoreTx: jest.fn(),
      countActiveByRole: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockTx),
      ),
    } as unknown as jest.Mocked<PrismaService>;

    jwt = {
      sign: jest.fn().mockReturnValue('change-password-token'),
    } as unknown as jest.Mocked<JwtService>;

    eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventEmitter2>;

    audit = {
      createInTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: ConfigService, useValue: config },
        { provide: UsersRepository, useValue: users },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: AuditLogRepository, useValue: audit },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a PHARMACIST with regNumber and emits user.created', async () => {
      const dto: CreateUserDto = {
        fullName: 'Maria',
        ci: '7654321',
        email: 'pharmacist@example.com',
        role: UserRole.PHARMACIST,
        regNumber: 'FARM-001',
      };
      const created = mockUser({
        id: 'u-new',
        email: dto.email,
        full_name: dto.fullName,
        roleName: dto.role,
        reg_number: dto.regNumber,
      });

      users.existsActiveByEmail.mockResolvedValue(null);
      users.existsActiveByCi.mockResolvedValue(null);
      users.createWithHashedPasswordTx.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result.email).toBe(dto.email);
      expect(users.createWithHashedPasswordTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          full_name: dto.fullName,
          ci: dto.ci,
          email: dto.email,
          roleName: dto.role,
          reg_number: dto.regNumber,
        }),
        expect.any(String),
      );
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'USER_CREATED' }),
      );
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({ userId: 'u-new' }),
      );
    });

    it('throws ConflictException when email already exists', async () => {
      users.existsActiveByEmail.mockResolvedValue(mockUser());

      await expect(
        service.create({
          fullName: 'X',
          ci: '1111111',
          email: 'taken@example.com',
          role: UserRole.CASHIER,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deactivate', () => {
    it('throws LastAdminDeactivationException when deactivating the only admin', async () => {
      users.findByIdIncludingDeleted.mockResolvedValue(
        mockUser({ id: 'admin-1', roleName: UserRole.ADMIN }),
      );
      users.countActiveByRole.mockResolvedValue(1);

      await expect(service.deactivate('admin-1')).rejects.toThrow(
        LastAdminDeactivationException,
      );
    });

    it('deactivates a non-last admin', async () => {
      const admin = mockUser({
        id: 'admin-1',
        roleName: UserRole.ADMIN,
      });
      users.findByIdIncludingDeleted.mockResolvedValue(admin);
      users.countActiveByRole.mockResolvedValue(2);
      users.softDeleteTx.mockResolvedValue({
        ...admin,
        active: false,
        deleted_at: new Date(),
      });

      const result = await service.deactivate('admin-1');

      expect(result.active).toBe(false);
      expect(users.softDeleteTx).toHaveBeenCalledWith(
        mockTx,
        'admin-1',
        expect.any(Date),
      );
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'USER_DEACTIVATED' }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when user does not exist', async () => {
      users.findByIdIncludingDeleted.mockResolvedValue(null);

      await expect(service.update('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when new email is taken', async () => {
      users.findByIdIncludingDeleted.mockResolvedValue(
        mockUser({ id: 'u-1', email: 'old@example.com' }),
      );
      users.existsActiveByEmailExcept.mockResolvedValue(mockUser());

      await expect(
        service.update('u-1', { email: 'new@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated mapped results', async () => {
      users.findAllPaginated.mockResolvedValue({
        data: [mockUser()],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const result = await service.findAll({
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(users.findAllPaginated).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        role: undefined,
        active: undefined,
        q: undefined,
      });
    });
  });
});
