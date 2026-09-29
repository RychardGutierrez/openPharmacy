import { BadRequestException, GoneException } from '@nestjs/common';
import {
  ReportFormat,
  ReportJobStatus,
  ReportType,
  UserRole,
} from '@prisma/client';
import { ReportsService } from './reports.service';
import { ClaimedJob } from './repositories/report-jobs.repository';
import { createSignedDownloadToken } from './utils/report-link.util';
import { GeneratedReport, ReportTable } from './types';

const table: ReportTable = {
  title: 'Sales Summary',
  columns: [{ key: 'a', label: 'A' }],
  rows: [{ a: 1 }],
};

const fakeFile = (name = 'report.xlsx'): GeneratedReport => ({
  buffer: Buffer.from('content'),
  fileName: name,
  contentType: 'application/vnd.x',
  sizeBytes: 7,
});

const CONFIG: Record<string, unknown> = {
  'reports.maxRangeDays': 366,
  'reports.syncThreshold': 10,
  'reports.maxRows': 1000,
  'reports.maxFileBytes': 15 * 1024 * 1024,
  'reports.fileTtlDays': 7,
  'reports.defaultTimezone': 'America/Bogota',
  'reports.downloadSecret': 'spec-download-secret',
};

function build(overrides: { estimate?: number } = {}) {
  const config = { get: jest.fn((k: string, d: unknown) => CONFIG[k] ?? d) };
  const pharmacyConfig = {
    getPharmacyInfo: jest.fn().mockResolvedValue({ PHARMACY_NAME: 'Ph' }),
  };
  const data = {
    estimateRows: jest.fn().mockResolvedValue(overrides.estimate ?? 5),
    run: jest.fn().mockResolvedValue(table),
  };
  const jobs = {
    createCompleted: jest
      .fn()
      .mockResolvedValue({ id: 'job-1', requested_by: 'admin-1' }),
    enqueue: jest
      .fn()
      .mockResolvedValue({ id: 'job-2', requested_by: 'admin-1' }),
    findById: jest.fn(),
    loadDownload: jest.fn(),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    releaseForRetry: jest.fn().mockResolvedValue(undefined),
  };
  const excel = { generate: jest.fn().mockResolvedValue(fakeFile()) };
  const pdf = { generate: jest.fn().mockResolvedValue(fakeFile('report.pdf')) };
  const notifications = {
    downloadUrl: jest.fn().mockReturnValue('http://fe/reports/job-9/download'),
    publish: jest.fn(),
    notify: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { create: jest.fn().mockResolvedValue(undefined) };

  const service = new ReportsService(
    config as never,
    pharmacyConfig as never,
    data as never,
    jobs as never,
    excel as never,
    pdf as never,
    notifications as never,
    audit as never,
  );
  return { service, config, data, jobs, excel, pdf, notifications, audit };
}

const admin = {
  id: 'admin-1',
  role: UserRole.ADMIN,
  fullName: 'Ada Admin',
  email: 'ada@example.com',
};
const pharmacist = {
  id: 'ph-1',
  role: UserRole.PHARMACIST,
  fullName: 'Pat Pharmacist',
  email: 'pat@example.com',
};

const baseDto = {
  reportType: ReportType.SALES_SUMMARY,
  format: ReportFormat.XLSX,
  from: '2026-01-01',
  to: '2026-01-31',
};

describe('ReportsService.create', () => {
  it('generates small reports synchronously and persists a completed job', async () => {
    const { service, jobs, excel, audit, data } = build({ estimate: 5 });
    const result = await service.create(admin, baseDto);
    expect(result.mode).toBe('sync');
    expect(result.mode === 'sync' && result.file.fileName).toBe('report.xlsx');
    expect(data.estimateRows).toHaveBeenCalled();
    expect(excel.generate).toHaveBeenCalled();
    expect(jobs.createCompleted).toHaveBeenCalledTimes(1);
    expect(jobs.enqueue).not.toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'REPORT_GENERATED' }),
    );
  });

  it('routes reports above the threshold through the queue', async () => {
    const { service, jobs, excel, audit } = build({ estimate: 50 });
    const result = await service.create(admin, baseDto);
    expect(result.mode).toBe('queued');
    expect(excel.generate).not.toHaveBeenCalled();
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'REPORT_REQUESTED' }),
    );
  });

  it('rejects reports that exceed the max row cap', async () => {
    const { service } = build({ estimate: 5000 });
    await expect(service.create(admin, baseDto as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an over-long date range before touching the database', async () => {
    const { service, data } = build();
    await expect(
      service.create(admin, {
        ...baseDto,
        from: '2019-01-01',
        to: '2026-01-01',
      }),
    ).rejects.toThrow(/INVALID_REPORT_RANGE|exceeds/);
    expect(data.estimateRows).not.toHaveBeenCalled();
  });
});

