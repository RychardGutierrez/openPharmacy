import {
  MailerService,
  ReportFailedPayload,
  ReportReadyPayload,
} from './mailer.service';

interface SentMail {
  to: string;
  subject: string;
  html: string;
}

function buildMailer() {
  const sent: SentMail[] = [];
  const sendMail = jest.fn((msg: SentMail) => {
    sent.push(msg);
    return Promise.resolve({ messageId: 'x' });
  });
  const service = new MailerService({
    sendMail,
  } as unknown as ConstructorParameters<typeof MailerService>[0]);
  return { service, sent };
}

describe('MailerService report emails (Spanish)', () => {
  it('sends a Spanish "ready" email with a translated report label', async () => {
    const { service, sent } = buildMailer();
    const payload: ReportReadyPayload = {
      email: 'cliente@example.com',
      fullName: 'Ana',
      reportType: 'SALES_SUMMARY',
      fileName: 'sales_summary_20260101.xlsx',
      downloadUrl: 'http://localhost:4200/reports/job-1/download',
    };
    await service.sendReportReady(payload);

    const mail = sent[0];
    expect(mail.to).toBe('cliente@example.com');
    expect(mail.subject).toBe('Su reporte de Resumen de Ventas está listo');
    expect(mail.html).toContain('Hola Ana');
    expect(mail.html).toContain('se ha generado correctamente');
    expect(mail.html).toContain('Descargar mi reporte');
    expect(mail.html).toContain('Resumen de Ventas');
    // must not leak the raw enum value into a customer-facing email
    expect(mail.html).not.toContain('SALES_SUMMARY');
    expect(mail.subject).not.toContain('SALES_SUMMARY');
  });

  it('sends a Spanish "failed" email and falls back for unknown types', async () => {
    const { service, sent } = buildMailer();
    const payload: ReportFailedPayload = {
      email: 'cliente@example.com',
      fullName: 'Beto',
      reportType: 'SOMETHING_NEW',
      reason: 'sin datos',
    };
    await service.sendReportFailed(payload);

    const mail = sent[0];
    expect(mail.subject).toContain('No se pudo generar su reporte');
    expect(mail.html).toContain('No fue posible generar su reporte');
    expect(mail.html).toContain('Motivo: sin datos');
    // unknown enum falls back to the raw value (no crash), known ones translate
    expect(mail.subject).toContain('SOMETHING_NEW');
  });
});
