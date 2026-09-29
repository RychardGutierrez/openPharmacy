import { ReportColumn, ResolvedDateRange } from '../types';
import { buildFiltersSummary, formatCellText } from './report-format.util';

const money: ReportColumn = { key: 'v', label: 'Value', format: 'money' };
const count: ReportColumn = { key: 'c', label: 'Count', format: 'number' };
const text: ReportColumn = { key: 't', label: 'Name' };

describe('report-format.util', () => {
  describe('formatCellText', () => {
    it('formats money with es-BO separators and 2 decimals', () => {
      expect(formatCellText(money, 1234.5, 'UTC')).toBe('1.234,50');
    });
    it('formats integers without decimals', () => {
      expect(formatCellText(count, 12345, 'UTC')).toBe('12.345');
    });
    it('renders empty string for null/undefined', () => {
      expect(formatCellText(text, null, 'UTC')).toBe('');
    });
    it('renders a Date in the requested timezone', () => {
      const col: ReportColumn = { key: 'd', label: 'Day', format: 'date' };
      expect(
        formatCellText(
          col,
          new Date('2026-01-01T05:00:00.000Z'),
          'America/Bogota',
        ),
      ).toBe('2026-01-01');
    });
  });

  describe('buildFiltersSummary', () => {
    const range: ResolvedDateRange = {
      startUtc: new Date('2026-01-01T00:00:00.000Z'),
      endUtc: new Date('2026-02-01T00:00:00.000Z'),
      timezone: 'UTC',
    };
    it('describes a period range for transactional reports', () => {
      const summary = buildFiltersSummary({}, range, 'SALES_SUMMARY');
      expect(summary).toContain('Período:');
      expect(summary).toContain('Zona horaria: UTC');
    });
    it('describes an as-of snapshot for stock reports', () => {
      const summary = buildFiltersSummary(
        { horizonDays: 90 },
        range,
        'STOCK_SNAPSHOT',
      );
      expect(summary).toContain('A la fecha');
      expect(summary).toContain('Horizonte: 90 días');
    });
    it('lists extra filters with translated labels', () => {
      const summary = buildFiltersSummary(
        { productId: 'p-1', movementType: 'SALE', category: 'OTC' },
        range,
        'INVENTORY_MOVEMENTS',
      );
      expect(summary).toContain('Producto: p-1');
      expect(summary).toContain('Movimiento: Venta');
      expect(summary).toContain('Categoría: Venta libre');
    });
  });
});
