/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
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

describeDb('PurchaseOrdersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const createdPurchaseOrderIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdLotIds: string[] = [];
  let barcodeCounter = 0;

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
      await prisma.purchaseReceivingItem.deleteMany({
        where: { lot_id: { in: createdLotIds } },
      });
      await prisma.purchaseReceiving.deleteMany({
        where: { order_id: { in: createdPurchaseOrderIds } },
      });
      await prisma.orderItem.deleteMany({
        where: { order_id: { in: createdPurchaseOrderIds } },
      });
      await prisma.purchaseOrder.deleteMany({
        where: { id: { in: createdPurchaseOrderIds } },
      });
      await prisma.lot.deleteMany({ where: { id: { in: createdLotIds } } });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
      await prisma.supplier.deleteMany({
        where: { id: { in: createdSupplierIds } },
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

  async function createUser(role: UserRole, suffix: string) {
    const email = `e2e-po-${suffix}-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const user = await prisma.user.create({
      data: {
        full_name: `E2E PO ${suffix}`,
        ci: `po-${suffix}-${Date.now()}`,
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

  async function createSupplier(suffix: string) {
    const supplier = await prisma.supplier.create({
      data: {
        name: `E2E Supplier ${suffix}`,
        nit: `po-nit-${suffix}-${Date.now()}`,
        active: true,
      },
    });
    createdSupplierIds.push(supplier.id);
    return supplier;
  }

  async function createProduct(token: string, suffix: string) {
    barcodeCounter += 1;
    const barcode = `${Date.now()}${barcodeCounter}`.slice(-13);
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dciName: 'Paracetamol',
        commercialName: `E2E PO Product ${suffix}`,
        barcode,
        category: 'OTC',
        salePrice: 15,
        minSalePrice: 10,
        minStock: 5,
      })
      .expect(201);
    createdProductIds.push(res.body.id);
    return res.body;
  }

  it('AC1: pharmacist can create, submit and fully receive a purchase order', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac1');
    const token = await login(pharm.email, pharm.password);
    const supplier = await createSupplier('ac1');
    const product = await createProduct(token, 'ac1');

    const created = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId: supplier.id,
        orderDate: '2026-09-11',
        items: [
          {
            productId: product.id,
            qtyOrdered: 100,
            unitCost: 2.5,
          },
        ],
      })
      .expect(201);

    expect(created.body.status).toBe('PENDING');
    expect(created.body.items).toHaveLength(1);
    createdPurchaseOrderIds.push(created.body.id);

    const submitted = await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(submitted.body.status).toBe('ORDERED');

    const lotNumber = `E2E-LOT-${Date.now()}`;
    const received = await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${created.body.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceNumber: `INV-${Date.now()}`,
        invoiceDate: '2026-09-11',
        items: [
          {
            orderItemId: created.body.items[0].id,
            qtyReceived: 100,
            lotNumber,
            expiryDate: '2026-12-31',
            unitCost: 2.5,
          },
        ],
      })
      .expect(200);

    expect(received.body.status).toBe('RECEIVED');
    expect(received.body.lots).toHaveLength(1);
    expect(received.body.lots[0].qtyReceived).toBe(100);
    createdLotIds.push(received.body.lots[0].lotId);

    const lot = await prisma.lot.findUnique({
      where: { id: received.body.lots[0].lotId },
    });
    expect(lot).not.toBeNull();
    expect(lot!.current_qty).toBe(100);

    const movements = await prisma.inventoryMovement.findMany({
      where: { lot_id: received.body.lots[0].lotId },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].movementType).toBe('PURCHASE');
    expect(movements[0].quantity).toBe(100);
  });

  it('AC2: receiving more than ordered returns 400', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac2');
    const token = await login(pharm.email, pharm.password);
    const supplier = await createSupplier('ac2');
    const product = await createProduct(token, 'ac2');

    const created = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId: supplier.id,
        orderDate: '2026-09-11',
        items: [{ productId: product.id, qtyOrdered: 50, unitCost: 3 }],
      })
      .expect(201);
    createdPurchaseOrderIds.push(created.body.id);

    await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${created.body.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceNumber: `INV-${Date.now()}`,
        invoiceDate: '2026-09-11',
        items: [
          {
            orderItemId: created.body.items[0].id,
            qtyReceived: 100,
            lotNumber: `E2E-LOT-OVER-${Date.now()}`,
            expiryDate: '2026-12-31',
            unitCost: 3,
          },
        ],
      })
      .expect(400);

    expect(res.body.code).toBe('PURCHASE_ORDER_QTY_EXCEEDED');
  });

  it('AC3: partial receiving transitions order to PARTIAL', async () => {
    const pharm = await createUser(UserRole.PHARMACIST, 'ac3');
    const token = await login(pharm.email, pharm.password);
    const supplier = await createSupplier('ac3');
    const product = await createProduct(token, 'ac3');

    const created = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId: supplier.id,
        orderDate: '2026-09-11',
        items: [{ productId: product.id, qtyOrdered: 100, unitCost: 4 }],
      })
      .expect(201);
    createdPurchaseOrderIds.push(created.body.id);

    await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const lotNumber = `E2E-LOT-PARTIAL-${Date.now()}`;
    const received = await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${created.body.id}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceNumber: `INV-${Date.now()}`,
        invoiceDate: '2026-09-11',
        items: [
          {
            orderItemId: created.body.items[0].id,
            qtyReceived: 60,
            lotNumber,
            expiryDate: '2026-12-31',
            unitCost: 4,
          },
        ],
      })
      .expect(200);

    expect(received.body.status).toBe('PARTIAL');
    createdLotIds.push(received.body.lots[0].lotId);
  });
});
