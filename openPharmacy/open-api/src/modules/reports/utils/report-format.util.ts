import {
  ReportColumn,
  ReportFilters,
  ReportRow,
  ReportTable,
  ResolvedDateRange,
} from '../types';
import { formatDateInZone, formatInZone } from './report-date.util';
import { labelMovementType, labelProductCategory } from './report-labels.util';

const moneyFormatter = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('es-BO');

/** Safely coerces a primitive cell value to text without object stringification. */
function asText(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    default:
      return value instanceof Date ? value.toISOString() : '';
  }
}

/** Renders a cell as a display string (used by the PDF/HTML and audit summary). */
export function formatCellText(
  column: ReportColumn,
  value: unknown,
  timezone: string,
): string {
  if (value === null || value === undefined) return '';
  switch (column.format) {
    case 'money':
      return moneyFormatter.format(Number(value));
    case 'number':
      return numberFormatter.format(Number(value));
    case 'date':
      return value instanceof Date
        ? formatDateInZone(value, timezone)
        : asText(value);
    case 'datetime':
      return value instanceof Date
        ? formatInZone(value, timezone)
        : asText(value);
    default:
      return asText(value);
  }
}

/** Turns the raw stored filter object into a single human-readable line. */
export function buildFiltersSummary(
  filters: ReportFilters,
  range: ResolvedDateRange,
  reportType: string,
): string {
  const parts: string[] = [];
  const snapshotTypes = new Set(['STOCK_SNAPSHOT', 'EXPIRY']);
  if (snapshotTypes.has(reportType)) {
    parts.push(`A la fecha ${formatInZone(new Date(), range.timezone)}`);
    if (filters.horizonDays)
      parts.push(`Horizonte: ${filters.horizonDays} días`);
  } else {
    parts.push(
      `Período: ${formatDateInZone(range.startUtc, range.timezone)} → ${formatDateInZone(
        new Date(range.endUtc.getTime() - 1),
        range.timezone,
      )}`,
    );
  }
  if (filters.category)
    parts.push(`Categoría: ${labelProductCategory(filters.category)}`);
  if (filters.productId) parts.push(`Producto: ${filters.productId}`);
  if (filters.lotId) parts.push(`Lote: ${filters.lotId}`);
  if (filters.movementType)
    parts.push(`Movimiento: ${labelMovementType(filters.movementType)}`);
  if (filters.userId) parts.push(`Usuario: ${filters.userId}`);
  if (filters.supplierId) parts.push(`Proveedor: ${filters.supplierId}`);
  parts.push(`Zona horaria: ${range.timezone}`);
  return parts.join(' · ');
}

export function tableToPlainText(table: ReportTable, timezone: string): string {
  const header = table.columns.map((c) => c.label).join(' | ');
  const lines = table.rows.map((row: ReportRow) =>
    table.columns
      .map((c) => formatCellText(c, row[c.key], timezone))
      .join(' | '),
  );
  return [header, ...lines].join('\n');
}
