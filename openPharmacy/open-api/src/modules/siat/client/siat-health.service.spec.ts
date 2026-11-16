import {
  SiatConfigError,
  SiatFaultError,
  SiatProtocolError,
  SiatUnavailableError,
} from './siat-errors';
import { SiatHealthService } from './siat-health.service';
import { SIAT_OPERATIONS } from './siat-operations';
import type { SiatResult } from './siat-soap-envelope';
import type { SiatSoapClient } from './siat-soap.client';

function build(outcome: SiatResult | Error) {
  const invoke = jest.fn(() =>
    outcome instanceof Error
      ? Promise.reject(outcome)
      : Promise.resolve(outcome),
  );
  const service = new SiatHealthService({
    invoke,
  } as unknown as SiatSoapClient);
  return { service, invoke };
}

const answer = (transaccion: boolean): SiatResult => ({
  transaccion,
  mensajes: [{ codigo: 926, descripcion: 'COMUNICACION EXITOSA' }],
  payload: {},
});

describe('SiatHealthService.checkConnection', () => {
  it('calls verificarComunicacion with no fields and no retries', async () => {
    const { service, invoke } = build(answer(true));

    await service.checkConnection();

    expect(invoke).toHaveBeenCalledWith(
      SIAT_OPERATIONS.FacturacionCodigos.verificarComunicacion,
      {},
      expect.objectContaining({ readRetries: 0 }),
    );
  });

  it('checks the requested service', async () => {
    const { service, invoke } = build(answer(true));

    const check = await service.checkConnection(
      'ServicioFacturacionCompraVenta',
    );

    expect(check.service).toBe('ServicioFacturacionCompraVenta');
    expect(invoke.mock.calls[0]).toContain(
      SIAT_OPERATIONS.ServicioFacturacionCompraVenta.verificarComunicacion,
    );
  });

  it('reports ok with the SIAT messages when transaccion=true', async () => {
    const check = await build(answer(true)).service.checkConnection();

    expect(check).toMatchObject({
      status: 'ok',
      mensajes: [{ codigo: 926 }],
    });
    expect(check.detail).toBeUndefined();
    expect(check.checkedAt).toBeInstanceOf(Date);
  });

  it.each([
    ['transaccion=false', answer(false), 'rejected'],
    ['a SOAP fault', new SiatFaultError('soap:Client', 'token'), 'rejected'],
    [
      'a timeout',
      new SiatUnavailableError('timeout', 'unknown'),
      'unavailable',
    ],
    [
      'no token',
      new SiatConfigError('SIAT_TOKEN is not set'),
      'not-configured',
    ],
    ['an unreadable answer', new SiatProtocolError('bad xml'), 'error'],
  ] as const)(
    'reports %s as %s, without throwing',
    async (_c, outcome, status) => {
      const check = await build(outcome).service.checkConnection();

      expect(check.status).toBe(status);
      expect(check.detail).toBeTruthy();
    },
  );
});
