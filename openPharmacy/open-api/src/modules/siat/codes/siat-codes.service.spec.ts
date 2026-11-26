import { ConflictException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConfigService as PharmacyConfigService } from '../../config/config.service';
import { SiatRejectedError, SiatUnavailableError } from '../client/siat-errors';
import type { SiatResult } from '../client/siat-soap-envelope';
import type { SiatSoapClient } from '../client/siat-soap.client';
import { staticSiatCredentials } from '../config/siat-credentials';
import type { SiatConfig } from '../config/siat.config';
import { fixedSiatClock } from './siat-clock';
import {
  SIAT_CUIS_RENEWED_EVENT,
  SiatCodesService,
} from './siat-codes.service';

const DAY = 86_400_000;
const NOW = new Date('2026-11-17T12:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

const config = {
  environment: 'pilot',
  totalTimeoutMs: 20000,
  cuisRenewDays: 5,
  cuisAlertDays: 15,
} as SiatConfig;

interface StoredCuis {
  id: string;
  code: string;
  valid_until: Date;
  active: boolean;
}

function cuisResult(
  codigo: string,
  vigencia: Date,
  transaccion = true,
): SiatResult {
  return {
    transaccion,
    mensajes: transaccion
      ? []
      : [{ codigo: 980, descripcion: 'EXISTE UN CUIS VIGENTE' }],
    payload: {
      codigo,
      fechaVigencia: vigencia.toISOString(),
      transaccion: String(transaccion),
    },
  };
}

function setup(
  options: { stored?: StoredCuis[]; enabled?: boolean; closed?: boolean } = {},
) {
  const rows: StoredCuis[] = options.stored ?? [];
  const active = () => rows.find((row) => row.active);
  const pos = () => ({
    id: 'pos-1',
    codigo_punto_venta: 1,
    closed_at: options.closed ? NOW : null,
    branch: { codigo_sucursal: 0 },
    cuis: active() ? [active()!] : [],
  });

  const prisma = {
    siatPointOfSale: {
      findUnique: jest.fn(() => Promise.resolve(pos())),
      findMany: jest.fn(() =>
        Promise.resolve([
          {
            id: 'pos-1',
            codigo_punto_venta: 1,
            branch: { codigo_sucursal: 0 },
            cuis: active() ? [{ valid_until: active()!.valid_until }] : [],
          },
        ]),
      ),
    },
    siatCuis: {
      findFirst: jest.fn(() => Promise.resolve(active() ?? null)),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<StoredCuis>;
        }) => {
          Object.assign(rows.find((row) => row.id === where.id)!, data);
          return Promise.resolve();
        },
      ),
      create: jest.fn(
        ({ data }: { data: { code: string; valid_until: Date } }) => {
          rows.push({
            id: `cuis-${rows.length + 1}`,
            code: data.code,
            valid_until: data.valid_until,
            active: true,
          });
          return Promise.resolve();
        },
      ),
    },
    $queryRaw: jest.fn(() => Promise.resolve([])),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );

  const client = { invoke: jest.fn() };
  const settings = {
    getStoredValues: jest.fn(() =>
      Promise.resolve({
        SIAT_MODALITY: 2,
        SIAT_ENABLED: options.enabled ?? true,
      }),
    ),
  };
  const audit = { create: jest.fn() };
  const events = { emit: jest.fn() };
  const clock = fixedSiatClock(NOW);
  const service = new SiatCodesService(
    prisma as unknown as PrismaService,
    client as unknown as SiatSoapClient,
    settings as unknown as PharmacyConfigService,
    audit as unknown as AuditLogRepository,
    events as unknown as EventEmitter2,
    config,
    staticSiatCredentials({
      token: 'tok',
      nit: '1234567',
      codigoSistema: 'SYS',
    }),
    clock,
  );
  return { service, prisma, client, audit, events, clock, rows };
}

