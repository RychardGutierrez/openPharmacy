/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MailerService } from '../src/common/mailer/mailer.service';

const hasDatabase = !!process.env.DATABASE_URL;
const describeDb = hasDatabase ? describe : describe.skip;

describeDb('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let sendWelcome: jest.Mock;
  const createdUserIds: string[] = [];

  const originalEnv = process.env;
  const baseEnv = {
    ...originalEnv,
    NODE_ENV: 'test',
    COOKIE_SECRET: 'e2e-cookie-secret-32-chars-or-more-please',
    JWT_ACCESS_SECRET: 'e2e-access-secret-32-chars-or-more-please',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret-32-chars-or-more-please',
    JWT_ACCESS_TTL: '8h',
    JWT_REFRESH_TTL: '7d',
    BCRYPT_SALT_ROUNDS: '4',
    LOCKOUT_MAX_ATTEMPTS: '5',
    LOCKOUT_DURATION_MIN: '15',
    THROTTLE_SHORT_TTL: '1000',
    THROTTLE_SHORT_LIMIT: '1000',
    THROTTLE_MEDIUM_TTL: '10000',
    THROTTLE_MEDIUM_LIMIT: '1000',
    THROTTLE_LONG_TTL: '60000',
    THROTTLE_LONG_LIMIT: '1000',
    THROTTLE_LOGIN_TTL: '60000',
    THROTTLE_LOGIN_LIMIT: '1000',
  };

  beforeAll(async () => {
    process.env = { ...originalEnv, ...baseEnv };

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });
    await prisma.$connect();

    // Clean up only test users created by previous runs; leave the seeded
    // admin and other application data intact.
    const existingTestUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'e2e-' } },
      select: { id: true },
    });
    for (const { id } of existingTestUsers) {
      await prisma.auditLog.deleteMany({ where: { user_id: id } });
      await prisma.refreshToken.deleteMany({ where: { user_id: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    sendWelcome = jest.fn().mockResolvedValue(undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ sendWelcome })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser(process.env.COOKIE_SECRET));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    if (prisma) {
      for (const id of createdUserIds) {
        await prisma.auditLog.deleteMany({ where: { user_id: id } });
        await prisma.refreshToken.deleteMany({ where: { user_id: id } });
        await prisma.user.deleteMany({ where: { id } });
      }
      await prisma.$disconnect();
    }
    if (app) await app.close();
    process.env = originalEnv;
  });

  async function createUser(
    role: UserRole,
    suffix: string,
    overrides: Record<string, unknown> = {},
  ) {
    const email = `e2e-${suffix}-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const user = await prisma.user.create({
      data: {
        full_name: `E2E ${suffix}`,
        ci: `${suffix}-${Date.now()}`,
        email,
        passwordHash,
        roleName: role,
        reg_number: role === UserRole.PHARMACIST ? 'FARM-001' : null,
        active: true,
        deleted_at: null,
        failed_attempts: 0,
        locked_until: null,
        last_failed_at: null,
        password_changed_at: null,
        last_login: null,
        ...overrides,
      },
    });
    createdUserIds.push(user.id);
    return { id: user.id, email, password: 'correct-password' };
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('AC1: admin can create a PHARMACIST with regNumber', async () => {
    const admin = await createUser(UserRole.ADMIN, 'ac1-admin');
    const token = await login(admin.email, admin.password);

    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Dr. Smith',
        ci: `${String(Date.now()).slice(-10)}1`,
        email: `e2e-ac1-pharm-${Date.now()}@example.com`,
        role: 'PHARMACIST',
        regNumber: 'FARM-2024-001',
      })
      .expect(201);

    expect(res.body.email).toBeDefined();
    expect(res.body.role).toBe('PHARMACIST');
    expect(sendWelcome).toHaveBeenCalled();
    createdUserIds.push(res.body.id);
  });

  it('AC2: creating PHARMACIST without regNumber returns 400', async () => {
    const admin = await createUser(UserRole.ADMIN, 'ac2-admin');
    const token = await login(admin.email, admin.password);

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Dr. NoReg',
        ci: `${String(Date.now()).slice(-10)}2`,
        email: `e2e-ac2-pharm-${Date.now()}@example.com`,
        role: 'PHARMACIST',
      })
      .expect(400);
  });

  it('AC3: non-admin cannot create users', async () => {
    await createUser(UserRole.ADMIN, 'ac3-admin');
    const pharm = await createUser(UserRole.PHARMACIST, 'ac3-pharm-2');
    const pharmToken = await login(pharm.email, pharm.password);

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({
        fullName: 'Hacker',
        ci: `${String(Date.now()).slice(-10)}3`,
        email: `e2e-ac3-hacker-${Date.now()}@example.com`,
        role: 'CASHIER',
      })
      .expect(403);
  });

  it('AC4: deactivating the last admin returns 409 LAST_ADMIN', async () => {
    const admin = await createUser(UserRole.ADMIN, 'ac4-admin');
    const token = await login(admin.email, admin.password);

    // Deactivate every other active admin so this one becomes the last.
    const otherAdmins = await prisma.user.findMany({
      where: {
        roleName: UserRole.ADMIN,
        active: true,
        deleted_at: null,
        NOT: { id: admin.id },
      },
      select: { id: true },
    });
    for (const { id } of otherAdmins) {
      await request(app.getHttpServer())
        .patch(`/api/users/${id}/deactivate`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${admin.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    expect(res.body.code).toBe('LAST_ADMIN');
  });

  it('AC5: admin can list, deactivate, and reactivate a user', async () => {
    const admin = await createUser(UserRole.ADMIN, 'ac5-admin');
    await createUser(UserRole.ADMIN, 'ac5-admin-2');
    const pharm = await createUser(UserRole.PHARMACIST, 'ac5-pharm');
    const token = await login(admin.email, admin.password);

    const list = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.data).toBeInstanceOf(Array);
    expect(list.body.total).toBeGreaterThanOrEqual(1);

    const deactivate = await request(app.getHttpServer())
      .patch(`/api/users/${pharm.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(deactivate.body.active).toBe(false);

    const activate = await request(app.getHttpServer())
      .patch(`/api/users/${pharm.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(activate.body.active).toBe(true);
  });

  it('AC6: GET /api/users/:id returns a deactivated user for admin', async () => {
    const admin = await createUser(UserRole.ADMIN, 'ac6-admin');
    await createUser(UserRole.ADMIN, 'ac6-admin-2');
    const pharm = await createUser(UserRole.PHARMACIST, 'ac6-pharm');
    const token = await login(admin.email, admin.password);

    await request(app.getHttpServer())
      .patch(`/api/users/${pharm.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/users/${pharm.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe(pharm.id);
    expect(res.body.active).toBe(false);
  });
});
