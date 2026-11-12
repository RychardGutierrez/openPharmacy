import type { SiatConfig } from '../config/siat.config';
import {
  SiatConfigError,
  SiatFaultError,
  SiatUnavailableError,
} from './siat-errors';
import type {
  SiatTransport,
  SiatTransportRequest,
  SiatTransportResponse,
} from './siat-http-transport';
import { SIAT_OPERATIONS } from './siat-operations';
import {
  MemorySiatRequestLogSink,
  type SiatRequestLogSink,
} from './siat-request-log';
import { SiatSoapClient } from './siat-soap.client';

const TOKEN = 'tok-SECRET-1234567890';
const VERIFICAR_NIT = SIAT_OPERATIONS.FacturacionCodigos.verificarNit;
const RECEPCION =
  SIAT_OPERATIONS.ServicioFacturacionCompraVenta.recepcionFactura;

const OK_BODY = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<ns2:verificarNitResponse><RespuestaVerificarNit><transaccion>true</transaccion></RespuestaVerificarNit></ns2:verificarNitResponse>
</soap:Body></soap:Envelope>`;

const FAULT_BODY = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<soap:Fault><faultcode>soap:Client</faultcode><faultstring>Solicitud inválida</faultstring></soap:Fault>
</soap:Body></soap:Envelope>`;

/** Fake transport: each call takes the next scripted step (a response or an error). */
class ScriptedTransport implements SiatTransport {
  readonly requests: SiatTransportRequest[] = [];

  constructor(private readonly steps: Array<SiatTransportResponse | Error>) {}

  post(request: SiatTransportRequest): Promise<SiatTransportResponse> {
    this.requests.push(request);
    const step = this.steps.shift();
    if (!step) throw new Error('No scripted response left');
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step);
  }
}

function config(overrides: Partial<SiatConfig> = {}): SiatConfig {
  return {
    environment: 'pilot',
    baseUrl: 'https://pilot.example.test/v2',
    token: TOKEN,
    connectTimeoutMs: 5000,
    totalTimeoutMs: 20000,
    readRetries: 2,
    retryBaseMs: 0,
    ...overrides,
  };
}

function build(
  steps: Array<SiatTransportResponse | Error>,
  cfg: Partial<SiatConfig> = {},
  sink?: SiatRequestLogSink,
) {
  const transport = new ScriptedTransport(steps);
  const log = sink ?? new MemorySiatRequestLogSink();
  const client = new SiatSoapClient(config(cfg), transport, log);
  return { client, transport, log: log as MemorySiatRequestLogSink };
}

const ok = (): SiatTransportResponse => ({ status: 200, body: OK_BODY });
const unavailable = (outcome: 'not-sent' | 'unknown') =>
  new SiatUnavailableError('down', outcome);

