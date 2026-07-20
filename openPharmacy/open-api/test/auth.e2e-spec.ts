/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const hasDatabase = !!process.env.DATABASE_URL;
const describeDb = hasDatabase ? describe : describe.skip;

describeDb('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
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
  };

  beforeAll(async () => {
    process.env = { ...originalEnv, ...baseEnv };

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
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
    suffix: string,
  ): Promise<{ id: string; email: string; password: string }> {
    const email = `e2e-${suffix}-${Date.now()}@example.com`;
    const password = 'correct-password';
    const user = await prisma.user.create({
      data: {
        full_name: `E2E ${suffix}`,
        ci: `${suffix}-${Date.now()}`,
        email,
        passwordHash: await bcrypt.hash(password, 4),
        roleName: UserRole.PHARMACIST,
        failed_attempts: 0,
        locked_until: null,
        last_failed_at: null,
        password_changed_at: null,
        active: true,
        deleted_at: null,
        last_login: null,
        reg_number: null,
      },
    });
    createdUserIds.push(user.id);
    return { id: user.id, email, password };
  }

  function extractCookie(setCookie: string | string[] | undefined): string {
    if (!setCookie) return '';
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return raw.split(';')[0];
  }

  it('AC1: valid credentials return access + refresh cookie with correct expiry', async () => {
    const user = await createUser('ac1');

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.expiresIn).toBe(8 * 3600);
    expect(res.body.user.email).toBe(user.email);
    const cookie = res.headers['set-cookie'] as string | string[];
    expect(cookie).toBeDefined();
    const first = Array.isArray(cookie) ? cookie[0] : cookie;
    expect(first).toMatch(/refresh=/);
    expect(first.toLowerCase()).toMatch(/httponly/);
    expect(first).toMatch(/samesite=lax/i);
    expect(first).toMatch(/path=\/auth/);
  });

  it('AC2: 5 failed attempts return 401, the 6th returns 422 (locked)', async () => {
    const user = await createUser('ac2');

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'WRONG' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(422);

    const fails = await prisma.auditLog.count({
      where: { user_id: user.id, event: 'LOGIN_FAIL' },
    });
    const locks = await prisma.auditLog.count({
      where: { user_id: user.id, event: 'LOGIN_LOCKED' },
    });
    expect(fails).toBe(5);
    expect(locks).toBeGreaterThanOrEqual(1);
  });

  it('AC3: every login attempt produces exactly one audit row (success or fail)', async () => {
    const user = await createUser('ac3');
    const successBefore = await prisma.auditLog.count({
      where: { user_id: user.id, event: 'LOGIN_SUCCESS' },
    });
    const failBefore = await prisma.auditLog.count({
      where: { user_id: user.id, event: 'LOGIN_FAIL' },
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'WRONG' })
      .expect(401);

    const successAfter = await prisma.auditLog.count({
      where: { user_id: user.id, event: 'LOGIN_SUCCESS' },
    });
    const failAfter = await prisma.auditLog.count({
      where: { user_id: user.id, event: 'LOGIN_FAIL' },
    });
    expect(successAfter).toBe(successBefore + 1);
    expect(failAfter).toBe(failBefore + 1);
  });

  it('refresh: rotates the cookie and rejects the previous refresh token', async () => {
    const user = await createUser('refresh');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    const oldCookie = extractCookie(login.headers['set-cookie']);

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(200);
    const newCookie = extractCookie(refreshed.headers['set-cookie']);
    expect(newCookie).not.toBe('');
    expect(newCookie).not.toBe(oldCookie);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(401);
  });

  it('logout: clears the cookie and revokes the refresh token', async () => {
    const user = await createUser('logout');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    const cookie = extractCookie(login.headers['set-cookie']);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('rejects malformed email', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400);
  });

  it('rejects unknown email with 401 (no enumeration)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'x' })
      .expect(401);
  });
});
