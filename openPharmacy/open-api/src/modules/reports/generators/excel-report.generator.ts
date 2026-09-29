import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { GeneratedReport, ReportAuditMetadata, ReportTable } from '../types';
import { formatCellText } from '../utils/report-format.util';
import { labelReportType } from '../utils/report-labels.util';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Renders a `ReportTable` to an .xlsx buffer. The audit block (who requested,
 * when, with which filters) is embedded at the top of the sheet so every export
 * carries its provenance, satisfying the "header/footer includes audit metadata"
 * acceptance criterion.
 */
@Injectable()
export class ExcelReportGenerator {
  async generate(
    table: ReportTable,
    meta: ReportAuditMetadata,
    fileName: string,
    pharmacyName?: string,
  ): Promise<GeneratedReport> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'openPharmacy';
    workbook.created = meta.generatedAt;

    const sheet = workbook.addWorksheet(this.sanitizeSheetName(table.title));
    const colCount = table.columns.length;

    // ── Audit / provenance header ────────────────────────────────────────────
    sheet.mergeCells(1, 1, 1, colCount);
    sheet.getCell(1, 1).value = pharmacyName || 'openPharmacy';
    sheet.getCell(1, 1).font = { bold: true, size: 16 };

    sheet.mergeCells(2, 1, 2, colCount);
    sheet.getCell(2, 1).value = table.subtitle
      ? `${table.title} — ${table.subtitle}`
      : table.title;
    sheet.getCell(2, 1).font = { bold: true, size: 12 };

    const metaLines = [
      `Solicitado por: ${meta.requestedBy}`,
      `Generado el: ${formatCellText(
        { key: 'g', label: 'g', format: 'datetime' },
        meta.generatedAt,
        meta.timezone,
      )} (${meta.timezone})`,
      `Tipo de reporte: ${labelReportType(meta.reportType)}`,
      `Filtros: ${meta.filtersSummary}`,
    ];
    metaLines.forEach((line, idx) => {
      const row = 4 + idx;
      sheet.mergeCells(row, 1, row, colCount);
      sheet.getCell(row, 1).value = line;
      sheet.getCell(row, 1).font = {
        italic: true,
        color: { argb: 'FF555555' },
      };
    });

    // ── Column headers ───────────────────────────────────────────────────────
    const headerRowNumber = 4 + metaLines.length + 1;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = table.columns.map((c) => c.label);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle' };
    });

    // ── Data rows ────────────────────────────────────────────────────────────
    for (const row of table.rows) {
      const values = table.columns.map((col) =>
        this.cellValue(col.format, row[col.key]),
      );
      const excelRow = sheet.addRow(values);
      table.columns.forEach((col, i) => {
        const cell = excelRow.getCell(i + 1);
        if (col.format === 'money') cell.numFmt = '#,##0.00';
        else if (col.format === 'number') cell.numFmt = '#,##0';
      });
    }

    // ── Totals ───────────────────────────────────────────────────────────────
    if (table.totals?.length) {
      sheet.addRow([]);
      for (const total of table.totals) {
        const labelRow = sheet.addRow([`${total.label}`]);
        labelRow.font = { bold: true };
        const valueCell = sheet.getCell(labelRow.number, 2);
        valueCell.value =
          typeof total.value === 'number' ? total.value : total.value;
        valueCell.font = { bold: true };
        if (typeof total.value === 'number') valueCell.numFmt = '#,##0.00';
      }
    }

    // ── Auto widths + freeze the header ──────────────────────────────────────
    table.columns.forEach((col, i) => {
      const column = sheet.getColumn(i + 1);
      let width = col.label.length + 2;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.text ? cell.text.length : 0;
        if (len > width) width = len;
      });
      column.width = Math.min(Math.max(width, 10), 48);
    });
    sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];

    // ── Footer on every printed page (audit metadata) ────────────────────────
    sheet.headerFooter.evenFooter = `&L${pharmacyName || 'openPharmacy'}&C${labelReportType(meta.reportType)} · ${meta.requestedBy}&R${meta.generatedAt.toISOString()}`;
    sheet.headerFooter.oddFooter = sheet.headerFooter.evenFooter;

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    return {
      buffer,
      fileName,
      contentType: XLSX_CONTENT_TYPE,
      sizeBytes: buffer.byteLength,
    };
  }

  private cellValue(format: string | undefined, value: unknown): unknown {
    if (value === null || value === undefined) return '';
    if (format === 'money' || format === 'number') return Number(value);
    return value;
  }

  private sanitizeSheetName(name: string): string {
    return name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Report';
  }
}
