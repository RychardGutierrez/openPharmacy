/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
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

describeDb('InventoryMovementsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const createdProductIds: string[] = [];
  const createdLotIds: string[] = [];
  const createdAdjustmentIds: string[] = [];
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
      await prisma.inventoryMovement.deleteMany({
        where: { lot_id: { in: createdLotIds } },
      });
      await prisma.inventoryAdjustment.deleteMany({
        where: { id: { in: createdAdjustmentIds } },
      });
      for (const id of createdLotIds) {
        await prisma.lot.deleteMany({ where: { id } });
      }
      for (const id of createdProductIds) {
        await prisma.productPriceHistory.deleteMany({
          where: { product_id: id },
        });
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
    const email = `e2e-inv-${suffix}-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const user = await prisma.user.create({
      data: {
        full_name: `E2E Inventory ${suffix}`,
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
        commercialName: `InvTestProduct ${suffix}`,
        laboratory: 'PharmaCo',
        form: 'Tablet',
        concentration: '500mg',
        barcode: suffix,
        category: 'OTC',
        salePrice: 12.5,
        minSalePrice: 8.0,
        minStock: 10,
      })
      .expect(201);
    createdProductIds.push(res.body.id);
    return res.body.id as string;
  }

  async function createLot(token: string, productId: string, quantity: number) {
    const res = await request(app.getHttpServer())
      .post('/api/lots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        lotNumber: `INV-${Date.now()}`,
        expiryDate: '2030-12-31',
        initialQty: quantity,
        unitCost: 5,
      })
      .expect(201);
    createdLotIds.push(res.body.id);
    return res.body.id as string;
  }

  it('AC1: pharmacist can request an increase adjustment, admin approves it', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac1');
    const admin = await createUser(UserRole.ADMIN, 'ac1-admin');
    const pharmToken = await login(pharm.email, pharm.password);
    const adminToken = await login(admin.email, admin.password);
    const productId = await createProduct(pharmToken);
    const lotId = await createLot(pharmToken, productId, 10);

    const requestRes = await request(app.getHttpServer())
      .post('/api/inventory-movements/adjustments')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({
        productId,
        lotId,
        quantity: 5,
        direction: 'INCREASE',
        reason: 'Found extra units during physical inventory count',
      })
      .expect(201);

    createdAdjustmentIds.push(requestRes.body.id);
    expect(requestRes.body.status).toBe('PENDING');

    const lotBefore = await prisma.lot.findUnique({ where: { id: lotId } });
    expect(lotBefore?.current_qty).toBe(10);

    const approveRes = await request(app.getHttpServer())
      .post(
        `/api/inventory-movements/adjustments/${requestRes.body.id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(approveRes.body.adjustment.status).toBe('APPROVED');
    expect(approveRes.body.movement.movementType).toBe('MANUAL_ADJUSTMENT');
    expect(approveRes.body.movement.quantity).toBe(5);

    const lotAfter = await prisma.lot.findUnique({ where: { id: lotId } });
    expect(lotAfter?.current_qty).toBe(15);
  });

  it('AC2: decrease adjustment that would go negative is rejected before any write', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac2');
    const admin = await createUser(UserRole.ADMIN, 'ac2-admin');
    const pharmToken = await login(pharm.email, pharm.password);
    const adminToken = await login(admin.email, admin.password);
    const productId = await createProduct(pharmToken);
    const lotId = await createLot(pharmToken, productId, 3);

    const requestRes = await request(app.getHttpServer())
      .post('/api/inventory-movements/adjustments')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({
        productId,
        lotId,
        quantity: 5,
        direction: 'DECREASE',
        reason: 'Units damaged during storage handling',
      })
      .expect(201);

    createdAdjustmentIds.push(requestRes.body.id);

    const approveRes = await request(app.getHttpServer())
      .post(
        `/api/inventory-movements/adjustments/${requestRes.body.id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(approveRes.body.code).toBe('INSUFFICIENT_LOT_STOCK');

    const lotAfter = await prisma.lot.findUnique({ where: { id: lotId } });
    expect(lotAfter?.current_qty).toBe(3);

    const movements = await prisma.inventoryMovement.findMany({
      where: { lot_id: lotId },
    });
    expect(movements).toHaveLength(1); // only the initial PURCHASE movement
  });

  it('AC3: only admins can approve adjustments', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac3');
    const otherPharm = await createUser(UserRole.PHARMACIST, 'ac3-other');
    const pharmToken = await login(pharm.email, pharm.password);
    const otherToken = await login(otherPharm.email, otherPharm.password);
    const productId = await createProduct(pharmToken);
    const lotId = await createLot(pharmToken, productId, 10);

    const requestRes = await request(app.getHttpServer())
      .post('/api/inventory-movements/adjustments')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({
        productId,
        lotId,
        quantity: 2,
        direction: 'INCREASE',
        reason: 'Test role guard with sufficient detail',
      })
      .expect(201);

    createdAdjustmentIds.push(requestRes.body.id);

    await request(app.getHttpServer())
      .post(
        `/api/inventory-movements/adjustments/${requestRes.body.id}/approve`,
      )
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('AC4: self-approval is rejected', async () => {
    const admin = await createUser(UserRole.ADMIN, 'ac4');
    const adminToken = await login(admin.email, admin.password);
    const productId = await createProduct(adminToken);
    const lotId = await createLot(adminToken, productId, 10);

    const requestRes = await request(app.getHttpServer())
      .post('/api/inventory-movements/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId,
        lotId,
        quantity: 2,
        direction: 'INCREASE',
        reason: 'Self approval test with required length',
      })
      .expect(201);

    createdAdjustmentIds.push(requestRes.body.id);

    const approveRes = await request(app.getHttpServer())
      .post(
        `/api/inventory-movements/adjustments/${requestRes.body.id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(approveRes.body.code).toBe('ADJUSTMENT_SELF_APPROVAL');
  });

  it('AC5: listing movements includes the initial purchase and sale entries', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac5');
    const admin = await createUser(UserRole.ADMIN, 'ac5-admin');
    const pharmToken = await login(pharm.email, pharm.password);
    const adminToken = await login(admin.email, admin.password);
    const productId = await createProduct(pharmToken);
    const lotId = await createLot(pharmToken, productId, 20);

    const requestRes = await request(app.getHttpServer())
      .post('/api/inventory-movements/adjustments')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({
        productId,
        lotId,
        quantity: 5,
        direction: 'DECREASE',
        reason: 'Units damaged during storage handling',
      })
      .expect(201);

    createdAdjustmentIds.push(requestRes.body.id);

    await request(app.getHttpServer())
      .post(
        `/api/inventory-movements/adjustments/${requestRes.body.id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get(`/api/inventory-movements?lotId=${lotId}`)
      .set('Authorization', `Bearer ${pharmToken}`)
      .expect(200);

    expect(listRes.body.data).toHaveLength(2);
    const types = listRes.body.data.map(
      (m: { movementType: string }) => m.movementType,
    );
    expect(types).toContain('PURCHASE');
    expect(types).toContain('MANUAL_ADJUSTMENT');
  });
});
