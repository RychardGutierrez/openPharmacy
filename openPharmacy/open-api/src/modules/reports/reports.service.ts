import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService as EnvConfigService } from '@nestjs/config';
import {
  ReportFormat,
  ReportJobStatus,
  ReportType,
  UserRole,
  type ReportJob,
} from '@prisma/client';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { ConfigService as PharmacyConfigService } from '../config/config.service';
import type { RequestMetadata } from '../users/users.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportListQueryDto } from './dto/report-list-query.dto';
import { ReportJobResponseDto } from './dto/report-job-response.dto';
import { PreviewReportDto } from './dto/preview-report.dto';
import { ExcelReportGenerator } from './generators/excel-report.generator';
import { PdfReportGenerator } from './generators/pdf-report.generator';
import { ReportNotificationService } from './report-notification.service';
import { ReportDataRepository } from './repositories/report-data.repository';
import {
  ClaimedJob,
  ReportJobsRepository,
} from './repositories/report-jobs.repository';
import {
  GeneratedReport,
  ReportAuditMetadata,
  ReportFilters,
  ReportSseEvent,
  ResolvedDateRange,
} from './types';
import { buildFiltersSummary } from './utils/report-format.util';
import { formatDateInZone, resolveDateRange } from './utils/report-date.util';
import { verifySignedDownloadToken } from './utils/report-link.util';

type JobWithRequester = ReportJob & {
  requester?: { full_name: string };
};

export type CreateReportResult =
  | { mode: 'sync'; job: JobWithRequester; file: GeneratedReport }
  | { mode: 'queued'; job: JobWithRequester };

const EXTENSION: Record<ReportFormat, string> = {
  [ReportFormat.XLSX]: 'xlsx',
  [ReportFormat.PDF]: 'pdf',
};

