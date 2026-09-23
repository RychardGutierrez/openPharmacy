/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
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

describeDb('SuppliersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const createdUserIds: string[] = [];
  let adminToken = '';
  let pharmToken = '';
  let cashierToken = '';

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

  async function createUser(role: UserRole, suffix: string) {
    const email = `e2e-sup-${suffix}-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const user = await prisma.user.create({
      data: {
        full_name: `E2E Supplier ${suffix}`,
        ci: `sup-${suffix}-${Date.now()}`,
        email,
        passwordHash,
        roleName: role,
        active: true,
        deleted_at: null,
        failed_attempts: 0,
        locked_until: null,
        last_failed_at: null,
        password_changed_at: null,
        last_login: null,
      },
    });
    createdUserIds.push(user.id);
    return { email, password: 'correct-password' };
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

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

    const admin = await createUser(UserRole.ADMIN, 'admin');
    const pharm = await createUser(UserRole.PHARMACIST, 'pharm');
    const cashier = await createUser(UserRole.CASHIER, 'cashier');
    adminToken = await login(admin.email, admin.password);
    pharmToken = await login(pharm.email, pharm.password);
    cashierToken = await login(cashier.email, cashier.password);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.supplier.deleteMany({
        where: { name: { startsWith: 'SUP-E2E' } },
      });
      await prisma.product.deleteMany({
        where: { commercial_name: { startsWith: 'SUP-E2E Product' } },
      });
      await prisma.auditLog.deleteMany({
        where: { user_id: { in: createdUserIds } },
      });
      for (const id of createdUserIds) {
        await prisma.refreshToken.deleteMany({ where: { user_id: id } });
        await prisma.user.deleteMany({ where: { id } });
      }
      await prisma.$disconnect();
    }
    if (app) await app.close();
    process.env = originalEnv;
  });

  function uniqueNit() {
    return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  it('creates a supplier and normalizes the NIT to digits only', async () => {
    const nit = uniqueNit();
    const res = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({
        name: 'SUP-E2E Acme Farma',
        nit: `${nit.slice(0, 3)}-${nit.slice(3)}`,
        city: 'La Paz',
      })
      .expect(201);

    expect(res.body.nit).toBe(nit);
    expect(res.body.active).toBe(true);
  });

  it('rejects a duplicate NIT with 409', async () => {
    const nit = uniqueNit();
    await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({ name: 'SUP-E2E First', nit })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({ name: 'SUP-E2E Duplicate', nit })
      .expect(409);

    expect(res.body.code).toBe('DUPLICATE_NIT');
  });

  it('rejects a non-numeric-only NIT after normalization (empty)', async () => {
    await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({ name: 'SUP-E2E NoDigits', nit: 'abc-def' })
      .expect(400);
  });

  it('soft-deletes a supplier: hidden from the active list but still retrievable by id', async () => {
    const nit = uniqueNit();
    const created = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SUP-E2E ToDeactivate', nit })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/suppliers/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const activeList = await request(app.getHttpServer())
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      activeList.body.some((s: { id: string }) => s.id === created.body.id),
    ).toBe(false);

    const byId = await request(app.getHttpServer())
      .get(`/api/suppliers/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(byId.body.active).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/suppliers/${created.body.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('denies a cashier access to supplier endpoints', async () => {
    await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'SUP-E2E Cashier', nit: uniqueNit() })
      .expect(403);
  });

  it('rejects a purchase order against a deactivated supplier', async () => {
    const nit = uniqueNit();
    const created = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({ name: 'SUP-E2E PO Target', nit })
      .expect(201);

    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({
        dciName: 'Paracetamol',
        commercialName: `SUP-E2E Product ${nit}`,
        barcode: nit.padEnd(13, '0').slice(0, 13),
        category: 'OTC',
        salePrice: 15,
        minSalePrice: 10,
        minStock: 5,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/suppliers/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${pharmToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({
        supplierId: created.body.id,
        orderDate: '2026-09-11',
        items: [
          { productId: productRes.body.id, qtyOrdered: 10, unitCost: 2.5 },
        ],
      })
      .expect(400);

    expect(res.body.code).toBe('SUPPLIER_INACTIVE');
  });
});
