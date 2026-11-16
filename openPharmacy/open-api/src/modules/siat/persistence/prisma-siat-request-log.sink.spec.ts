import type { PrismaService } from '../../../prisma/prisma.service';
import type { SiatRequestLogEntry } from '../client/siat-request-log';
import { PrismaSiatRequestLogSink } from './prisma-siat-request-log.sink';

describe('PrismaSiatRequestLogSink', () => {
  const create = jest.fn();
  const prisma = {
    siatRequestLog: { create },
  } as unknown as PrismaService;
  const sink = new PrismaSiatRequestLogSink(prisma);

  const base: SiatRequestLogEntry = {
    correlationId: '0b6f7a2e-1d1c-4c55-9d43-0d1f6f6b2a10',
    attempt: 1,
    environment: 'pilot',
    service: 'FacturacionCodigos',
    operation: 'verificarComunicacion',
    kind: 'read',
    startedAt: new Date('2026-11-12T10:00:00Z'),
    durationMs: 42,
    outcome: 'success',
    requestXml: '<Envelope/>',
  };

  beforeEach(() => create.mockReset().mockResolvedValue({}));

  it('maps every field of a successful call to a row', async () => {
    await sink.write({
      ...base,
      httpStatus: 200,
      responseXml: '<ok/>',
      pointOfSaleId: '29b4ea9a-d524-49d1-b537-ccf0c166dae3',
      metadata: { saleId: 'S-1' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        correlation_id: base.correlationId,
        attempt: 1,
        environment: 'pilot',
        service: 'FacturacionCodigos',
        operation: 'verificarComunicacion',
        kind: 'read',
        point_of_sale_id: '29b4ea9a-d524-49d1-b537-ccf0c166dae3',
        started_at: base.startedAt,
        duration_ms: 42,
        outcome: 'success',
        unavailable_outcome: null,
        http_status: 200,
        request_xml: '<Envelope/>',
        response_xml: '<ok/>',
        metadata: { saleId: 'S-1' },
      },
    });
  });

  it('stores nulls for a call that never got a response', async () => {
    await sink.write({
      ...base,
      outcome: 'unavailable',
      unavailableOutcome: 'unknown',
      metadata: {},
    });

    const [{ data }] = create.mock.calls[0] as [{ data: object }];
    expect(data).toMatchObject({
      outcome: 'unavailable',
      unavailable_outcome: 'unknown',
      http_status: null,
      response_xml: null,
      point_of_sale_id: null,
    });
    expect(data).toHaveProperty('metadata', undefined);
  });

  it('propagates insert errors so the client can report them', async () => {
    create.mockRejectedValue(new Error('db down'));
    await expect(sink.write(base)).rejects.toThrow('db down');
  });
});
