import { Injectable, Logger, Module } from '@nestjs/common';
import { SIAT_CONFIG, readSiatConfig } from './config/siat.config';
import { SiatSoapClient } from './client/siat-soap.client';
import {
  SIAT_TRANSPORT,
  SiatHttpTransport,
} from './client/siat-http-transport';
import {
  SIAT_REQUEST_LOG,
  type SiatRequestLogEntry,
  type SiatRequestLogSink,
} from './client/siat-request-log';

/**
 * Interim request log: writes each redacted entry to the application log.
 * SIAT-02 replaces it with the `siat_request_log` table.
 */
@Injectable()
export class LoggerSiatRequestLogSink implements SiatRequestLogSink {
  private readonly logger = new Logger('SiatRequestLog');

  write(entry: SiatRequestLogEntry): Promise<void> {
    this.logger.log(
      JSON.stringify({ ...entry, startedAt: entry.startedAt.toISOString() }),
    );
    return Promise.resolve();
  }
}

@Module({
  providers: [
    { provide: SIAT_CONFIG, useFactory: () => readSiatConfig() },
    { provide: SIAT_TRANSPORT, useClass: SiatHttpTransport },
    { provide: SIAT_REQUEST_LOG, useClass: LoggerSiatRequestLogSink },
    SiatSoapClient,
  ],
  exports: [SiatSoapClient],
})
export class SiatModule {}