/**
 * Reporting orchestration. Owns the sync-vs-async decision, delegates the
 * read-only data assembly to `ReportDataRepository`, the rendering to the Excel
 * / PDF generators, and the durable queue to `ReportJobsRepository`. The same
 * `generateFile` path is reused by the queue worker so small and large reports
 * produce byte-identical output.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly config: EnvConfigService,
    private readonly pharmacyConfig: PharmacyConfigService,
    private readonly data: ReportDataRepository,
    private readonly jobs: ReportJobsRepository,
    private readonly excel: ExcelReportGenerator,
    private readonly pdf: PdfReportGenerator,
    private readonly notifications: ReportNotificationService,
    private readonly audit: AuditLogRepository,
  ) {}

  private get maxRangeDays(): number {
    return this.config.get<number>('reports.maxRangeDays', 366);
  }
  private get syncThreshold(): number {
    return this.config.get<number>('reports.syncThreshold', 2000);
  }
  private get maxRows(): number {
    return this.config.get<number>('reports.maxRows', 200000);
  }
  private get maxFileBytes(): number {
    return this.config.get<number>('reports.maxFileBytes', 15 * 1024 * 1024);
  }
  private get fileTtlDays(): number {
    return this.config.get<number>('reports.fileTtlDays', 7);
  }
  private get defaultTimezone(): string {
    return this.config.get<string>('reports.defaultTimezone', 'America/La_Paz');
  }

  private toFilters(dto: CreateReportDto): ReportFilters {
    return {
      from: dto.from,
      to: dto.to,
      timezone: dto.timezone ?? this.defaultTimezone,
      productId: dto.productId,
      lotId: dto.lotId,
      movementType: dto.movementType,
      category: dto.category,
      groupBy: dto.groupBy,
      view: dto.view,
      userId: dto.userId,
      supplierId: dto.supplierId,
      horizonDays: dto.horizonDays,
    };
  }

  async preview(user: AuthenticatedUser, dto: PreviewReportDto) {
    void user;
    const filters: ReportFilters = {
      from: dto.from,
      to: dto.to,
      timezone: dto.timezone ?? this.defaultTimezone,
      category: dto.category,
      groupBy: dto.groupBy,
      view: dto.view,
      productId: dto.productId,
      lotId: dto.lotId,
      movementType: dto.movementType,
      userId: dto.userId,
      supplierId: dto.supplierId,
      horizonDays: dto.horizonDays,
    };
    const range = this.resolveRange(filters);
    const estimatedRows = await this.data.estimateRows(
      dto.reportType,
      range,
      filters,
    );
    const table = await this.data.run(
      dto.reportType,
      {
        ...filters,
        timezone: range.timezone,
      },
      range,
    );
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const total = table.rows.length;
    const start = (page - 1) * pageSize;
    return {
      ...table,
      rows: table.rows.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      estimatedRows,
      isLargeReport: estimatedRows > this.syncThreshold,
    };
  }

  private resolveRange(filters: ReportFilters): ResolvedDateRange {
    const timezone = filters.timezone ?? this.defaultTimezone;
    try {
      return resolveDateRange(filters, timezone, this.maxRangeDays);
    } catch (error: unknown) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_REPORT_RANGE',
        message:
          error instanceof Error ? error.message : 'Invalid report date range',
      });
    }
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateReportDto,
    meta?: RequestMetadata,
  ): Promise<CreateReportResult> {
    const filters = this.toFilters(dto);
    const range = this.resolveRange(filters);
    const estimated = await this.data.estimateRows(
      dto.reportType,
      range,
      filters,
    );

    if (estimated > this.maxRows) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'REPORT_TOO_LARGE',
        message: `Report matches ${estimated} rows which exceeds the ${this.maxRows} row limit. Narrow the date range or filters.`,
      });
    }

    const input = {
      requestedBy: user.id,
      reportType: dto.reportType,
      format: dto.format,
      filters,
      timezone: range.timezone,
    };

    if (estimated <= this.syncThreshold) {
      const file = await this.generateFile(
        dto.reportType,
        dto.format,
        filters,
        range,
        this.requesterLabel(user),
      );
      const job = await this.jobs.createCompleted(
        input,
        this.persistable(file),
      );
      await this.audit.create({
        userId: user.id,
        event: 'REPORT_GENERATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: {
          jobId: job.id,
          reportType: dto.reportType,
          format: dto.format,
          mode: 'sync',
          estimatedRows: estimated,
          sizeBytes: file.sizeBytes,
        },
      });
      return { mode: 'sync', job, file };
    }

    const job = await this.jobs.enqueue(input);
    await this.audit.create({
      userId: user.id,
      event: 'REPORT_REQUESTED',
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      metadata: {
        jobId: job.id,
        reportType: dto.reportType,
        format: dto.format,
        mode: 'queued',
        estimatedRows: estimated,
      },
    });
    return { mode: 'queued', job };
  }

  /**
   * Processes a claimed queue job to completion (or a terminal failure). Called
   * by the worker; never throws so the poll loop stays alive — errors are
   * recorded on the job and surfaced via SSE/email.
   */
  async executeJob(job: ClaimedJob): Promise<void> {
    const requester = `${job.requester.full_name} <${job.requester.email}>`;
    try {
      const range = this.resolveRange({
        ...job.filters,
        timezone: job.timezone,
      });
      const file = await this.generateFile(
        job.reportType,
        job.format,
        job.filters,
        range,
        requester,
      );
      await this.jobs.markCompleted(job.id, this.persistable(file));
      await this.audit.create({
        userId: job.requested_by,
        event: 'REPORT_GENERATED',
        metadata: {
          jobId: job.id,
          reportType: job.reportType,
          format: job.format,
          mode: 'async',
          sizeBytes: file.sizeBytes,
        },
      });
      const event: ReportSseEvent = {
        jobId: job.id,
        requestedBy: job.requested_by,
        reportType: job.reportType,
        format: job.format,
        status: 'COMPLETED',
        fileName: file.fileName,
        downloadUrl: this.notifications.downloadUrl(job.id),
        completedAt: new Date().toISOString(),
      };
      this.notifications.publish(event);
      await this.notifications.notify(event, {
        email: job.requester.email,
        fullName: job.requester.full_name,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const terminal = job.attempts >= job.max_attempts;
      if (terminal) {
        await this.jobs.markFailed(job.id, 'REPORT_GENERATION_FAILED', message);
        await this.audit.create({
          userId: job.requested_by,
          event: 'REPORT_FAILED',
          metadata: { jobId: job.id, reportType: job.reportType, message },
        });
        const event: ReportSseEvent = {
          jobId: job.id,
          requestedBy: job.requested_by,
          reportType: job.reportType,
          format: job.format,
          status: 'FAILED',
          errorMessage: message,
          completedAt: new Date().toISOString(),
        };
        this.notifications.publish(event);
        await this.notifications.notify(event, {
          email: job.requester.email,
          fullName: job.requester.full_name,
        });
      } else {
        await this.jobs.releaseForRetry(job.id, message);
        this.logger.warn(
          `Report ${job.id} attempt ${job.attempts}/${job.max_attempts} failed, re-queued: ${message}`,
        );
      }
    }
  }

  async list(
    user: AuthenticatedUser,
    query: ReportListQueryDto,
  ): Promise<{
    data: ReportJobResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [rows, total] = await this.jobs.findMany({
      // Non-admins only ever see their own reports.
      requestedBy: user.role === UserRole.ADMIN ? undefined : user.id,
      reportType: query.reportType,
      status: query.status,
      page,
      pageSize,
    });
    return {
      data: rows.map((row) => ReportJobResponseDto.fromJob(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getStatus(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ReportJobResponseDto> {
    const job = await this.jobs.findById(id);
    if (!job) throw new NotFoundException('Report job not found');
    this.assertAccessible(user, job.requested_by);
    return ReportJobResponseDto.fromJob(job);
  }

  async download(
    user: AuthenticatedUser,
    id: string,
    meta?: RequestMetadata,
  ): Promise<GeneratedReport> {
    const job = await this.jobs.loadDownload(id);
    if (!job) throw new NotFoundException('Report job not found');
    this.assertAccessible(user, job.requested_by);
    return this.finalizeDownload(job, user.id, meta);
  }

  /**
   * Email-link download. Authenticates by verifying the HMAC token (which is
   * bound to this single job and self-expires) instead of a Bearer header, so the
   * link works from any computer. Ownership is implicit in possession of the
   * signed token; the audit row records the report's own requester as the actor.
   */
  async downloadByToken(
    token: string,
    meta?: RequestMetadata,
  ): Promise<GeneratedReport> {
    const secret = this.config.get<string>('reports.downloadSecret', '');
    const verified = verifySignedDownloadToken(token, secret);
    if (!verified) {
      throw new NotFoundException('Invalid or expired download link');
    }
    const job = await this.jobs.loadDownload(verified.jobId);
    if (!job) throw new NotFoundException('Report job not found');
    return this.finalizeDownload(job, job.requested_by, meta);
  }

  /** Shared tail for both download paths: readiness + retention checks, audit, bytes. */
  private async finalizeDownload(
    job: NonNullable<Awaited<ReturnType<ReportJobsRepository['loadDownload']>>>,
    actorId: string,
    meta?: RequestMetadata,
  ): Promise<GeneratedReport> {
    if (job.status !== ReportJobStatus.COMPLETED) {
      throw new GoneException({
        statusCode: 410,
        code: 'REPORT_NOT_READY',
        message: `Report is ${job.status} and cannot be downloaded yet`,
      });
    }
    if (!job.result_data || !job.file_name || !job.content_type) {
      throw new GoneException({
        statusCode: 410,
        code: 'REPORT_FILE_UNAVAILABLE',
        message: 'The generated file is no longer available',
      });
    }
    if (job.expires_at && job.expires_at.getTime() < Date.now()) {
      throw new GoneException({
        statusCode: 410,
        code: 'REPORT_FILE_EXPIRED',
        message: 'The generated report has passed its retention window',
      });
    }

    await this.audit.create({
      userId: actorId,
      event: 'REPORT_DOWNLOADED',
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      metadata: { jobId: job.id, fileName: job.file_name },
    });

    const buffer = Buffer.from(job.result_data);
    return {
      buffer,
      fileName: job.file_name,
      contentType: job.content_type,
      sizeBytes: buffer.byteLength,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private assertAccessible(user: AuthenticatedUser, ownerId: string): void {
    if (user.role !== UserRole.ADMIN && user.id !== ownerId) {
      throw new NotFoundException('Report job not found');
    }
  }

  private requesterLabel(user: AuthenticatedUser): string {
    return `${user.fullName} <${user.email}>`;
  }

  /** Keeps oversized generated files out of BYTEA storage (download from memory only). */
  private persistable(file: GeneratedReport) {
    if (file.sizeBytes > this.maxFileBytes) {
      this.logger.warn(
        `Report ${file.fileName} is ${file.sizeBytes} bytes > max ${this.maxFileBytes}; not stored for re-download`,
      );
      return {
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        resultData: null,
        expiresAt: this.expiresAt(),
      };
    }
    return {
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      resultData: file.buffer,
      expiresAt: this.expiresAt(),
    };
  }

  private expiresAt(): Date {
    return new Date(Date.now() + this.fileTtlDays * 24 * 60 * 60 * 1000);
  }

  /** Builds the data table + audit metadata, then renders to the requested format. */
  private async generateFile(
    reportType: ReportType,
    format: ReportFormat,
    filters: ReportFilters,
    range: ResolvedDateRange,
    requestedBy: string,
  ): Promise<GeneratedReport> {
    // `range.timezone` is the sanitized IANA id; reuse it everywhere so the
    // snapshot/expiry queries never read a raw (possibly malformed) value.
    const table = await this.data.run(
      reportType,
      {
        ...filters,
        timezone: range.timezone,
      },
      range,
    );
    const pharmacyName = await this.pharmacyName();
    const generatedAt = new Date();
    const meta: ReportAuditMetadata = {
      reportType,
      requestedBy,
      generatedAt,
      timezone: range.timezone,
      filtersSummary: buildFiltersSummary(filters, range, reportType),
    };
    const fileName = this.buildFileName(
      reportType,
      format,
      generatedAt,
      range.timezone,
    );

    if (format === ReportFormat.PDF) {
      return this.pdf.generate(table, meta, fileName, pharmacyName);
    }
    return this.excel.generate(table, meta, fileName, pharmacyName);
  }

  private buildFileName(
    reportType: ReportType,
    format: ReportFormat,
    when: Date,
    timezone: string,
  ): string {
    const stamp = formatDateInZone(when, timezone).replace(/-/g, '');
    return `${reportType.toLowerCase()}_${stamp}.${EXTENSION[format]}`;
  }

  private async pharmacyName(): Promise<string | undefined> {
    try {
      const info = await this.pharmacyConfig.getPharmacyInfo();
      return info.PHARMACY_NAME;
    } catch {
      return undefined;
    }
  }
}
