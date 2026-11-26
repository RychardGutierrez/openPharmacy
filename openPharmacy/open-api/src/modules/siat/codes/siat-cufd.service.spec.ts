import { ConflictException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { PrismaService } from '../../../prisma/prisma.service';
import { SiatRejectedError, SiatUnavailableError } from '../client/siat-errors';
import type { SiatResult } from '../client/siat-soap-envelope';
import type { SiatSoapClient } from '../client/siat-soap.client';
import type { SiatConfig } from '../config/siat.config';
import { fixedSiatClock } from './siat-clock';
import type { SiatCodesService } from './siat-codes.service';
import {
  SIAT_CUFD_UNAVAILABLE_EVENT,
  SiatCufdService,
} from './siat-cufd.service';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Bolivia (UTC-4) wall-clock time as an instant. */
const bo = (iso: string) => new Date(`${iso}-04:00`);

const config = {
  environment: 'pilot',
  totalTimeoutMs: 20000,
  cufdRotateMinute: 5,
  cufdRenewBeforeMinutes: 60,
  cufdSweepMs: 60000,
  cufdRetryMaxMs: 15 * MIN,
} as SiatConfig;

interface Row {
  id: string;
  point_of_sale_id: string;
  codigo: string;
  codigo_control: string;
  direccion: string;
  codigo_interno: string | null;
  valid_from: Date;
  valid_until: Date;
  cuis_id: string | null;
  source: string;
}

type Where = {
  point_of_sale_id: string;
  valid_from?: { lte: Date };
  valid_until?: { gt: Date };
};

function issued(now: Date, n: number, validityMs = DAY): SiatResult {
  return {
    transaccion: true,
    mensajes: [],
    payload: {
      codigo: `CUFD-${n}`,
      codigoControl: `CTRL-${n}`,
      direccion: 'Av. Siempre Viva 123',
      fechaVigencia: new Date(now.getTime() + validityMs).toISOString(),
      transaccion: 'true',
    },
  };
}

function setup(
  options: {
    start?: Date;
    stored?: Array<Partial<Row> & { valid_from: Date; valid_until: Date }>;
    enabled?: boolean;
    closed?: boolean;
  } = {},
) {
  const clock = fixedSiatClock(options.start ?? bo('2026-11-20T12:00:00'));
  const rows: Row[] = (options.stored ?? []).map((row, i) => ({
    id: `cufd-${i}`,
    point_of_sale_id: 'pos-1',
    codigo: `OLD-${i}`,
    codigo_control: `OLD-CTRL-${i}`,
    direccion: 'Av. Siempre Viva 123',
    codigo_interno: null,
    cuis_id: 'cuis-1',
    source: 'SCHEDULED',
    ...row,
  }));
  const cuis = { id: 'cuis-1', code: 'CUIS-1' };
  const pos = {
    id: 'pos-1',
    codigo_punto_venta: 1,
    closed_at: options.closed ? clock.now() : null,
    branch: { codigo_sucursal: 0 },
  };

  const find = ({ where }: { where: Where }) => {
    const match = rows
      .filter((row) => row.point_of_sale_id === where.point_of_sale_id)
      .filter(
        (row) => !where.valid_from || row.valid_from <= where.valid_from.lte,
      )
      .filter(
        (row) => !where.valid_until || row.valid_until > where.valid_until.gt,
      )
      .sort((a, b) => b.valid_from.getTime() - a.valid_from.getTime());
    return Promise.resolve(match[0] ?? null);
  };

  const prisma = {
    siatPointOfSale: {
      findUnique: jest.fn(() => Promise.resolve(pos)),
      findMany: jest.fn(() => Promise.resolve([pos])),
    },
    siatCufd: {
      findFirst: jest.fn(find),
      create: jest.fn(({ data }: { data: Omit<Row, 'id'> }) => {
        const row = { id: `cufd-${rows.length}`, ...data };
        rows.push(row);
        return Promise.resolve(row);
      }),
    },
    siatCuis: { findFirst: jest.fn(() => Promise.resolve(cuis)) },
    $queryRaw: jest.fn(() => Promise.resolve([])),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );

  let issuedCount = 0;
  const client = {
    invoke: jest.fn(() =>
      Promise.resolve(issued(clock.now(), (issuedCount += 1))),
    ),
  };
  const codes = {
    siatEnabled: jest.fn(() => Promise.resolve(options.enabled ?? true)),
    cuisCode: jest.fn(() => Promise.resolve(cuis.code)),
    identity: jest.fn(() =>
      Promise.resolve({
        nit: '1234567',
        codigoSistema: 'SYS',
        codigoModalidad: 2,
      }),
    ),
  };
  const events = { emit: jest.fn() };
  const service = new SiatCufdService(
    prisma as unknown as PrismaService,
    client as unknown as SiatSoapClient,
    codes as unknown as SiatCodesService,
    events as unknown as EventEmitter2,
    config,
    clock,
  );
  return { service, prisma, client, codes, events, clock, rows, cuis };
}

describe('SiatCufdService.currentCufd', () => {
  it('returns the newest CUFD valid at the given time, and the older one for an earlier time', async () => {
    const { service } = setup({
      stored: [
        {
          valid_from: bo('2026-11-19T00:05:00'),
          valid_until: bo('2026-11-20T00:05:30'),
        },
        {
          valid_from: bo('2026-11-20T00:05:10'),
          valid_until: bo('2026-11-21T00:05:10'),
        },
      ],
    });

    // Both overlap at 00:05:20: the newest wins.
    await expect(
      service.currentCufd('pos-1', bo('2026-11-20T00:05:20')),
    ).resolves.toMatchObject({ codigo: 'OLD-1', codigoControl: 'OLD-CTRL-1' });
    // Offline emission at 23:00 the day before: the CUFD valid then.
    await expect(
      service.currentCufd('pos-1', bo('2026-11-19T23:00:00')),
    ).resolves.toMatchObject({ codigo: 'OLD-0' });
    await expect(
      service.currentCufd('pos-1', bo('2026-11-21T00:05:10')),
    ).resolves.toBeNull();
  });

  it('requireCufd answers 409 SIAT_CUFD_UNAVAILABLE without a valid CUFD', async () => {
    const { service } = setup();

    await expect(
      service.requireCufd('pos-1', bo('2026-11-20T12:00:00')),
    ).rejects.toMatchObject({
      response: { code: 'SIAT_CUFD_UNAVAILABLE' },
    });
  });
});

describe('SiatCufdService.ensureCufd', () => {
  const fresh = {
    valid_from: bo('2026-11-20T00:05:10'),
    valid_until: bo('2026-11-21T00:05:10'),
  };

  it('returns a valid stored CUFD without calling SIAT', async () => {
    const { service, client } = setup({ stored: [fresh] });

    const status = await service.ensureCufd('pos-1', { source: 'ON_DEMAND' });

    expect(status).toMatchObject({ state: 'valid', source: 'stored' });
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('requests a CUFD with the CUIS and stores codes, codigoInterno, CUIS and issue time', async () => {
    const { service, client, codes, prisma, rows, clock } = setup();
    client.invoke.mockResolvedValueOnce({
      ...issued(clock.now(), 1),
      payload: {
        ...issued(clock.now(), 1).payload,
        codigoInterno: 'INT-9',
      },
    });

    const status = await service.ensureCufd('pos-1', {
      source: 'ON_DEMAND',
      correlationId: 'corr',
    });

    expect(status).toMatchObject({
      state: 'valid',
      source: 'siat',
      minutesLeft: 1440,
    });
    expect(client.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'FacturacionCodigos', name: 'cufd' }),
      {
        SolicitudCufd: {
          codigoModalidad: 2,
          codigoPuntoVenta: 1,
          codigoSistema: 'SYS',
          codigoSucursal: 0,
          cuis: 'CUIS-1',
          nit: '1234567',
        },
      },
      expect.objectContaining({
        pointOfSaleId: 'pos-1',
        correlationId: 'corr',
      }),
    );
    expect(rows[0]).toMatchObject({
      codigo: 'CUFD-1',
      codigo_control: 'CTRL-1',
      direccion: 'Av. Siempre Viva 123',
      codigo_interno: 'INT-9',
      cuis_id: 'cuis-1',
      valid_from: clock.now(),
      source: 'ON_DEMAND',
    });
    // The CUIS is resolved before the row lock is taken (no deadlock with SiatCodesService).
    expect(codes.cuisCode.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.$transaction.mock.invocationCallOrder[0],
    );
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('a second caller that waited on the lock finds the CUFD and does not ask again', async () => {
    const { service, client, prisma, rows } = setup();
    // Another caller stored a CUFD while this one waited for the row lock.
    prisma.$queryRaw.mockImplementationOnce(() => {
      rows.push({
        id: 'other',
        point_of_sale_id: 'pos-1',
        codigo: 'OTHER',
        codigo_control: 'X',
        direccion: 'D',
        codigo_interno: null,
        valid_from: bo('2026-11-20T11:59:00'),
        valid_until: bo('2026-11-21T11:59:00'),
        cuis_id: 'cuis-1',
        source: 'SCHEDULED',
      });
      return Promise.resolve([]);
    });

    const status = await service.ensureCufd('pos-1', { source: 'ON_DEMAND' });

    expect(status).toMatchObject({ source: 'stored', state: 'valid' });
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('force asks SIAT even when the stored CUFD is valid', async () => {
    const { service, client, rows } = setup({ stored: [fresh] });

    const status = await service.ensureCufd('pos-1', {
      source: 'ON_DEMAND',
      force: true,
    });

    expect(client.invoke).toHaveBeenCalledTimes(1);
    expect(status.source).toBe('siat');
    expect(rows).toHaveLength(2);
  });

  it('keeps a usable CUFD when SIAT fails, and throws when none is usable or with force', async () => {
    const rotate = {
      valid_from: bo('2026-11-19T23:06:00'),
      valid_until: bo('2026-11-20T23:06:00'),
    };
    const kept = setup({ stored: [rotate] });
    kept.client.invoke.mockRejectedValue(
      new SiatUnavailableError('down', 'not-sent'),
    );
    await expect(
      kept.service.ensureCufd('pos-1', { source: 'SCHEDULED' }),
    ).resolves.toMatchObject({ state: 'rotate', renewalFailed: true });
    await expect(
      kept.service.ensureCufd('pos-1', { source: 'ON_DEMAND', force: true }),
    ).rejects.toBeInstanceOf(SiatUnavailableError);

    const none = setup();
    none.client.invoke.mockRejectedValue(
      new SiatUnavailableError('down', 'not-sent'),
    );
    await expect(
      none.service.ensureCufd('pos-1', { source: 'ON_DEMAND' }),
    ).rejects.toBeInstanceOf(SiatUnavailableError);
  });

  it('a response without codigoControl or direccion is a rejection, and nothing is stored', async () => {
    const { service, client, rows } = setup();
    client.invoke.mockResolvedValue({
      transaccion: false,
      mensajes: [{ codigo: 995, descripcion: 'CUIS INVALIDO' }],
      payload: { transaccion: 'false' },
    });

    await expect(
      service.ensureCufd('pos-1', { source: 'ON_DEMAND' }),
    ).rejects.toBeInstanceOf(SiatRejectedError);
    expect(rows).toHaveLength(0);
  });

  it('refuses a closed point of sale', async () => {
    const { service } = setup({ closed: true });

    await expect(
      service.ensureCufd('pos-1', { source: 'ON_DEMAND' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SiatCufdService and CUIS renewal', () => {
  it('a renewed CUIS makes the CUFD stale, and the event requests one with the new CUIS', async () => {
    const { service, client, cuis, rows } = setup({
      stored: [
        {
          valid_from: bo('2026-11-20T00:05:10'),
          valid_until: bo('2026-11-21T00:05:10'),
        },
      ],
    });
    cuis.id = 'cuis-2';
    cuis.code = 'CUIS-2';

    await expect(service.status('pos-1')).resolves.toMatchObject({
      state: 'stale',
    });
    await service.onCuisRenewed({
      pointOfSaleId: 'pos-1',
      codigoSucursal: 0,
      codigoPuntoVenta: 1,
      validUntil: bo('2027-11-20T00:00:00'),
    });

    expect((client.invoke.mock.calls[0] as unknown[])[1]).toMatchObject({
      SolicitudCufd: { cuis: 'CUIS-2' },
    });
    expect(rows[1]).toMatchObject({ cuis_id: 'cuis-2', source: 'ON_DEMAND' });
    await expect(service.status('pos-1')).resolves.toMatchObject({
      state: 'valid',
    });
  });

  it('the event handler never throws', async () => {
    const { service, client } = setup();
    client.invoke.mockRejectedValue(
      new SiatUnavailableError('down', 'not-sent'),
    );

    await expect(
      service.onCuisRenewed({
        pointOfSaleId: 'pos-1',
        codigoSucursal: 0,
        codigoPuntoVenta: 1,
        validUntil: bo('2027-11-20T00:00:00'),
      }),
    ).resolves.toBeUndefined();
  });
});

describe('SiatCufdService.renewDue (SIAT-06 acceptance)', () => {
  it('a point of sale is never without a valid CUFD across midnight (fake clock, 1-minute sweeps)', async () => {
    // Yesterday's rotation CUFD: valid from 00:05:20 to 00:05:20 today.
    const { service, client, clock } = setup({
      start: bo('2026-11-20T22:00:00'),
      stored: [
        {
          valid_from: bo('2026-11-20T00:05:20'),
          valid_until: bo('2026-11-21T00:05:20'),
        },
      ],
    });
    const requests: Date[] = [];
    client.invoke.mockImplementation(() => {
      requests.push(clock.now());
      return Promise.resolve(issued(clock.now(), requests.length));
    });

    for (
      let t = bo('2026-11-20T22:00:00').getTime();
      t <= bo('2026-11-21T02:00:00').getTime();
      t += MIN
    ) {
      clock.set(new Date(t));
      await service.renewDue();
      const current = await service.currentCufd('pos-1', clock.now());
      if (!current)
        throw new Error(`No valid CUFD at ${clock.now().toISOString()}`);
    }

    // Safety net one hour before expiry, then the daily rotation at 00:05.
    expect(requests).toEqual([
      bo('2026-11-20T23:06:00'),
      bo('2026-11-21T00:05:00'),
    ]);
  });

  it('retries failed requests with backoff (1, 2, 4, 8 min) while keeping the stored CUFD', async () => {
    const start = bo('2026-11-20T23:10:00');
    const { service, client, clock } = setup({
      start,
      // 55 minutes left: inside the safety-net window.
      stored: [
        {
          valid_from: bo('2026-11-20T00:05:00'),
          valid_until: bo('2026-11-21T00:05:00'),
        },
      ],
    });
    const attempts: number[] = [];
    client.invoke.mockImplementation(() => {
      const minute = (clock.now().getTime() - start.getTime()) / MIN;
      attempts.push(minute);
      return minute < 10
        ? Promise.reject(new SiatUnavailableError('down', 'not-sent'))
        : Promise.resolve(issued(clock.now(), attempts.length));
    });

    const summaries: Array<Awaited<ReturnType<typeof service.renewDue>>> = [];
    for (let minute = 0; minute <= 20; minute += 1) {
      clock.set(new Date(start.getTime() + minute * MIN));
      summaries.push(await service.renewDue());
      await expect(
        service.currentCufd('pos-1', clock.now()),
      ).resolves.not.toBeNull();
    }

    expect(attempts).toEqual([0, 1, 3, 7, 15]);
    expect(summaries.reduce((sum, s) => sum + s.failed, 0)).toBe(4);
    expect(summaries.reduce((sum, s) => sum + s.renewed, 0)).toBe(1);
    expect(summaries[2].deferred).toBe(1);
  });

  it('reports a point of sale without a valid CUFD once per outage', async () => {
    const { service, client, clock, events } = setup();
    client.invoke.mockRejectedValue(
      new SiatUnavailableError('down', 'not-sent'),
    );

    for (let minute = 0; minute < 10; minute += 1) {
      clock.set(new Date(bo('2026-11-20T12:00:00').getTime() + minute * MIN));
      await service.renewDue();
    }
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith(
      SIAT_CUFD_UNAVAILABLE_EVENT,
      expect.objectContaining({ pointOfSaleId: 'pos-1', expiredAt: null }),
    );

    // Recovery clears it, so the next outage is reported again.
    client.invoke.mockImplementation(() =>
      Promise.resolve(issued(clock.now(), 1, 2 * MIN)),
    );
    clock.set(new Date(clock.now().getTime() + 20 * MIN));
    await service.renewDue();
    client.invoke.mockRejectedValue(
      new SiatUnavailableError('down', 'not-sent'),
    );
    clock.set(new Date(clock.now().getTime() + 5 * MIN));
    await service.renewDue();
    expect(events.emit).toHaveBeenCalledTimes(2);
  });

  it('does nothing while SIAT is disabled', async () => {
    const { service, client, prisma } = setup({ enabled: false });

    await expect(service.renewDue()).resolves.toEqual({
      renewed: 0,
      failed: 0,
      deferred: 0,
    });
    expect(prisma.siatPointOfSale.findMany).not.toHaveBeenCalled();
    expect(client.invoke).not.toHaveBeenCalled();
  });
});