describe('SiatSoapClient', () => {
  it('returns the typed result and logs one successful call', async () => {
    const { client, log } = build([ok()]);

    const result = await client.invoke(
      VERIFICAR_NIT,
      { nit: 1 },
      { metadata: { saleId: 's-1' } },
    );

    expect(result.transaccion).toBe(true);
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]).toMatchObject({
      outcome: 'success',
      httpStatus: 200,
      attempt: 1,
      metadata: { saleId: 's-1' },
    });
  });

  it('sends the token as apikey and posts to the service endpoint', async () => {
    const { client, transport } = build([ok()]);

    await client.invoke(VERIFICAR_NIT, { nit: 1 });

    expect(transport.requests[0].url).toBe(
      'https://pilot.example.test/v2/FacturacionCodigos',
    );
    expect(transport.requests[0].headers.apikey).toBe(`TokenApi ${TOKEN}`);
  });

  it('retries a read operation after an unavailable answer, then succeeds', async () => {
    const { client, transport, log } = build([
      unavailable('not-sent'),
      unavailable('not-sent'),
      ok(),
    ]);

    const result = await client.invoke(VERIFICAR_NIT, { nit: 1 });

    expect(result.transaccion).toBe(true);
    expect(transport.requests).toHaveLength(3);
    expect(log.entries.map((e) => [e.attempt, e.outcome])).toEqual([
      [1, 'unavailable'],
      [2, 'unavailable'],
      [3, 'success'],
    ]);
  });

  it('gives up on a read operation after the configured retries', async () => {
    const { client, transport } = build(
      [
        unavailable('not-sent'),
        unavailable('not-sent'),
        unavailable('not-sent'),
      ],
      { readRetries: 2 },
    );

    await expect(
      client.invoke(VERIFICAR_NIT, { nit: 1 }),
    ).rejects.toBeInstanceOf(SiatUnavailableError);
    expect(transport.requests).toHaveLength(3);
  });

  it('never retries a write operation, even when the outcome is "not-sent"', async () => {
    const { client, transport, log } = build([unavailable('not-sent'), ok()]);

    await expect(client.invoke(RECEPCION, { x: 1 })).rejects.toBeInstanceOf(
      SiatUnavailableError,
    );
    expect(transport.requests).toHaveLength(1);
    expect(log.entries).toHaveLength(1);
  });

  it('reports a write timeout after sending as outcome "unknown", without retrying', async () => {
    const { client, transport } = build([unavailable('unknown'), ok()]);

    const error = await client
      .invoke(RECEPCION, { x: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SiatUnavailableError);
    expect((error as SiatUnavailableError).outcome).toBe('unknown');
    expect(transport.requests).toHaveLength(1);
  });

  it('turns an unexpected transport error into an "unknown" unavailable error', async () => {
    const { client } = build([new Error('socket hang up')]);

    const error = await client
      .invoke(RECEPCION, { x: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SiatUnavailableError);
    expect((error as SiatUnavailableError).outcome).toBe('unknown');
  });

  it('maps a SOAP fault to SiatFaultError without retrying', async () => {
    const { client, transport } = build([
      { status: 500, body: FAULT_BODY },
      ok(),
    ]);

    await expect(
      client.invoke(VERIFICAR_NIT, { nit: 1 }),
    ).rejects.toBeInstanceOf(SiatFaultError);
    expect(transport.requests).toHaveLength(1);
  });

  it('treats an HTTP 5xx without a SOAP envelope as unavailable', async () => {
    const { client } = build([{ status: 503, body: 'Service Unavailable' }]);

    const error = await client
      .invoke(RECEPCION, { x: 1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SiatUnavailableError);
  });

  it('refuses to call SIAT without a token and never reaches the transport', async () => {
    const { client, transport } = build([ok()], { token: '' });

    await expect(
      client.invoke(VERIFICAR_NIT, { nit: 1 }),
    ).rejects.toBeInstanceOf(SiatConfigError);
    expect(transport.requests).toHaveLength(0);
  });

  it('never writes the token to the request log, in any field', async () => {
    // The response echoes the token in a field the parser ignores. The log must still not keep it.
    const echoed = OK_BODY.replace(
      '<transaccion>',
      `<codigo>${TOKEN}</codigo><transaccion>`,
    );
    const { client, log } = build([{ status: 200, body: echoed }]);

    await client.invoke(
      VERIFICAR_NIT,
      { nit: 1, nota: `echo ${TOKEN}` },
      { metadata: { leak: TOKEN } },
    );

    const serialized = JSON.stringify(log.entries);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).toContain('[REDACTED]');
  });

  it('keeps the same correlation id across retries of one call', async () => {
    const { client, log } = build([unavailable('not-sent'), ok()]);

    await client.invoke(
      VERIFICAR_NIT,
      { nit: 1 },
      { correlationId: 'corr-42' },
    );

    expect(log.entries.map((e) => e.correlationId)).toEqual([
      'corr-42',
      'corr-42',
    ]);
  });

  it('keeps the call result when the request log write fails', async () => {
    const failingSink: SiatRequestLogSink = {
      write: () => Promise.reject(new Error('database down')),
    };
    const { client } = build([ok()], {}, failingSink);

    const result = await client.invoke(VERIFICAR_NIT, { nit: 1 });

    expect(result.transaccion).toBe(true);
  });

  it('uses the configured endpoint for the chosen environment', async () => {
    const { client, transport } = build([ok()], {
      environment: 'production',
      baseUrl: 'https://prod.example.test/v2',
    });

    await client.invoke(VERIFICAR_NIT, { nit: 1 });

    expect(transport.requests[0].url).toBe(
      'https://prod.example.test/v2/FacturacionCodigos',
    );
  });
});
