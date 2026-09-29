import { Module } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AuditModule } from '../../common/audit/audit.module';
import { MailerModule } from '../../common/mailer/mailer.module';
import { ConfigModule as PharmacyConfigModule } from '../config/config.module';
import { ExcelReportGenerator } from './generators/excel-report.generator';
import { PdfReportGenerator } from './generators/pdf-report.generator';
import { REPORT_EVENTS } from './report-events.token';
import { ReportDownloadController } from './report-download.controller';
import { ReportNotificationService } from './report-notification.service';
import { ReportWorkerService } from './report-worker.service';
import { ReportDataRepository } from './repositories/report-data.repository';
import { ReportJobsRepository } from './repositories/report-jobs.repository';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportSseEvent } from './types';

@Module({
  imports: [PharmacyConfigModule, MailerModule, AuditModule],
  controllers: [ReportsController, ReportDownloadController],
  providers: [
    ReportsService,
    ReportDataRepository,
    ReportJobsRepository,
    ExcelReportGenerator,
    PdfReportGenerator,
    ReportNotificationService,
    ReportWorkerService,
    {
      provide: REPORT_EVENTS,
      useFactory: () => new Subject<ReportSseEvent>(),
    },
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
