/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
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

describeDb('LotsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const createdLotIds: string[] = [];
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
      for (const id of createdLotIds) {
        await prisma.lot.deleteMany({ where: { id } });
      }
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
    const email = `e2e-lot-${suffix}-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const user = await prisma.user.create({
      data: {
        full_name: `E2E Lot ${suffix}`,
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

  async function createProduct(token: string) {
    const suffix = `${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dciName: 'Paracetamol',
        commercialName: `LotTestProduct ${suffix}`,
        laboratory: 'PharmaCo',
        form: 'Tablet',
        concentration: '500mg',
        barcode: suffix,
        category: 'OTC',
        salePrice: 12.5,
        costPrice: 8.0,
        minStock: 10,
      })
      .expect(201);
    createdProductIds.push(res.body.id);
    return res.body.id as string;
  }

  async function createLot(
    token: string,
    productId: string,
    overrides: { lotNumber?: string; expiryDate?: string; initialQty?: number },
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/lots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        lotNumber: overrides.lotNumber ?? `LOT-${Date.now()}`,
        expiryDate:
          overrides.expiryDate ?? new Date().toISOString().split('T')[0],
        initialQty: overrides.initialQty ?? 100,
      })
      .expect(201);
    createdLotIds.push(res.body.id);
    return res.body;
  }

  it('AC1: create a lot and retrieve by product', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac1');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    const lot = await createLot(token, productId, {
      lotNumber: `AC1-${Date.now()}`,
      expiryDate: '2030-12-31',
      initialQty: 50,
    });

    expect(lot.productId).toBe(productId);
    expect(lot.lotNumber).toContain('AC1');
    expect(lot.currentQty).toBe(50);

    const list = await request(app.getHttpServer())
      .get(`/api/lots/product/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body).toBeInstanceOf(Array);
    expect(list.body.some((l: { id: string }) => l.id === lot.id)).toBe(true);
  });

  it('AC1b: list all lots with pagination', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac1b');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    await createLot(token, productId, {
      lotNumber: `PAGE-${Date.now()}`,
      expiryDate: '2030-12-31',
      initialQty: 10,
    });

    const res = await request(app.getHttpServer())
      .get('/api/lots?page=1&pageSize=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 20);
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('AC2: FEFO deducts from the nearest expiry lot', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac2');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    const nearLot = await createLot(token, productId, {
      lotNumber: `NEAR-${Date.now()}`,
      expiryDate: '2026-09-01',
      initialQty: 20,
    });
    const farLot = await createLot(token, productId, {
      lotNumber: `FAR-${Date.now()}`,
      expiryDate: '2030-12-31',
      initialQty: 100,
    });

    const deduct = await request(app.getHttpServer())
      .post('/api/lots/fefo/deduct')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 15 })
      .expect(200);

    expect(deduct.body.success).toBe(true);
    expect(deduct.body.lotsUsed).toBeInstanceOf(Array);
    expect(deduct.body.lotsUsed.length).toBe(1);
    expect(deduct.body.lotsUsed[0].lotId).toBe(nearLot.id);
    expect(deduct.body.lotsUsed[0].deductedQty).toBe(15);

    const nearRefreshed = await prisma.lot.findUnique({
      where: { id: nearLot.id },
    });
    expect(nearRefreshed?.current_qty).toBe(5);

    const farRefreshed = await prisma.lot.findUnique({
      where: { id: farLot.id },
    });
    expect(farRefreshed?.current_qty).toBe(100);
  });

  it('AC3: FEFO spans multiple lots when one is insufficient', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac3');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    const lotA = await createLot(token, productId, {
      lotNumber: `A-${Date.now()}`,
      expiryDate: '2026-08-01',
      initialQty: 10,
    });
    const lotB = await createLot(token, productId, {
      lotNumber: `B-${Date.now()}`,
      expiryDate: '2026-09-01',
      initialQty: 30,
    });

    const deduct = await request(app.getHttpServer())
      .post('/api/lots/fefo/deduct')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 25 })
      .expect(200);

    expect(deduct.body.success).toBe(true);
    expect(deduct.body.lotsUsed.length).toBe(2);
    const aAllocation = deduct.body.lotsUsed.find(
      (x: { lotId: string }) => x.lotId === lotA.id,
    );
    const bAllocation = deduct.body.lotsUsed.find(
      (x: { lotId: string }) => x.lotId === lotB.id,
    );
    expect(aAllocation.deductedQty).toBe(10);
    expect(bAllocation.deductedQty).toBe(15);
  });

  it('AC4: FEFO rejects deduction when total stock is insufficient', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac4');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    await createLot(token, productId, {
      lotNumber: `LOW-${Date.now()}`,
      expiryDate: '2030-12-31',
      initialQty: 5,
    });

    const res = await request(app.getHttpServer())
      .post('/api/lots/fefo/deduct')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 10 })
      .expect(409);

    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('AC5: FEFO rejects deduction when all available lots are expired', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac5');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    const lot = await createLot(token, productId, {
      lotNumber: `EXP-${Date.now()}`,
      expiryDate: '2030-12-31',
      initialQty: 100,
    });

    // Back-date the lot in the database to simulate an expired lot.
    await prisma.lot.update({
      where: { id: lot.id },
      data: { expiry_date: new Date('2020-01-01') },
    });

    const res = await request(app.getHttpServer())
      .post('/api/lots/fefo/deduct')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 10 })
      .expect(409);

    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('AC6: void removes a zero-stock lot with no history', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac6');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    const lot = await createLot(token, productId, {
      lotNumber: `VOID-${Date.now()}`,
      expiryDate: '2030-12-31',
      initialQty: 0,
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/lots/${lot.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Created during e2e cleanup test' })
      .expect(200);

    expect(res.body.voidedAt).toBeTruthy();
    expect(res.body.voidReason).toBe('Created during e2e cleanup test');
  });

  it('AC7: expiry dashboard classifies lots correctly', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac7');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    // Ensure at least one RED (≤30 days) lot.
    const redDate = new Date();
    redDate.setUTCDate(redDate.getUTCDate() + 7);
    const redIso = redDate.toISOString().split('T')[0];

    await createLot(token, productId, {
      lotNumber: `RED-${Date.now()}`,
      expiryDate: redIso,
      initialQty: 10,
    });

    const dash = await request(app.getHttpServer())
      .get('/api/lots/expiry-dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dash.body.red.count + dash.body.orange.count).toBeGreaterThanOrEqual(
      1,
    );
    expect(dash.body.green.count).toBeGreaterThanOrEqual(0);
    expect(dash.body.red.lots).toBeInstanceOf(Array);
  });

  it('AC8: GET /api/lots/:id returns the lot', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac8');
    const token = await login(pharm.email, pharm.password);
    const productId = await createProduct(token);

    const lot = await createLot(token, productId, {
      lotNumber: `GET-${Date.now()}`,
      expiryDate: '2030-12-31',
      initialQty: 25,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/lots/${lot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe(lot.id);
    expect(res.body.lotNumber).toBe(lot.lotNumber);
    expect(res.body.currentQty).toBe(25);
  });

  it('AC9: GET /api/lots/:id returns 404 for missing lot', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac9');
    const token = await login(pharm.email, pharm.password);

    const res = await request(app.getHttpServer())
      .get('/api/lots/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.code).toBe('LOT_NOT_FOUND');
  });
});
