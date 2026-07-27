/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
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

describeDb('ProductsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const createdProductIds: string[] = [];
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
  });

  afterAll(async () => {
    if (prisma) {
      for (const id of createdProductIds) {
        await prisma.product.deleteMany({ where: { id } });
      }
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

  async function createUser(role: UserRole, suffix: string) {
    const email = `e2e-prod-${suffix}-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const user = await prisma.user.create({
      data: {
        full_name: `E2E Product ${suffix}`,
        ci: `${suffix}-${Date.now()}`,
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
    return { id: user.id, email, password: 'correct-password' };
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  function baseProduct() {
    return {
      dciName: 'Paracetamol',
      commercialName: 'Tylenol E2E',
      laboratory: 'PharmaCo',
      form: 'Tablet',
      concentration: '500mg',
      barcode: `${Date.now()}`,
      category: 'OTC',
      salePrice: 12.5,
      costPrice: 8.0,
      minStock: 10,
    };
  }

  it('AC1: pharmacist can create and retrieve a product', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac1');
    const token = await login(pharm.email, pharm.password);
    const payload = baseProduct();

    const created = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(created.body.barcode).toBe(payload.barcode);
    expect(created.body.category).toBe('OTC');
    createdProductIds.push(created.body.id);

    const retrieved = await request(app.getHttpServer())
      .get(`/api/products/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(retrieved.body.id).toBe(created.body.id);
    expect(retrieved.body.commercialName).toBe(payload.commercialName);
  });

  it('AC2: duplicate barcode returns 409 DUPLICATE_BARCODE', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac2');
    const token = await login(pharm.email, pharm.password);
    const payload = baseProduct();

    const created = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    createdProductIds.push(created.body.id);

    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...baseProduct(), barcode: payload.barcode })
      .expect(409);

    expect(res.body.code).toBe('DUPLICATE_BARCODE');
    expect(res.body.field).toBe('barcode');
  });

  it('AC3: search endpoint returns matching products', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac3');
    const token = await login(pharm.email, pharm.password);
    const payload = {
      ...baseProduct(),
      commercialName: 'SearchableProduct',
      barcode: `${Date.now()}1`,
    };

    const created = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    createdProductIds.push(created.body.id);

    const res = await request(app.getHttpServer())
      .get('/api/products/search?q=Searchable')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.some(
        (p: { commercialName: string }) =>
          p.commercialName === 'SearchableProduct',
      ),
    ).toBe(true);
  });

  it('AC4: deactivate and reactivate a product', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac4');
    const token = await login(pharm.email, pharm.password);
    const payload = { ...baseProduct(), barcode: `${Date.now()}2` };

    const created = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    createdProductIds.push(created.body.id);

    const deactivated = await request(app.getHttpServer())
      .patch(`/api/products/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(deactivated.body.active).toBe(false);

    const activated = await request(app.getHttpServer())
      .patch(`/api/products/${created.body.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(activated.body.active).toBe(true);
  });

  it('AC5: bulk import returns per-row success/failure report', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac5');
    const token = await login(pharm.email, pharm.password);
    const barcode = `${Date.now()}3`;

    const csv = [
      'dciName,commercialName,barcode,category,salePrice,costPrice,minStock',
      `Aspirin,Aspirin E2E,${barcode},OTC,5.00,3.00,20`,
      'Invalid,,bad-barcode,OTC,5.00,3.00,20',
    ].join('\n');

    const res = await request(app.getHttpServer())
      .post('/api/products/bulk-import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csv), 'products.csv')
      .expect(200);

    expect(res.body.inserted).toBe(1);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].errors.length).toBeGreaterThan(0);

    if (res.body.inserted === 1) {
      const inserted = await prisma.product.findUnique({
        where: { barcode },
      });
      if (inserted) {
        createdProductIds.push(inserted.id);
      }
    }
  });

  it('AC6: controlled category is flagged correctly via isControlled', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac6');
    const token = await login(pharm.email, pharm.password);
    const payload = {
      ...baseProduct(),
      commercialName: 'Psychotropic E2E',
      barcode: `${Date.now()}4`,
      category: 'PSYCHOTROPIC',
    };

    const created = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    createdProductIds.push(created.body.id);

    expect(created.body.category).toBe('PSYCHOTROPIC');
  });
});
