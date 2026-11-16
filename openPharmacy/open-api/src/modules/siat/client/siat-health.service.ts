import { Injectable } from '@nestjs/common';
import {
  SiatConfigError,
  SiatFaultError,
  SiatUnavailableError,
} from './siat-errors';
import { SIAT_OPERATIONS, type SiatServiceName } from './siat-operations';
import type { SiatMessage } from './siat-soap-envelope';
import { SiatSoapClient } from './siat-soap.client';

/**
 * - `ok`: SIAT answered `transaccion=true`.
 * - `rejected`: SIAT answered but refused (`transaccion=false` or a SOAP fault), for example a bad token.
 * - `unavailable`: no answer in time, or the connection failed.
 * - `not-configured`: no token, so nothing was sent.
 * - `error`: SIAT answered with something unreadable.
 */
export type SiatConnectionStatus =
  | 'ok'
  | 'rejected'
  | 'unavailable'
  | 'not-configured'
  | 'error';

export interface SiatConnectionCheck {
  service: SiatServiceName;
  status: SiatConnectionStatus;
  checkedAt: Date;
  durationMs: number;
  mensajes: SiatMessage[];
  /** Short reason for anything other than `ok`. Never contains the token. */
  detail?: string;
}

/**
 * Connectivity check with `verificarComunicacion`, used by the connection banner (SIAT-20) and
 * "Test connection" in Settings (SIAT-04). The operation needs no fields and changes nothing.
 * It never throws: every result is a status. It does not retry, so the answer is fast.
 */
@Injectable()
export class SiatHealthService {
  constructor(private readonly client: SiatSoapClient) {}

  async checkConnection(
    service: SiatServiceName = 'FacturacionCodigos',
  ): Promise<SiatConnectionCheck> {
    const checkedAt = new Date();
    const started = performance.now();
    const result = (
      status: SiatConnectionStatus,
      extra: Partial<SiatConnectionCheck> = {},
    ): SiatConnectionCheck => ({
      service,
      status,
      checkedAt,
      durationMs: Math.round(performance.now() - started),
      mensajes: [],
      ...extra,
    });

    try {
      const response = await this.client.invoke(
        SIAT_OPERATIONS[service].verificarComunicacion,
        {},
        { readRetries: 0, metadata: { purpose: 'health-check' } },
      );
      return result(response.transaccion ? 'ok' : 'rejected', {
        mensajes: response.mensajes,
        detail: response.transaccion ? undefined : 'transaccion=false',
      });
    } catch (error) {
      if (error instanceof SiatConfigError) {
        return result('not-configured', { detail: error.message });
      }
      if (error instanceof SiatUnavailableError) {
        return result('unavailable', { detail: error.message });
      }
      if (error instanceof SiatFaultError) {
        return result('rejected', { detail: error.message });
      }
      return result('error', {
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
