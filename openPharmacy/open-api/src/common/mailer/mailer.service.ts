import { Injectable, Logger } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';

export interface WelcomeMailPayload {
  email: string;
  fullName: string;
  tempPassword: string;
  changePasswordUrl: string;
}

export interface PasswordResetPayload {
  email: string;
  fullName: string;
  resetUrl: string;
}

export interface ReportReadyPayload {
  email: string;
  fullName: string;
  reportType: string;
  fileName: string;
  downloadUrl: string;
}

export interface ReportFailedPayload {
  email: string;
  fullName: string;
  reportType: string;
  reason: string;
}

/**
 * Human-readable Spanish labels for each report type, so the customer-facing
 * email never shows a raw enum value like `SALES_SUMMARY`. Falls back to the
 * raw value if an unknown type is ever passed.
 */
const REPORT_TYPE_LABELS_ES: Record<string, string> = {
  SALES_SUMMARY: 'Resumen de Ventas',
  SALES_DETAIL: 'Detalle de Ventas',
  INVENTORY_MOVEMENTS: 'Movimientos de Inventario',
  STOCK_SNAPSHOT: 'Snapshot de Inventario',
  EXPIRY: 'Vencimientos de Lotes',
  PURCHASES: 'Compras',
  RETURNS: 'Devoluciones y Anulaciones',
};

function reportTypeLabelEs(reportType: string): string {
  return REPORT_TYPE_LABELS_ES[reportType] ?? reportType;
}

/**
 * Thin wrapper around the NestJS mailer that hides template names and keeps
 * callers type-safe.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly mailer: NestMailerService) {}

  async sendWelcome(payload: WelcomeMailPayload): Promise<void> {
    await this.mailer.sendMail({
      to: payload.email,
      subject: 'Welcome to openPharmacy',
      template: 'welcome',
      context: {
        fullName: payload.fullName,
        tempPassword: payload.tempPassword,
        changePasswordUrl: payload.changePasswordUrl,
      },
    });
  }

  async sendPasswordReset(payload: PasswordResetPayload): Promise<void> {
    await this.mailer.sendMail({
      to: payload.email,
      subject: 'Reset your openPharmacy password',
      template: 'reset-password',
      context: {
        fullName: payload.fullName,
        resetUrl: payload.resetUrl,
      },
    });
  }

  async sendReportReady(payload: ReportReadyPayload): Promise<void> {
    const label = reportTypeLabelEs(payload.reportType);
    await this.mailer.sendMail({
      to: payload.email,
      subject: `Su reporte de ${label} está listo`,
      html: this.reportReadyHtml(payload, label),
    });
    this.logger.log(`Report-ready email queued for ${payload.email}`);
  }

  async sendReportFailed(payload: ReportFailedPayload): Promise<void> {
    const label = reportTypeLabelEs(payload.reportType);
    await this.mailer.sendMail({
      to: payload.email,
      subject: `No se pudo generar su reporte de ${label}`,
      html: this.reportFailedHtml(payload, label),
    });
    this.logger.log(`Report-failed email queued for ${payload.email}`);
  }

  private reportReadyHtml(p: ReportReadyPayload, label: string): string {
    return `<p>Hola ${p.fullName},</p>
<p>Su reporte de <strong>${label}</strong> se ha generado correctamente.</p>
<p>Archivo: ${p.fileName}</p>
<p><a href="${p.downloadUrl}">Descargar mi reporte</a></p>
<p>Este enlace estará disponible hasta que finalice el periodo de retención del reporte.</p>`;
  }

  private reportFailedHtml(p: ReportFailedPayload, label: string): string {
    return `<p>Hola ${p.fullName},</p>
<p>No fue posible generar su reporte de <strong>${label}</strong>.</p>
<p>Motivo: ${p.reason}</p>
<p>Por favor inténtelo de nuevo o contacte a un administrador si el problema persiste.</p>`;
  }
}
