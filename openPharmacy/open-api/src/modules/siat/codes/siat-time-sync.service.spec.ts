import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { SiatSoapClient } from '../client/siat-soap.client';
import type { SiatConfig } from '../config/siat.config';
import type { SiatCodesService } from './siat-codes.service';
import { OffsetSiatClock, SIAT_CLOCK_STALE_MS } from './siat-offset-clock';
import {
  SIAT_CLOCK_DRIFT_EVENT,
  SiatTimeSyncService,
} from './siat-time-sync.service';

const config = { clockWarnMs: 5000, clockMaxRttMs: 2000 } as SiatConfig;

/** Server clock: `start` at request, `start + rtt` at response. SIN reports `siatTime`. */
function setup(
  siatTime: string,
  rttMs: number,
  serverStart = Date.parse('2026-11-26T12:00:00Z'),
) {
  const now = { value: serverStart };
  jest.spyOn(Date, 'now').mockImplementation(() => now.value);

  const created: Record<string, unknown>[] = [];
  const prisma = {
    siatPointOfSale: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 'pos-0',
          codigo_punto_venta: 0,
          branch: { codigo_sucursal: 0 },
        }),
      ),
    },
    siatTimeOffset: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({ ...data, created_at: new Date(serverStart) });
      }),
    },
  };
  const client = {
    invoke: jest.fn(() => {
      now.value += rttMs;
      return Promise.resolve({
        transaccion: true,
        mensajes: [],
        payload: { fechaHora: siatTime },
      });
    }),
  };
  const codes = {
    identity: jest.fn(() =>
      Promise.resolve({ nit: '1', codigoSistema: 'S', codigoModalidad: 2 }),
    ),
    cuisCode: jest.fn(() => Promise.resolve('CUIS')),
  };
  const events = { emit: jest.fn() };
  const clock = new OffsetSiatClock(prisma as unknown as PrismaService, config);
  const service = new SiatTimeSyncService(
    prisma as unknown as PrismaService,
    client as unknown as SiatSoapClient,
    codes as unknown as SiatCodesService,
    clock,
    events as unknown as EventEmitter2,
    config,
  );
  return { service, clock, created, events, client };
}

afterEach(() => jest.restoreAllMocks());

describe('SiatTimeSyncService.syncTime', () => {
  it('computes the offset against the midpoint of the round trip and applies it to the clock', async () => {
    // Server midpoint = 12:00:00.100 (rtt 200 ms). SIN is 2 s ahead of it.
    const { service, clock, created } = setup(
      '2026-11-26T08:00:02.100-04:00',
      200,
    );
    const sample = await service.syncTime();

    expect(sample).toMatchObject({
      accepted: true,
      offsetMs: 2000,
      rttMs: 200,
    });
    expect(created[0]).toMatchObject({ offset_ms: 2000 });
    // The corrected clock reads the server clock plus the offset.
    expect(clock.now().getTime() - Date.now()).toBe(2000);
  });

  it('never retries the call (a late retry would measure the wrong interval)', async () => {
    const { service, client } = setup('2026-11-26T08:00:00.000-04:00', 10);
    await service.syncTime();
    expect(client.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'sincronizarFechaHora' }),
      expect.any(Object),
      expect.objectContaining({ readRetries: 0 }),
    );
  });

  it('discards a sample whose round trip is above SIAT_CLOCK_MAX_RTT_MS', async () => {
    const { service, clock, created } = setup(
      '2026-11-26T08:00:30.000-04:00',
      5000,
    );
    const sample = await service.syncTime();

    expect(sample).toEqual({
      accepted: false,
      reason: 'slow-round-trip',
      rttMs: 5000,
    });
    expect(created).toHaveLength(0);
    expect(clock.status(new Date()).sampledAt).toBeNull();
  });

  it('reports drift above the warning threshold and emits siat.clock.drift', async () => {
    const { service, events } = setup('2026-11-26T08:00:09.000-04:00', 0);
    await service.syncTime();
    // SIN is 9 s ahead of the server midpoint.
    expect(events.emit).toHaveBeenCalledWith(SIAT_CLOCK_DRIFT_EVENT, {
      offsetMs: 9000,
      sampledAt: new Date('2026-11-26T12:00:00Z'),
    });
  });

  it('applies a small offset without a drift event', async () => {
    const { service, events, clock } = setup(
      '2026-11-26T08:00:00.500-04:00',
      0,
    );
    await service.syncTime();
    expect(events.emit).not.toHaveBeenCalled();
    expect(clock.status(new Date()).warning).toBe(false);
  });
});

describe('OffsetSiatClock.status', () => {
  it('is stale when it has never been sampled, and after two hours without a new sample', () => {
    const clock = new OffsetSiatClock({} as PrismaService, config);
    expect(clock.status(new Date()).stale).toBe(true);

    const sampledAt = new Date('2026-11-26T12:00:00Z');
    clock.update(0, sampledAt);
    expect(
      clock.status(new Date(sampledAt.getTime() + SIAT_CLOCK_STALE_MS - 1))
        .stale,
    ).toBe(false);
    expect(
      clock.status(new Date(sampledAt.getTime() + SIAT_CLOCK_STALE_MS + 1))
        .stale,
    ).toBe(true);
  });
});
