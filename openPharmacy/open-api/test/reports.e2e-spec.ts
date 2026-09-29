/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ReportJobStatus, UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MailerService } from '../src/common/mailer/mailer.service';
import { ReportNotificationService } from '../src/modules/reports/report-notification.service';
import { ReportWorkerService } from '../src/modules/reports/report-worker.service';

const hasDatabase = !!process.env.DATABASE_URL;
const describeDb = hasDatabase ? describe : describe.skip;

const baseEnv = {
  NODE_ENV: 'test',
  COOKIE_SECRET: 'e2e-cookie-secret-32-chars-or-more-please',
  JWT_ACCESS_SECRET: 'e2e-access-secret-32-chars-or-more-please',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-32-chars-or-more-please',
  JWT_ACCESS_TTL: '8h',
  JWT_REFRESH_TTL: '7d',
  BCRYPT_SALT_ROUNDS: '4',
  THROTTLE_SHORT_LIMIT: '10000',
  THROTTLE_MEDIUM_LIMIT: '10000',
  THROTTLE_LONG_LIMIT: '10000',
  REPORT_WORKER_ENABLED: 'false',
  REPORT_DEFAULT_TIMEZONE: 'UTC',
};

describeDb('Reports (e2e)', () => {
  const originalEnv = process.env;
  let prisma: PrismaClient;
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdLotIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) {
      // Remove every report job owned by our users (bytes + queue rows) first,
      // since `report_jobs.requested_by` has a RESTRICT FK onto users.
      await prisma.reportJob.deleteMany({
        where: { requested_by: { in: createdUserIds } },
      });
      await prisma.inventoryMovement.deleteMany({
        where: { lot_id: { in: createdLotIds } },
      });
      await prisma.lot.deleteMany({ where: { id: { in: createdLotIds } } });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
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
    process.env = originalEnv;
  });

  async function boot(
    overrides: Record<string, string>,
  ): Promise<INestApplication> {
    process.env = { ...originalEnv, ...baseEnv, ...overrides };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ sendReportReady: jest.fn(), sendReportFailed: jest.fn() })
      .compile();
    const app = moduleFixture.createNestApplication();
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
    return app;
  }

  async function makeUser(role: UserRole, tag: string) {
    const email = `e2e-reports-${tag}-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        full_name: `E2E ${role} ${tag}`,
        ci: `rep-${tag}-${Date.now()}`,
        email,
        passwordHash: await bcrypt.hash('correct-password', 4),
        roleName: role,
        active: true,
      },
    });
    createdUserIds.push(user.id);
    return { id: user.id, email, password: 'correct-password' };
  }

  async function login(
    app: INestApplication,
    email: string,
    password: string,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  /**
   * Seeds a product + lot + two inventory movements dated Jan 2020 so that
   * `estimateRows(INVENTORY_MOVEMENTS)` is non-zero, forcing a queued (> 0
   * sync threshold) report through the async path in a nearly empty test DB.
   */
  async function seedMovements(userId: string): Promise<void> {
    const product = await prisma.product.create({
      data: {
        dci_name: 'Paracetamol',
        commercial_name: `E2E Report Product ${Date.now()}`,
        category: 'OTC',
        sale_price: 10,
        min_sale_price: 5,
        min_stock: 0,
        active: true,
      },
    });
    createdProductIds.push(product.id);
    const lot = await prisma.lot.create({
      data: {
        product_id: product.id,
        lot_number: `E2E-R-${Date.now()}`,
        expiry_date: new Date('2030-01-01'),
        initial_qty: 100,
        current_qty: 100,
        unit_cost: 5,
      },
    });
    createdLotIds.push(lot.id);
    await prisma.inventoryMovement.createMany({
      data: [
        {
          product_id: product.id,
          lot_id: lot.id,
          user_id: userId,
          movementType: 'PURCHASE',
          quantity: 100,
          created_at: new Date('2020-01-05T12:00:00Z'),
        },
        {
          product_id: product.id,
          lot_id: lot.id,
          user_id: userId,
          movementType: 'SALE',
          quantity: 3,
          created_at: new Date('2020-01-06T12:00:00Z'),
        },
      ],
    });
  }

  describe('synchronous generation (small reports)', () => {
    let app: INestApplication;
    let token: string;

    beforeAll(async () => {
      app = await boot({ REPORT_SYNC_THRESHOLD: '100000' });
      const admin = await makeUser(UserRole.ADMIN, 'sync');
      token = await login(app, admin.email, admin.password);
    });

    afterAll(async () => {
      if (app) await app.close();
    });

    it('returns the xlsx file inline and persists a completed job', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reportType: 'SALES_SUMMARY',
          format: 'XLSX',
          from: '2020-01-01',
          to: '2020-01-31',
        })
        .expect(200);

      expect(String(res.headers['content-type'])).toContain('spreadsheetml');
      expect(String(res.headers['content-disposition'])).toContain(
        'attachment',
      );
      const jobId = res.headers['x-report-job-id'];
      expect(jobId).toBeDefined();

      const job = await prisma.reportJob.findUnique({ where: { id: jobId } });
      expect(job!.status).toBe(ReportJobStatus.COMPLETED);
      expect(job!.result_data!.byteLength).toBeGreaterThan(0);
    });

    it('rejects an over-long date range with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reportType: 'SALES_SUMMARY',
          format: 'XLSX',
          from: '2000-01-01',
          to: '2026-01-01',
        })
        .expect(400);
    });

    it('forbids a cashier from generating reports', async () => {
      const cashier = await makeUser(UserRole.CASHIER, 'sync-cashier');
      const cashierToken = await login(app, cashier.email, cashier.password);
      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ reportType: 'SALES_SUMMARY', format: 'XLSX' })
        .expect(403);
    });
  });

  describe('queued generation + worker + notifications', () => {
    let app: INestApplication;
    let adminToken: string;

    beforeAll(async () => {
      app = await boot({
        REPORT_SYNC_THRESHOLD: '0',
        REPORT_DOWNLOAD_BASE_URL: 'https://farmacia.example',
        REPORT_DOWNLOAD_SECRET: 'e2e-download-secret',
      });
      const admin = await makeUser(UserRole.ADMIN, 'async');
      await seedMovements(admin.id);
      adminToken = await login(app, admin.email, admin.password);
    });

    afterAll(async () => {
      if (app) await app.close();
    });

    it('enqueues, drains via the worker, and makes the file downloadable', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportType: 'INVENTORY_MOVEMENTS',
          format: 'XLSX',
          from: '2020-01-01',
          to: '2020-01-31',
        })
        .expect(202);

      const jobId = res.body.id as string;
      expect(res.body.status).toBe('QUEUED');

      const worker = app.get(ReportWorkerService);
      expect(await worker.runOnce()).toBe(true);

      const status = await request(app.getHttpServer())
        .get(`/api/reports/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(status.body.status).toBe('COMPLETED');

      const dl = await request(app.getHttpServer())
        .get(`/api/reports/${jobId}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(String(dl.headers['content-type'])).toContain('spreadsheetml');

      const list = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body.total).toBeGreaterThanOrEqual(1);
      // bytes are never included in list projections
      expect(JSON.stringify(list.body)).not.toContain('result_data');
    });

    it('serves a completed report over the public signed link with NO auth header', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportType: 'INVENTORY_MOVEMENTS',
          format: 'XLSX',
          from: '2020-01-01',
          to: '2020-01-31',
        })
        .expect(202);
      const jobId = res.body.id as string;

      await app.get(ReportWorkerService).runOnce();

      const link = app.get(ReportNotificationService).downloadUrl(jobId);
      // host comes from config, not localhost, so a customer on another
      // computer can actually reach it
      expect(link.startsWith('https://farmacia.example/api/reports/d/')).toBe(
        true,
      );

      // fetch the path directly against the ephemeral test server, carrying no
      // Authorization header at all — exactly what an email click does.
      const path = new URL(link).pathname;
      const dl = await request(app.getHttpServer()).get(path).expect(200);
      expect(String(dl.headers['content-type'])).toContain('spreadsheetml');
      expect(String(dl.headers['content-disposition'])).toContain('attachment');

      // a tampered token (flipped final signature char) must be rejected
      const lastChar = path.slice(-1);
      const tampered = path.slice(0, -1) + (lastChar === 'A' ? 'B' : 'A');
      await request(app.getHttpServer()).get(tampered).expect(404);
    });

    it("hides one pharmacist's report from another and exposes it to an admin", async () => {
      const alice = await makeUser(UserRole.PHARMACIST, 'alice');
      const aliceToken = await login(app, alice.email, 'correct-password');
      const created = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          reportType: 'INVENTORY_MOVEMENTS',
          format: 'XLSX',
          from: '2020-01-01',
          to: '2020-01-31',
        })
        .expect(202);
      const jobId = created.body.id as string;

      const bob = await makeUser(UserRole.PHARMACIST, 'bob');
      const bobToken = await login(app, bob.email, 'correct-password');
      await request(app.getHttpServer())
        .get(`/api/reports/${jobId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/reports/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
