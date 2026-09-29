import type { Request, Response } from 'express';
import { Subject } from 'rxjs';
import {
  ReportFormat,
  ReportJobStatus,
  ReportType,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { CreateReportDto } from './dto/create-report.dto';
import type { ReportNotificationService } from './report-notification.service';
import { ReportsController } from './reports.controller';
import type { ReportsService } from './reports.service';
import type { ReportSseEvent } from './types';

/** Minimal Express-Response stand-in capturing status/headers/body. */
class FakeResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body: unknown;
  jsonBody: Record<string, unknown> | undefined;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }
  set(headers: Record<string, string>): this {
    Object.assign(this.headers, headers);
    return this;
  }
  end(body?: unknown): this {
    this.body = body;
    return this;
  }
  json(body: Record<string, unknown>): this {
    this.jsonBody = body;
    return this;
  }
}

const user: AuthenticatedUser = {
  id: 'admin-1',
  role: UserRole.ADMIN,
  fullName: 'Ada',
  email: 'ada@example.com',
};
const request = {
  headers: {},
  ip: '10.0.0.1',
  socket: {},
} as unknown as Request;

const fullJob = {
  id: 'job-1',
  reportType: ReportType.SALES_SUMMARY,
  format: ReportFormat.XLSX,
  status: ReportJobStatus.QUEUED,
  timezone: 'America/Bogota',
  requested_by: 'admin-1',
  requester: { full_name: 'Ada' },
  filters: {},
  requested_at: new Date(),
  started_at: null,
  completed_at: null,
  expires_at: null,
  attempts: 0,
  max_attempts: 3,
  locked_until: null,
  worker_id: null,
  file_name: null,
  content_type: null,
  size_bytes: null,
  result_data: null,
  error_code: null,
  error_message: null,
};

function build(overrides: Record<string, unknown> = {}) {
  const service = {
    create: jest.fn(),
    list: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
    getStatus: jest.fn().mockResolvedValue({ id: 'job-1' }),
    download: jest.fn(),
    ...overrides,
  };
  const notifications = {
    forUser: jest.fn().mockReturnValue(new Subject<ReportSseEvent>()),
  };
  const controller = new ReportsController(
    service as unknown as ReportsService,
    notifications as unknown as ReportNotificationService,
  );
  return { controller, notifications };
}

const emptyDto = {} as CreateReportDto;

describe('ReportsController', () => {
  it('streams the synchronous file back with download headers', async () => {
    const buffer = Buffer.from('xlsx-bytes');
    const { controller } = build({
      create: jest.fn().mockResolvedValue({
        mode: 'sync',
        job: fullJob,
        file: {
          buffer,
          fileName: 'sales.xlsx',
          contentType: 'application/vnd.x',
          sizeBytes: buffer.length,
        },
      }),
    });
    const res = new FakeResponse();
    await controller.create(
      user,
      emptyDto,
      request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Disposition']).toContain('attachment');
    expect(res.body).toBe(buffer);
  });

  it('returns 202 with job metadata for a queued report', async () => {
    const { controller } = build({
      create: jest.fn().mockResolvedValue({ mode: 'queued', job: fullJob }),
    });
    const res = new FakeResponse();
    await controller.create(
      user,
      emptyDto,
      request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(202);
    expect(res.jsonBody).toMatchObject({ id: 'job-1', status: 'QUEUED' });
    expect(String(res.jsonBody?.message)).toMatch(/queued/i);
  });

  it('returns the file for a download request', async () => {
    const buffer = Buffer.from('bytes');
    const { controller } = build({
      download: jest.fn().mockResolvedValue({
        buffer,
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        sizeBytes: buffer.length,
      }),
    });
    const res = new FakeResponse();
    await controller.download(
      user,
      'job-1',
      request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.body).toBe(buffer);
  });

  it('exposes a user-scoped SSE stream', () => {
    const { controller, notifications } = build();
    const stream = controller.stream(user);
    expect(notifications.forUser).toHaveBeenCalledWith(user);
    expect(stream).toBeDefined();
  });
});