describe('SiatCodesService.ensureCuis', () => {
  it('requests a CUIS when none is stored and records it', async () => {
    const { service, client, rows, audit } = setup();
    client.invoke.mockResolvedValue(cuisResult('C-NEW', days(365)));

    const status = await service.ensureCuis('pos-1', { userId: 'admin' });

    expect(status).toMatchObject({
      state: 'valid',
      source: 'siat',
      renewed: false,
    });
    expect(rows).toEqual([
      expect.objectContaining({ code: 'C-NEW', active: true }),
    ]);
    expect((client.invoke.mock.calls[0] as unknown[])[1]).toEqual({
      SolicitudCuis: {
        codigoModalidad: 2,
        codigoPuntoVenta: 1,
        codigoSistema: 'SYS',
        codigoSucursal: 0,
        nit: '1234567',
      },
    });
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'SIAT_CUIS_OBTAINED', userId: 'admin' }),
    );
    expect(JSON.stringify(audit.create.mock.calls)).not.toContain('C-NEW');
  });

  it('does not call SIAT while the stored CUIS is outside the renewal window', async () => {
    const { service, client } = setup({
      stored: [
        { id: 'c1', code: 'C-OLD', valid_until: days(10), active: true },
      ],
    });

    const status = await service.ensureCuis('pos-1');

    expect(status).toMatchObject({
      state: 'alert',
      source: 'stored',
      daysLeft: 10,
    });
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('renews with a fake clock once the CUIS enters the 5-day window', async () => {
    const { service, client, clock, rows, events } = setup({
      stored: [
        { id: 'c1', code: 'C-OLD', valid_until: days(20), active: true },
      ],
    });
    client.invoke.mockResolvedValue(cuisResult('C-NEW', days(385)));

    // 15 days before expiry: alert only.
    clock.set(days(5));
    await service.ensureCuis('pos-1');
    expect(client.invoke).not.toHaveBeenCalled();

    // 5 days before expiry: renewal.
    clock.set(days(15));
    const status = await service.ensureCuis('pos-1');

    expect(client.invoke).toHaveBeenCalledTimes(1);
    expect(status).toMatchObject({
      source: 'siat',
      renewed: true,
      state: 'valid',
    });
    expect(rows).toEqual([
      expect.objectContaining({ code: 'C-OLD', active: false }),
      expect.objectContaining({ code: 'C-NEW', active: true }),
    ]);
    expect(events.emit).toHaveBeenCalledWith(
      SIAT_CUIS_RENEWED_EVENT,
      expect.objectContaining({ pointOfSaleId: 'pos-1' }),
    );
  });

  it('keeps the same code when SIAT answers "CUIS vigente" (transaccion=false with a codigo)', async () => {
    const { service, client, rows, events, audit } = setup({
      stored: [{ id: 'c1', code: 'C-OLD', valid_until: days(3), active: true }],
    });
    client.invoke.mockResolvedValue(cuisResult('C-OLD', days(4), false));

    const status = await service.ensureCuis('pos-1');

    expect(status).toMatchObject({ renewed: false, source: 'siat' });
    expect(rows).toEqual([
      expect.objectContaining({
        code: 'C-OLD',
        active: true,
        valid_until: days(4),
      }),
    ]);
    expect(events.emit).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });

  it('stores the code SIAT returns as "vigente" when we had none (lost response after a timeout)', async () => {
    const { service, client, rows } = setup();
    client.invoke.mockResolvedValue(cuisResult('C-REMOTE', days(200), false));

    await service.ensureCuis('pos-1');

    expect(rows).toEqual([
      expect.objectContaining({ code: 'C-REMOTE', active: true }),
    ]);
  });

  it('keeps a still-valid CUIS when the renewal request fails', async () => {
    const { service, client, rows } = setup({
      stored: [{ id: 'c1', code: 'C-OLD', valid_until: days(2), active: true }],
    });
    client.invoke.mockRejectedValue(
      new SiatUnavailableError('timeout', 'unknown'),
    );

    const status = await service.ensureCuis('pos-1');

    expect(status).toMatchObject({ state: 'renew', renewalFailed: true });
    expect(rows[0]).toMatchObject({ active: true });
  });

  it('throws when SIAT fails and the stored CUIS has expired', async () => {
    const { service, client } = setup({
      stored: [
        { id: 'c1', code: 'C-OLD', valid_until: days(-1), active: true },
      ],
    });
    client.invoke.mockRejectedValue(
      new SiatUnavailableError('down', 'not-sent'),
    );

    await expect(service.ensureCuis('pos-1')).rejects.toBeInstanceOf(
      SiatUnavailableError,
    );
  });

  it('throws SiatRejectedError when SIAT returns no codigo', async () => {
    const { service, client } = setup();
    client.invoke.mockResolvedValue({
      transaccion: false,
      mensajes: [{ codigo: 999, descripcion: 'NIT INACTIVO' }],
      payload: { transaccion: 'false' },
    });

    await expect(service.ensureCuis('pos-1')).rejects.toBeInstanceOf(
      SiatRejectedError,
    );
  });

  it('with force, asks SIAT even when valid, and throws on failure', async () => {
    const { service, client } = setup({
      stored: [
        { id: 'c1', code: 'C-OLD', valid_until: days(300), active: true },
      ],
    });
    client.invoke.mockRejectedValue(
      new SiatUnavailableError('down', 'not-sent'),
    );

    await expect(
      service.ensureCuis('pos-1', { force: true }),
    ).rejects.toBeInstanceOf(SiatUnavailableError);
    expect(client.invoke).toHaveBeenCalledTimes(1);
  });

  it('refuses a closed point of sale', async () => {
    const { service } = setup({ closed: true });

    await expect(service.ensureCuis('pos-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reports missing settings as 409 before calling SIAT', async () => {
    const { service, client, prisma } = setup();
    // Replace credentials with an empty system code.
    (service as unknown as { credentials: unknown }).credentials =
      staticSiatCredentials({
        token: 'tok',
        nit: '1234567',
      });

    await expect(service.ensureCuis('pos-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(client.invoke).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('SiatCodesService.renewDue', () => {
  it('does nothing while SIAT_ENABLED is false', async () => {
    const { service, prisma } = setup({ enabled: false });

    await expect(service.renewDue()).resolves.toEqual({
      renewed: 0,
      alerts: 0,
      failed: 0,
    });
    expect(prisma.siatPointOfSale.findMany).not.toHaveBeenCalled();
  });

  it('only warns inside the alert window', async () => {
    const { service, client } = setup({
      stored: [{ id: 'c1', code: 'C', valid_until: days(12), active: true }],
    });

    await expect(service.renewDue()).resolves.toEqual({
      renewed: 0,
      alerts: 1,
      failed: 0,
    });
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('renews inside the renewal window and counts failures without throwing', async () => {
    const ok = setup({
      stored: [{ id: 'c1', code: 'C', valid_until: days(4), active: true }],
    });
    ok.client.invoke.mockResolvedValue(cuisResult('C2', days(369)));
    await expect(ok.service.renewDue()).resolves.toEqual({
      renewed: 1,
      alerts: 0,
      failed: 0,
    });

    const ko = setup({
      stored: [{ id: 'c1', code: 'C', valid_until: days(-1), active: true }],
    });
    ko.client.invoke.mockRejectedValue(
      new SiatUnavailableError('down', 'not-sent'),
    );
    await expect(ko.service.renewDue()).resolves.toEqual({
      renewed: 0,
      alerts: 0,
      failed: 1,
    });
  });
});
