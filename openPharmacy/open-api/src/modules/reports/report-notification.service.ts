import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { UserRole } from '@prisma/client';
import { MailerService } from '../../common/mailer/mailer.service';
import { REPORT_EVENTS } from './report-events.token';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ReportSseEvent } from './types';
import { createSignedDownloadToken } from './utils/report-link.util';

/**
 * Fan-out for completed / failed report jobs.
 *
 * SSE events are pushed to a single in-process `Subject`, but each subscriber
 * receives only its own jobs (administrators see all), so one user can never be
 * notified about another user's report. Email is sent alongside the SSE event as
 * the durable second channel required by the ticket.
 */
@Injectable()
export class ReportNotificationService {
  private readonly logger = new Logger(ReportNotificationService.name);

  constructor(
    @Inject(REPORT_EVENTS) private readonly events: Subject<ReportSseEvent>,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  publish(event: ReportSseEvent): void {
    this.events.next(event);
  }

  /** User-scoped SSE stream. Admins receive every job; others only their own. */
  forUser(user: AuthenticatedUser): Observable<MessageEvent> {
    return this.events.asObservable().pipe(
      filter(
        (event) =>
          user.role === UserRole.ADMIN || event.requestedBy === user.id,
      ),
      map((event) => {
        const type =
          event.status === 'COMPLETED' ? 'report.completed' : 'report.failed';
        return { type, data: JSON.stringify(event) } as unknown as MessageEvent;
      }),
    );
  }

  /**
   * Builds the link embedded in the report email. It points at the public,
   * `@Public()` signed-download route under `/api` (same-origin to the app, so it
   * works from any computer as long as `reports.downloadBaseUrl` is the real host)
   * and carries an HMAC token — it does NOT rely on the in-memory access token,
   * which a browser navigation cannot provide.
   */
  downloadUrl(jobId: string): string {
    const base = this.config
      .get<string>('reports.downloadBaseUrl', '')
      .replace(/\/$/, '');
    const secret = this.config.get<string>('reports.downloadSecret', '');
    const ttlMin = this.config.get<number>('reports.downloadTtlMin', 10080);
    const token = createSignedDownloadToken(jobId, secret, ttlMin * 60 * 1000);
    return `${base}/api/reports/d/${token}`;
  }

  async notify(
    event: ReportSseEvent,
    recipient: { email: string; fullName: string },
  ): Promise<void> {
    // SSE is best-effort and immediate; email failure must never fail the job.
    try {
      if (event.status === 'COMPLETED') {
        await this.mailer.sendReportReady({
          email: recipient.email,
          fullName: recipient.fullName,
          reportType: event.reportType,
          fileName: event.fileName ?? event.reportType,
          downloadUrl: event.downloadUrl ?? this.downloadUrl(event.jobId),
        });
      } else {
        await this.mailer.sendReportFailed({
          email: recipient.email,
          fullName: recipient.fullName,
          reportType: event.reportType,
          reason: event.errorMessage ?? 'Unknown error',
        });
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to email report notification for ${event.jobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
