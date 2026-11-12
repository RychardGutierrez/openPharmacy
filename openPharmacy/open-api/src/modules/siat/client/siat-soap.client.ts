import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SIAT_CONFIG, type SiatConfig } from '../config/siat.config';
import {
  SiatConfigError,
  SiatFaultError,
  SiatProtocolError,
  SiatUnavailableError,
} from './siat-errors';
import { SIAT_TRANSPORT, type SiatTransport } from './siat-http-transport';
import {
  SIAT_REQUEST_LOG,
  type SiatCallOutcome,
  type SiatRequestLogSink,
  redactSecrets,
} from './siat-request-log';
import { type SiatOperation, endpointFor } from './siat-operations';
import {
  buildEnvelope,
  parseResponse,
  type SiatResult,
  type SiatValue,
} from './siat-soap-envelope';

export interface SiatInvokeOptions {
  /** Ties the log rows of one business action together. Generated when absent. */
  correlationId?: string;
  /** Caller context (for example `{ saleId }`). Stored in the request log. */
  metadata?: Record<string, string>;
}

/**
 * The one way to call SIAT. Every call is authenticated, time-boxed, logged with the token redacted,
 * and mapped to a typed result or a domain error.
 *
 * Retry policy: `read` operations retry with exponential backoff (`SIAT_READ_RETRIES`).
 * `write` operations never retry. A write that times out is reported with outcome `unknown`.
 */
@Injectable()
export class SiatSoapClient {
  private readonly logger = new Logger(SiatSoapClient.name);

  constructor(
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
    @Inject(SIAT_TRANSPORT) private readonly transport: SiatTransport,
    @Inject(SIAT_REQUEST_LOG) private readonly requestLog: SiatRequestLogSink,
  ) {}

  async invoke(
    operation: SiatOperation,
    payload: Record<string, SiatValue | undefined>,
    options: SiatInvokeOptions = {},
  ): Promise<SiatResult> {
    const token = this.config.token;
    if (!token) {
      throw new SiatConfigError(
        'SIAT_TOKEN is not set. Load the token delegado through SIAT-04 before calling SIAT.',
      );
    }

    const secrets = [token];
    const correlationId = options.correlationId ?? randomUUID();
    const envelope = buildEnvelope(operation, payload);
    const requestXml = redactSecrets(envelope, secrets);
    const metadata = redactMetadata(options.metadata ?? {}, secrets);
    const maxAttempts =
      operation.kind === 'read' ? 1 + this.config.readRetries : 1;

    for (let attempt = 1; ; attempt++) {
      const startedAt = new Date();
      const started = performance.now();
      const base = {
        correlationId,
        attempt,
        startedAt,
        requestXml,
        metadata,
        operation,
        environment: this.config.environment,
      };

      try {
        const response = await this.transport.post({
          url: endpointFor(this.config.baseUrl, operation.service),
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction: '""',
            // Token delegado. Verify the header format against the V3 annex before the first live call.
            apikey: `TokenApi ${token}`,
          },
          body: envelope,
          connectTimeoutMs: this.config.connectTimeoutMs,
          totalTimeoutMs: this.config.totalTimeoutMs,
        });

        const responseXml = redactSecrets(response.body, secrets);
        const result = parseHttpResponse(
          response.body,
          response.status,
          operation,
        );
        await this.record({
          ...base,
          durationMs: elapsed(started),
          outcome: 'success',
          httpStatus: response.status,
          responseXml,
        });
        return result;
      } catch (error) {
        const durationMs = elapsed(started);

        if (error instanceof SiatFaultError) {
          await this.record({ ...base, durationMs, outcome: 'fault' });
          throw error;
        }
        if (error instanceof SiatProtocolError) {
          await this.record({ ...base, durationMs, outcome: 'protocol-error' });
          throw error;
        }

        const unavailable =
          error instanceof SiatUnavailableError
            ? error
            : new SiatUnavailableError(
                redactSecrets(String(error), secrets),
                'unknown',
              );
        await this.record({
          ...base,
          durationMs,
          outcome: 'unavailable',
          unavailableOutcome: unavailable.outcome,
        });

        if (operation.kind === 'read' && attempt < maxAttempts) {
          await sleep(this.config.retryBaseMs * 2 ** (attempt - 1));
          continue;
        }
        throw unavailable;
      }
    }
  }

  private async record(entry: {
    correlationId: string;
    attempt: number;
    startedAt: Date;
    durationMs: number;
    outcome: SiatCallOutcome;
    unavailableOutcome?: 'not-sent' | 'unknown';
    httpStatus?: number;
    requestXml: string;
    responseXml?: string;
    metadata: Record<string, string>;
    operation: SiatOperation;
    environment: SiatConfig['environment'];
  }): Promise<void> {
    try {
      await this.requestLog.write({
        correlationId: entry.correlationId,
        attempt: entry.attempt,
        environment: entry.environment,
        service: entry.operation.service,
        operation: entry.operation.name,
        kind: entry.operation.kind,
        startedAt: entry.startedAt,
        durationMs: entry.durationMs,
        outcome: entry.outcome,
        unavailableOutcome: entry.unavailableOutcome,
        httpStatus: entry.httpStatus,
        requestXml: entry.requestXml,
        responseXml: entry.responseXml,
        metadata: entry.metadata,
      });
    } catch (error) {
      // A failed log write must not change the outcome of the SIAT call. It is reported here instead.
      this.logger.error(`SIAT request log write failed: ${String(error)}`);
    }
  }
}

/** Maps an HTTP response to a result. A 5xx without a SOAP fault means SIAT is unavailable. */
function parseHttpResponse(
  body: string,
  status: number,
  operation: SiatOperation,
): SiatResult {
  try {
    return parseResponse(body, operation);
  } catch (error) {
    if (error instanceof SiatProtocolError && status >= 500) {
      throw new SiatUnavailableError(
        `SIAT answered HTTP ${status} for ${operation.name}`,
        'unknown',
      );
    }
    throw error;
  }
}

function redactMetadata(
  metadata: Record<string, string>,
  secrets: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      redactSecrets(value, secrets),
    ]),
  );
}

function elapsed(started: number): number {
  return Math.round(performance.now() - started);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
