import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  SiatRequestLogEntry,
  SiatRequestLogSink,
} from '../client/siat-request-log';

/**
 * Writes each SIAT call attempt to `siat.siat_request_log`.
 * Entries arrive already redacted (`SiatSoapClient` removes the token), so they are stored as given.
 * A failed insert is caught and logged by `SiatSoapClient`, so it never changes the call outcome.
 */
@Injectable()
export class PrismaSiatRequestLogSink implements SiatRequestLogSink {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: SiatRequestLogEntry): Promise<void> {
    await this.prisma.siatRequestLog.create({
      data: {
        correlation_id: entry.correlationId,
        attempt: entry.attempt,
        environment: entry.environment,
        service: entry.service,
        operation: entry.operation,
        kind: entry.kind,
        point_of_sale_id: entry.pointOfSaleId ?? null,
        started_at: entry.startedAt,
        duration_ms: entry.durationMs,
        outcome: entry.outcome,
        unavailable_outcome: entry.unavailableOutcome ?? null,
        http_status: entry.httpStatus ?? null,
        request_xml: entry.requestXml,
        response_xml: entry.responseXml ?? null,
        metadata:
          entry.metadata && Object.keys(entry.metadata).length > 0
            ? entry.metadata
            : undefined,
      },
    });
  }
}
