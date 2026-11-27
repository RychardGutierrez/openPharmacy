import { Prisma } from '@prisma/client';
import type { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { SiatSoapClient } from '../client/siat-soap.client';
import type { SiatResult } from '../client/siat-soap-envelope';
import type { SiatCodesService } from '../codes/siat-codes.service';
import type { SiatTimeSyncService } from '../codes/siat-time-sync.service';
import { fixedSiatClock } from '../codes/siat-clock';
import { SiatCatalogSyncService } from './siat-catalog-sync.service';
import { SIAT_CATALOG_ENTRIES } from './siat-catalogs.registry';

const NOW = new Date('2026-11-26T12:00:00Z');
const PARAMETRIC_TIPO_PUNTO_VENTA = 'sincronizarParametricaTipoPuntoVenta';
const ACTIVITIES = 'sincronizarActividades';

/** Postgres stores a JSON null as SQL NULL; the sentinel never comes back from a read. */
const storable = (value: unknown) => (value === Prisma.JsonNull ? null : value);

interface Where {
  catalog?: string;
  active?: boolean;
  code?: string | { in: string[] };
}

interface Row {
  id: string;
  catalog: string;
  code: string;
  description: string;
  parent_code: string | null;
  extra: unknown;
  active: boolean;
  synced_at: Date;
}

/**
 * Tiny in-memory stand-in for the Prisma calls the sync makes. Enough to check the real write
 * rules (create, update, deactivate, reactivate) across several runs.
 */
function fakeStore() {
  const rows: Row[] = [];
  const syncs = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const matches = (row: Row, where: Where) =>
    (where.catalog === undefined || row.catalog === where.catalog) &&
    (where.active === undefined || row.active === where.active) &&
    (where.code === undefined ||
      (typeof where.code === 'string'
        ? row.code === where.code
        : where.code.in.includes(row.code)));

  const tx = {
    $executeRaw: jest.fn(() => Promise.resolve(0)),
    siatCatalogItem: {
      findMany: jest.fn(({ where }: { where: Where }) =>
        Promise.resolve(rows.filter((row) => matches(row, where))),
      ),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
          const row = rows.find((r) => r.id === where.id)!;
          Object.assign(row, { ...data, extra: storable(data.extra) });
          return Promise.resolve(row);
        },
      ),
      updateMany: jest.fn(
        ({ where, data }: { where: Where; data: Partial<Row> }) => {
          const hit = rows.filter((row) => matches(row, where));
          hit.forEach((row) =>
            Object.assign(row, { ...data, extra: storable(data.extra) }),
          );
          return Promise.resolve({ count: hit.length });
        },
      ),
      createMany: jest.fn(({ data }: { data: Omit<Row, 'id'>[] }) => {
        data.forEach((item) =>
          rows.push({
            ...item,
            extra: storable(item.extra),
            id: `row-${++seq}`,
          }),
        );
        return Promise.resolve({ count: data.length });
      }),
    },
    siatCatalogSync: {
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { catalog: string };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          const current = syncs.get(where.catalog);
          syncs.set(
            where.catalog,
            current ? { ...current, ...update } : create,
          );
          return Promise.resolve(syncs.get(where.catalog));
        },
      ),
    },
  };

  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    siatPointOfSale: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 'pos-0',
          codigo_punto_venta: 0,
          branch: { codigo_sucursal: 0 },
        }),
      ),
    },
  };
  return { prisma, rows, syncs };
}

function ok(payload: Record<string, unknown>): SiatResult {
  return { transaccion: true, mensajes: [], payload };
}

const POS_TYPES_V1 = [
  { codigoClasificador: 2, descripcion: 'VENTANILLA' },
  { codigoClasificador: 5, descripcion: 'CAJEROS' },
];

