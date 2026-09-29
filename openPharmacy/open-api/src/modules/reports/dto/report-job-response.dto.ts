import { ApiProperty } from '@nestjs/swagger';
import { ReportFormat, ReportJobStatus, ReportType } from '@prisma/client';

/**
 * Projection of a `report_jobs` row. Intentionally narrower than the Prisma
 * model so both full rows and list rows (where `result_data` is omitted) can be
 * mapped through the same function.
 */
export interface ReportJobView {
  id: string;
  reportType: ReportType;
  format: ReportFormat;
  status: ReportJobStatus;
  timezone: string;
  requested_by: string;
  filters: unknown;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  expires_at: Date | null;
  file_name: string | null;
  size_bytes: number | null;
  error_code: string | null;
  error_message: string | null;
  requester?: { full_name: string };
}

/** Public representation of a `report_jobs` row (never exposes raw bytes). */
export class ReportJobResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ReportType }) reportType!: ReportType;
  @ApiProperty({ enum: ReportFormat }) format!: ReportFormat;
  @ApiProperty({ enum: ReportJobStatus }) status!: ReportJobStatus;
  @ApiProperty() timezone!: string;
  @ApiProperty() requestedBy!: string;
  @ApiProperty({ type: Object }) filters!: Record<string, unknown>;
  @ApiProperty() requestedAt!: Date;
  @ApiProperty({ nullable: true }) startedAt!: Date | null;
  @ApiProperty({ nullable: true }) completedAt!: Date | null;
  @ApiProperty({ nullable: true }) expiresAt!: Date | null;
  @ApiProperty({ nullable: true }) fileName!: string | null;
  @ApiProperty({ nullable: true }) sizeBytes!: number | null;
  @ApiProperty({ nullable: true }) errorCode!: string | null;
  @ApiProperty({ nullable: true }) errorMessage!: string | null;

  static fromJob(job: ReportJobView): ReportJobResponseDto {
    const dto = new ReportJobResponseDto();
    dto.id = job.id;
    dto.reportType = job.reportType;
    dto.format = job.format;
    dto.status = job.status;
    dto.timezone = job.timezone;
    dto.requestedBy = job.requester?.full_name ?? job.requested_by;
    dto.filters = (job.filters ?? {}) as Record<string, unknown>;
    dto.requestedAt = job.requested_at;
    dto.startedAt = job.started_at;
    dto.completedAt = job.completed_at;
    dto.expiresAt = job.expires_at;
    dto.fileName = job.file_name;
    dto.sizeBytes = job.size_bytes;
    dto.errorCode = job.error_code;
    dto.errorMessage = job.error_message;
    return dto;
  }
}
