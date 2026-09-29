import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync } from 'node:fs';
import type { Browser } from 'puppeteer-core';
import { GeneratedReport, ReportAuditMetadata, ReportTable } from '../types';
import { formatCellText } from '../utils/report-format.util';
import { labelReportType } from '../utils/report-labels.util';

const PDF_CONTENT_TYPE = 'application/pdf';

/**
 * Well-known desktop install locations. `@sparticuz/chromium` only ships a
 * Linux binary, so on Windows/macOS we must use the locally installed
 * browser instead of asking sparticuz for a path that does not exist.
 */
function windowsCandidates(env: NodeJS.ProcessEnv): string[] {
  const programFiles = env['PROGRAMFILES'] ?? 'C:\\Program Files';
  const programFilesX86 = env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
  const localAppData = env['LOCALAPPDATA'] ?? '';
  return [
    `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
    `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
    `${programFiles}\\Chromium\\Application\\chrome.exe`,
    `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ...(localAppData
      ? [`${localAppData}\\Google\\Chrome\\Application\\chrome.exe`]
      : []),
  ];
}

const DARWIN_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

const LINUX_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

export interface ChromiumResolution {
  executablePath: string;
  args: string[];
}

/**
 * Pure, unit-testable resolution order for a Chromium executable:
 * explicit `PUPPETEER_EXECUTABLE_PATH` → well-known OS install paths.
 * Returns `null` when nothing usable is found locally; the caller then falls
 * back to `@sparticuz/chromium` (Linux-only) or fails with a clear error.
 */
export function findLocalChromium(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
): ChromiumResolution | null {
  const explicit = env['PUPPETEER_EXECUTABLE_PATH']?.trim();
  if (explicit) {
    return exists(explicit)
      ? { executablePath: explicit, args: ['--no-sandbox'] }
      : null;
  }
  const candidates =
    platform === 'win32'
      ? windowsCandidates(env)
      : platform === 'darwin'
        ? DARWIN_CANDIDATES
        : LINUX_CANDIDATES;
  for (const candidate of candidates) {
    if (exists(candidate)) {
      return { executablePath: candidate, args: ['--no-sandbox'] };
    }
  }
  return null;
}

function pdfUnavailable(message: string): ServiceUnavailableException {
  return new ServiceUnavailableException({
    statusCode: 503,
    code: 'PDF_ENGINE_UNAVAILABLE',
    message,
  });
}

/** Escapes a value for safe interpolation into the generated HTML. */
function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a `ReportTable` to PDF via headless Chromium (HTML → PDF).
 *
 * Browser resolution order: `PUPPETEER_EXECUTABLE_PATH` → well-known desktop
 * install paths → `@sparticuz/chromium` (Linux/serverless only). `sparticuz`
 * does not ship a Windows or macOS binary, so it is never consulted there —
 * that was the cause of `spawn .../Temp/chromium ENOENT` on dev machines.
 * `buildReportHtml` is pure and independently testable; only `generate`
 * touches the browser. Engine failures surface as a typed 503
 * (`PDF_ENGINE_UNAVAILABLE`) instead of a raw 500.
 */
@Injectable()
export class PdfReportGenerator {
  private readonly logger = new Logger(PdfReportGenerator.name);

  buildReportHtml(
    table: ReportTable,
    meta: ReportAuditMetadata,
    pharmacyName?: string,
  ): string {
    const headers = table.columns
      .map((c) => `<th class="col-${c.format ?? 'text'}">${esc(c.label)}</th>`)
      .join('');

    const bodyRows = table.rows
      .map(
        (row) =>
          `<tr>${table.columns
            .map(
              (c) =>
                `<td class="col-${c.format ?? 'text'}">${esc(
                  formatCellText(c, row[c.key], meta.timezone),
                )}</td>`,
            )
            .join('')}</tr>`,
      )
      .join('');

    const totalsHtml = table.totals?.length
      ? `<div class="totals">${table.totals
          .map(
            (t) =>
              `<div class="total"><span>${esc(t.label)}</span><strong>${esc(
                t.value,
              )}</strong></div>`,
          )
          .join('')}</div>`
      : '';

    const generatedAt = formatCellText(
      { key: 'g', label: 'g', format: 'datetime' },
      meta.generatedAt,
      meta.timezone,
    );

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(table.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1a1a; margin: 32px; font-size: 11px; }
  .pharmacy { font-size: 18px; font-weight: 700; color: #1f4e79; margin: 0; }
  .title { font-size: 15px; font-weight: 700; margin: 2px 0 10px; }
  .meta { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; background: #f7f9fc; }
  .meta div { margin: 2px 0; }
  .meta .label { color: #666; display: inline-block; min-width: 110px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  th { background: #1f4e79; color: #fff; font-weight: 600; position: sticky; top: 0; }
  td.col-money, td.col-number, th.col-money, th.col-number { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .totals { margin-top: 14px; text-align: right; }
  .totals .total { margin: 3px 0; }
  .totals .total span { color: #555; margin-right: 8px; }
  .empty { text-align: center; color: #888; padding: 24px; }
</style>
</head>
<body>
  <p class="pharmacy">${esc(pharmacyName || 'openPharmacy')}</p>
  <p class="title">${esc(table.title)}${table.subtitle ? ` — ${esc(table.subtitle)}` : ''}</p>
  <div class="meta">
    <div><span class="label">Tipo de reporte:</span>${esc(labelReportType(meta.reportType))}</div>
    <div><span class="label">Solicitado por:</span>${esc(meta.requestedBy)}</div>
    <div><span class="label">Generado el:</span>${esc(generatedAt)} (${esc(meta.timezone)})</div>
    <div><span class="label">Filtros:</span>${esc(meta.filtersSummary)}</div>
  </div>
  ${
    table.rows.length
      ? `<table><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>${totalsHtml}`
      : `<div class="empty">Sin registros para los filtros seleccionados.</div>${totalsHtml}`
  }
</body>
</html>`;
  }

  async generate(
    table: ReportTable,
    meta: ReportAuditMetadata,
    fileName: string,
    pharmacyName?: string,
  ): Promise<GeneratedReport> {
    const html = this.buildReportHtml(table, meta, pharmacyName);
    const generatedAt = meta.generatedAt.toISOString();

    // Imported lazily: puppeteer-core is pure ESM, so a static import would
    // break the compiled CommonJS output (and the ts-jest sandbox). Real
    // Node resolves dynamic import() fine in both dev and prod.
    const puppeteer = (await import('puppeteer-core')).default;

    const explicit = process.env['PUPPETEER_EXECUTABLE_PATH']?.trim();
    if (explicit && !existsSync(explicit)) {
      throw pdfUnavailable(
        `PUPPETEER_EXECUTABLE_PATH points to a file that does not exist: ${explicit}. Install Chrome/Chromium or fix the path.`,
      );
    }

    const resolution = findLocalChromium();
    let executablePath: string;
    let args: string[];
    if (resolution) {
      ({ executablePath, args } = resolution);
    } else if (process.platform === 'linux') {
      const sparticuz = (await import('@sparticuz/chromium')).default;
      executablePath = await sparticuz.executablePath();
      args = sparticuz.args;
    } else {
      throw pdfUnavailable(
        'No Chromium executable found. Install Google Chrome (or Chromium/Edge) or set PUPPETEER_EXECUTABLE_PATH to its binary.',
      );
    }

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath,
        args,
        headless: true,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: table.columns.length > 7,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `<div style="font-size:8px;color:#888;width:100%;padding:0 32px;display:flex;justify-content:space-between;">
            <span>${esc(pharmacyName || 'openPharmacy')} · ${esc(labelReportType(meta.reportType))}</span>
            <span>${esc(meta.requestedBy)} · ${esc(generatedAt)}</span>
          </div>`,
      });
      const buffer = Buffer.from(pdf);
      return {
        buffer,
        fileName,
        contentType: PDF_CONTENT_TYPE,
        sizeBytes: buffer.byteLength,
      };
    } catch (error: unknown) {
      this.logger.error(
        `PDF generation failed with ${executablePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw pdfUnavailable(
        'PDF generation failed. Verify a compatible Chrome/Chromium is installed or set PUPPETEER_EXECUTABLE_PATH.',
      );
    } finally {
      if (browser) {
        await browser.close().catch((err: unknown) => {
          this.logger.warn(`Failed to close Chromium: ${String(err)}`);
        });
      }
    }
  }
}
