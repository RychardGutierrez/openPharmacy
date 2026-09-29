import {
  MovementType,
  ProductCategory,
  ReportFormat,
  ReportType,
} from '@prisma/client';
import { ReportGroupBy, ReportView } from './dto/preview-report.dto';

/**
 * Presentation-agnostic shape for every report. The Excel and PDF generators
 * both consume a `ReportTable`, so adding a new report type only requires a
 * new query in `ReportDataRepository` — no changes to the export layer.
 */
export interface ReportColumn {
  key: string;
  label: string;
  format?: 'text' | 'number' | 'money' | 'date' | 'datetime';
}

export type ReportRow = Record<string, unknown>;

export interface ReportTotals {
  label: string;
  value: number | string;
}

export interface ReportTable {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: ReportTotals[];
}

export interface PaginatedReportPreview extends ReportTable {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  estimatedRows: number;
  isLargeReport: boolean;
}

/** User-supplied report parameters. Persisted verbatim in `report_jobs.filters`. */
export interface ReportFilters {
  from?: string;
  to?: string;
  timezone?: string;
  productId?: string;
  lotId?: string;
  movementType?: MovementType;
  category?: ProductCategory;
  groupBy?: ReportGroupBy;
  view?: ReportView;
  userId?: string;
  supplierId?: string;
  status?: string;
  horizonDays?: number;
}

/** A `[startUtc, endUtc)` window derived from local calendar dates + timezone. */
export interface ResolvedDateRange {
  startUtc: Date;
  endUtc: Date;
  timezone: string;
}

export interface ReportRequester {
  id: string;
  name: string;
  email: string;
}

/** Metadata embedded in every exported file header/footer (AC: audit trail). */
export interface ReportAuditMetadata {
  reportType: ReportType;
  requestedBy: string;
  generatedAt: Date;
  timezone: string;
  filtersSummary: string;
}

export interface GeneratedReport {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** Payload pushed to the SSE stream and used for email notifications. */
export interface ReportSseEvent {
  jobId: string;
  requestedBy: string;
  reportType: ReportType;
  format: ReportFormat;
  status: 'COMPLETED' | 'FAILED';
  fileName?: string;
  downloadUrl?: string;
  errorMessage?: string;
  completedAt: string;
}
