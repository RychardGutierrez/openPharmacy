import { ReportType } from '@prisma/client';
import { ExcelReportGenerator } from './generators/excel-report.generator';
import {
  PdfReportGenerator,
  findLocalChromium,
} from './generators/pdf-report.generator';
import { ReportAuditMetadata, ReportTable } from './types';

const table: ReportTable = {
  title: 'Resumen de ventas',
  subtitle: 'agrupado por día',
  columns: [
    { key: 'day', label: 'Fecha', format: 'date' },
    { key: 'transactions', label: 'Transacciones', format: 'number' },
    { key: 'net', label: 'Total neto', format: 'money' },
  ],
  rows: [
    { day: '2026-01-01', transactions: 3, net: 1500.5 },
    { day: '2026-01-02', transactions: 1, net: 99.99 },
  ],
  totals: [{ label: 'Ingresos netos totales', value: 1600.49 }],
};

const meta: ReportAuditMetadata = {
  reportType: ReportType.SALES_SUMMARY,
  requestedBy: 'Ada Admin <ada@example.com>',
  generatedAt: new Date('2026-01-03T08:00:00.000Z'),
  timezone: 'America/Bogota',
  filtersSummary:
    'Período: 2026-01-01 → 2026-01-02 · Zona horaria: America/Bogota',
};

describe('ExcelReportGenerator', () => {
  it('produces a non-empty xlsx buffer with the right content type', async () => {
    const gen = new ExcelReportGenerator();
    const file = await gen.generate(table, meta, 'sales.xlsx', 'Test Pharmacy');
    expect(file.fileName).toBe('sales.xlsx');
    expect(file.contentType).toContain('spreadsheetml');
    expect(file.sizeBytes).toBeGreaterThan(0);
    expect(file.buffer.byteLength).toBe(file.sizeBytes);
    // XLSX files are ZIP archives: PK signature.
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK');
  });
});

describe('PdfReportGenerator (html, no browser)', () => {
  const gen = new PdfReportGenerator();

  it('builds audit metadata into the header', () => {
    const html = gen.buildReportHtml(table, meta, 'Test Pharmacy');
    expect(html).toContain('Resumen de ventas');
    expect(html).toContain('Ada Admin &lt;ada@example.com&gt;');
    expect(html).toContain('Tipo de reporte:');
    expect(html).toContain('Ventas');
    expect(html).not.toContain('SALES_SUMMARY');
    expect(html).toContain('Solicitado por:');
    expect(html).toContain('Período:');
    expect(html).toContain('Fecha');
    expect(html).toContain('Ingresos netos totales');
  });

  it('renders an empty-state message when there are no rows', () => {
    const html = gen.buildReportHtml({ ...table, rows: [] }, meta, 'Pharmacy');
    expect(html).toContain('Sin registros para los filtros seleccionados.');
  });
});

describe('findLocalChromium', () => {
  const existsYes = () => true;
  const existsNo = () => false;

  it('prefers an explicit PUPPETEER_EXECUTABLE_PATH that exists', () => {
    const found = findLocalChromium(
      'win32',
      {
        PUPPETEER_EXECUTABLE_PATH: 'C:\\custom\\chrome.exe',
      },
      existsYes,
    );
    expect(found).toEqual({
      executablePath: 'C:\\custom\\chrome.exe',
      args: ['--no-sandbox'],
    });
  });

  it('rejects an explicit path that does not exist', () => {
    expect(
      findLocalChromium(
        'win32',
        {
          PUPPETEER_EXECUTABLE_PATH: 'C:\\missing\\chrome.exe',
        },
        existsNo,
      ),
    ).toBeNull();
  });

  it('finds a Windows install path when no env var is set', () => {
    const seen: string[] = [];
    const found = findLocalChromium(
      'win32',
      { PROGRAMFILES: 'C:\\Program Files' },
      (p) => {
        seen.push(p);
        return p.endsWith('chrome.exe');
      },
    );
    expect(found?.executablePath).toContain('Google\\Chrome');
    expect(seen.length).toBeGreaterThan(0);
  });

  it('returns null when nothing is installed (caller falls back or 503s)', () => {
    expect(findLocalChromium('win32', {}, existsNo)).toBeNull();
    expect(findLocalChromium('darwin', {}, existsNo)).toBeNull();
    expect(findLocalChromium('linux', {}, existsNo)).toBeNull();
  });
});