describe('ReportsService.download', () => {
  const completed = {
    id: 'job-1',
    status: ReportJobStatus.COMPLETED,
    file_name: 'report.xlsx',
    content_type: 'application/vnd.x',
    result_data: new Uint8Array([1, 2, 3]),
    requested_by: 'ph-1',
    expires_at: new Date(Date.now() + 86400000),
  };

  it('lets an owner download their completed report', async () => {
    const { service, jobs, audit } = build();
    jobs.loadDownload.mockResolvedValue(completed);
    const file = await service.download(pharmacist, 'job-1');
    expect(file.fileName).toBe('report.xlsx');
    expect(file.buffer).toEqual(Buffer.from([1, 2, 3]));
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'REPORT_DOWNLOADED' }),
    );
  });

  it('lets an admin download any report', async () => {
    const { service, jobs } = build();
    jobs.loadDownload.mockResolvedValue(completed);
    await expect(service.download(admin, 'job-1')).resolves.toBeDefined();
  });

  it('hides other users reports behind a 404', async () => {
    const { service, jobs } = build();
    jobs.loadDownload.mockResolvedValue({
      ...completed,
      requested_by: 'someone-else',
    });
    await expect(service.download(pharmacist, 'job-1')).rejects.toThrow(
      /not found/i,
    );
  });

  it('refuses to download a not-yet-ready job', async () => {
    const { service, jobs } = build();
    jobs.loadDownload.mockResolvedValue({
      ...completed,
      status: ReportJobStatus.QUEUED,
    });
    await expect(service.download(pharmacist, 'job-1')).rejects.toThrow(
      GoneException,
    );
  });

  it('refuses expired files', async () => {
    const { service, jobs } = build();
    jobs.loadDownload.mockResolvedValue({
      ...completed,
      expires_at: new Date(Date.now() - 1000),
    });
    await expect(service.download(pharmacist, 'job-1')).rejects.toThrow(
      /retention/i,
    );
  });

  it('serves a completed report through a valid signed email token', async () => {
    const { service, jobs, audit } = build();
    jobs.loadDownload.mockResolvedValue(completed);
    const token = createSignedDownloadToken(
      '2f1c9a34-7b6d-4e2a-9c1f-0a5d3e8b7c61',
      'spec-download-secret',
      60_000,
    );
    const file = await service.downloadByToken(token);
    expect(file.fileName).toBe('report.xlsx');
    // actor recorded is the report owner (no session on a link click)
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'ph-1', event: 'REPORT_DOWNLOADED' }),
    );
  });

  it('rejects a token signed with the wrong secret', async () => {
    const { service } = build();
    const forged = createSignedDownloadToken(
      '2f1c9a34-7b6d-4e2a-9c1f-0a5d3e8b7c61',
      'wrong-secret',
      60_000,
    );
    await expect(service.downloadByToken(forged)).rejects.toThrow(
      /download link/i,
    );
  });

  it('rejects an expired signed token', async () => {
    const { service } = build();
    const token = createSignedDownloadToken(
      '2f1c9a34-7b6d-4e2a-9c1f-0a5d3e8b7c61',
      'spec-download-secret',
      -1000,
    );
    await expect(service.downloadByToken(token)).rejects.toThrow(
      /download link/i,
    );
  });
});

describe('ReportsService.executeJob (queue worker)', () => {
  const claimed = (over: Partial<ClaimedJob> = {}): ClaimedJob => ({
    id: 'job-9',
    requested_by: 'ph-1',
    reportType: ReportType.SALES_SUMMARY,
    format: ReportFormat.XLSX,
    filters: { from: '2026-01-01', to: '2026-01-31' },
    timezone: 'America/Bogota',
    attempts: 1,
    max_attempts: 3,
    requester: { full_name: 'Pat Pharmacist', email: 'pat@example.com' },
    ...over,
  });

  it('completes a job and notifies via SSE + email', async () => {
    const { service, jobs, notifications, audit } = build();
    await service.executeJob(claimed());
    expect(jobs.markCompleted).toHaveBeenCalledTimes(1);
    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-9', status: 'COMPLETED' }),
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'REPORT_GENERATED' }),
    );
  });

  it('re-queues when retries remain, without notifying', async () => {
    const { service, jobs, data, notifications } = build();
    data.run.mockRejectedValueOnce(new Error('boom'));
    await service.executeJob(claimed({ attempts: 1, max_attempts: 3 }));
    expect(jobs.releaseForRetry).toHaveBeenCalledWith('job-9', 'boom');
    expect(jobs.markFailed).not.toHaveBeenCalled();
    expect(notifications.publish).not.toHaveBeenCalled();
  });

  it('fails terminally and notifies once retries are exhausted', async () => {
    const { service, jobs, notifications, audit, data } = build();
    data.run.mockRejectedValueOnce(new Error('boom'));
    await service.executeJob(claimed({ attempts: 3, max_attempts: 3 }));
    expect(jobs.markFailed).toHaveBeenCalledWith(
      'job-9',
      'REPORT_GENERATION_FAILED',
      'boom',
    );
    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' }),
    );
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'REPORT_FAILED' }),
    );
  });
});

describe('ReportsService.preview', () => {
  const bigTable: ReportTable = {
    title: 'Sales Detail',
    columns: [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ],
    rows: [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
      { a: 5, b: 6 },
    ],
  };

  it('returns a paginated slice with preview metadata', async () => {
    const { service, data } = build({ estimate: 3 });
    data.run.mockResolvedValue(bigTable);
    const result = await service.preview(admin, {
      ...baseDto,
      page: 2,
      pageSize: 2,
    });
    expect(result.rows).toEqual([{ a: 5, b: 6 }]);
    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.estimatedRows).toBe(3);
    expect(result.isLargeReport).toBe(false);
    expect(data.run).toHaveBeenCalledWith(
      ReportType.SALES_SUMMARY,
      expect.objectContaining({ timezone: 'America/Bogota' }),
      expect.anything(),
    );
  });

  it('flags large reports for the async banner', async () => {
    const { service } = build({ estimate: 50 });
    const result = await service.preview(admin, baseDto);
    expect(result.isLargeReport).toBe(true);
    expect(result.estimatedRows).toBe(50);
  });

  it('rejects an over-long range before querying', async () => {
    const { service, data } = build();
    await expect(
      service.preview(admin, {
        ...baseDto,
        from: '2019-01-01',
        to: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(data.estimateRows).not.toHaveBeenCalled();
    expect(data.run).not.toHaveBeenCalled();
  });
});