describe('SiatCatalogSyncService', () => {
  function setup(responses: Record<string, () => SiatResult | Error>) {
    const store = fakeStore();
    const client = {
      invoke: jest.fn((operation: { name: string }) => {
        const response = responses[operation.name];
        if (!response) return Promise.resolve(ok({ listaCodigos: [] }));
        const result = response();
        return result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result);
      }),
    };
    const codes = {
      identity: jest.fn(() =>
        Promise.resolve({
          nit: '1234567',
          codigoSistema: 'SYS',
          codigoModalidad: 2,
        }),
      ),
      cuisCode: jest.fn(() => Promise.resolve('CUIS-1')),
    };
    const timeSync = {
      syncTime: jest.fn(() =>
        Promise.resolve({
          accepted: true,
          offsetMs: 0,
          rttMs: 1,
          sampledAt: NOW,
          siatTime: NOW,
        }),
      ),
    };
    const audit = { create: jest.fn(() => Promise.resolve()) };
    const service = new SiatCatalogSyncService(
      store.prisma as unknown as PrismaService,
      client as unknown as SiatSoapClient,
      codes as unknown as SiatCodesService,
      timeSync as unknown as SiatTimeSyncService,
      audit as unknown as AuditLogRepository,
      fixedSiatClock(NOW),
    );
    return { service, store, client, audit };
  }

  it('first sync adds every code; running it again with the same content changes nothing', async () => {
    const { service, store } = setup({
      [PARAMETRIC_TIPO_PUNTO_VENTA]: () => ok({ listaCodigos: POS_TYPES_V1 }),
    });

    const first = await service.syncCatalog('pos-types');
    expect(first).toMatchObject({
      status: 'synced',
      added: 2,
      updated: 0,
      deactivated: 0,
      total: 2,
    });

    const itemsBefore = store.rows.map((r) => ({ ...r }));
    const second = await service.syncCatalog('pos-types');
    expect(second).toMatchObject({
      status: 'synced',
      added: 0,
      updated: 0,
      reactivated: 0,
      deactivated: 0,
      total: 2,
    });
    expect(store.rows).toEqual(itemsBefore);
  });

  it('deactivates a code that left the SIN list and reactivates it when it returns', async () => {
    let list = POS_TYPES_V1;
    const { service, store } = setup({
      [PARAMETRIC_TIPO_PUNTO_VENTA]: () => ok({ listaCodigos: list }),
    });
    await service.syncCatalog('pos-types');

    list = [POS_TYPES_V1[0]];
    const gone = await service.syncCatalog('pos-types');
    expect(gone).toMatchObject({ deactivated: 1, total: 1 });
    expect(store.rows.find((r) => r.code === '5')?.active).toBe(false);

    list = POS_TYPES_V1;
    const back = await service.syncCatalog('pos-types');
    expect(back).toMatchObject({ reactivated: 1, total: 2 });
    expect(store.rows.find((r) => r.code === '5')?.active).toBe(true);
  });

  it('counts a changed description as an update, not an addition', async () => {
    let list = POS_TYPES_V1;
    const { service } = setup({
      [PARAMETRIC_TIPO_PUNTO_VENTA]: () => ok({ listaCodigos: list }),
    });
    await service.syncCatalog('pos-types');

    list = [
      { codigoClasificador: 2, descripcion: 'VENTANILLA NUEVA' },
      POS_TYPES_V1[1],
    ];
    expect(await service.syncCatalog('pos-types')).toMatchObject({
      added: 0,
      updated: 1,
      deactivated: 0,
    });
  });

  it('keeps the active codes when SIAT refuses the request (transaccion=false)', async () => {
    let refuse = false;
    const { service, store } = setup({
      [PARAMETRIC_TIPO_PUNTO_VENTA]: () =>
        refuse
          ? {
              transaccion: false,
              mensajes: [{ codigo: 999, descripcion: 'NO' }],
              payload: {},
            }
          : ok({ listaCodigos: POS_TYPES_V1 }),
    });
    await service.syncCatalog('pos-types');

    refuse = true;
    const result = await service.syncCatalog('pos-types');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('999');
    expect(store.rows.filter((r) => r.active)).toHaveLength(2);
    expect(store.syncs.get(PARAMETRIC_TIPO_PUNTO_VENTA)?.last_error).toContain(
      '999',
    );
  });

  it('keeps the active codes when SIAT answers an empty list', async () => {
    let empty = false;
    const { service, store } = setup({
      [PARAMETRIC_TIPO_PUNTO_VENTA]: () =>
        ok({ listaCodigos: empty ? [] : POS_TYPES_V1 }),
    });
    await service.syncCatalog('pos-types');

    empty = true;
    const result = await service.syncCatalog('pos-types');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('empty list');
    expect(store.rows.filter((r) => r.active)).toHaveLength(2);
  });

  it('a failing catalog does not stop the others in syncAll', async () => {
    const { service, store } = setup({
      [ACTIVITIES]: () => new Error('connection reset'),
      [PARAMETRIC_TIPO_PUNTO_VENTA]: () => ok({ listaCodigos: POS_TYPES_V1 }),
    });

    const summary = await service.syncAll();
    expect(summary.catalogs).toHaveLength(SIAT_CATALOG_ENTRIES.length);
    const activities = summary.catalogs.find((c) => c.slug === 'activities');
    const posTypes = summary.catalogs.find((c) => c.slug === 'pos-types');
    expect(activities).toMatchObject({
      status: 'failed',
      error: 'connection reset',
    });
    expect(posTypes).toMatchObject({ status: 'synced', total: 2 });
    expect(store.rows.some((r) => r.catalog === ACTIVITIES)).toBe(false);
  });

  it('keeps the same code under different catalogs apart', async () => {
    const { service, store } = setup({
      [PARAMETRIC_TIPO_PUNTO_VENTA]: () => ok({ listaCodigos: POS_TYPES_V1 }),
      [ACTIVITIES]: () =>
        ok({ listaActividades: { codigoCaeb: 2, descripcion: 'OTRA' } }),
    });
    await service.syncCatalog('pos-types');
    await service.syncCatalog('activities');
    expect(store.rows.filter((r) => r.code === '2')).toHaveLength(2);
  });

  it('syncNow audits the summary, not the codes', async () => {
    const { service, audit } = setup({
      [PARAMETRIC_TIPO_PUNTO_VENTA]: () => ok({ listaCodigos: POS_TYPES_V1 }),
    });
    await service.syncNow({ catalog: 'pos-types', userId: 'admin-1' });
    expect(audit.create).toHaveBeenCalledWith({
      userId: 'admin-1',
      event: 'SIAT_CATALOGS_SYNCED',
      metadata: { catalog: 'pos-types', synced: 1, failed: 0 },
    });
  });
});
