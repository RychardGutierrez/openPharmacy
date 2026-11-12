import type { SiatEnvironmentName } from '../config/siat.config';
import type { SiatOperationKind, SiatServiceName } from './siat-operations';

export type SiatCallOutcome =
  | 'success'
  | 'fault'
  | 'unavailable'
  | 'protocol-error';

/** One row for every SIAT call attempt. Secrets are already redacted when the entry is built. */
export interface SiatRequestLogEntry {
  correlationId: string;
  attempt: number;
  environment: SiatEnvironmentName;
  service: SiatServiceName;
  operation: string;
  kind: SiatOperationKind;
  startedAt: Date;
  durationMs: number;
  outcome: SiatCallOutcome;
  /** Set for `unavailable`: `not-sent` (safe to resend) or `unknown` (verify first). */
  unavailableOutcome?: 'not-sent' | 'unknown';
  httpStatus?: number;
  requestXml: string;
  responseXml?: string;
  /** Caller context, such as the sale or invoice id. */
  metadata?: Record<string, string>;
}

/** Persists request log rows. SIAT-02 provides the Prisma implementation for `siat_request_log`. */
export interface SiatRequestLogSink {
  write(entry: SiatRequestLogEntry): Promise<void>;
}

export const SIAT_REQUEST_LOG = Symbol('SIAT_REQUEST_LOG');

export const REDACTED = '[REDACTED]';

/** Replaces every occurrence of each secret in `text`. Empty secrets are ignored. */
export function redactSecrets(
  text: string,
  secrets: readonly string[],
): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .reduce((out, secret) => out.split(secret).join(REDACTED), text);
}

/** Keeps the entries in memory. Used by tests. */
export class MemorySiatRequestLogSink implements SiatRequestLogSink {
  readonly entries: SiatRequestLogEntry[] = [];

  write(entry: SiatRequestLogEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
}
