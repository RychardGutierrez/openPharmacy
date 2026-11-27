import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConfigService as PharmacyConfigService } from '../../config/config.service';
import type { OffsetSiatClock } from '../codes/siat-offset-clock';
import { SiatCatalogsService } from './siat-catalogs.service';

interface Item {
  catalog: string;
  code: string;
  description: string;
  parent_code: string | null;
  active: boolean;
}

/** Builds the service over a set of catalog rows. Only the queries the read paths make. */
function setup(items: Item[], defaultActivity: string | null = '47730') {
  const matches = (row: Item, where: Partial<Item>) =>
    (where.catalog === undefined || row.catalog === where.catalog) &&
    (where.code === undefined || row.code === where.code) &&
    (where.active === undefined || row.active === where.active) &&
    (where.parent_code === undefined || row.parent_code === where.parent_code);

  const prisma = {
    siatCatalogItem: {
      findMany: jest.fn(({ where }: { where: Partial<Item> }) =>
        Promise.resolve(items.filter((row) => matches(row, where))),
      ),
      count: jest.fn(({ where }: { where: Partial<Item> }) =>
        Promise.resolve(items.filter((row) => matches(row, where)).length),
      ),
      groupBy: jest.fn(() => {
        const counts = new Map<string, number>();
        items
          .filter((row) => row.active)
          .forEach((row) =>
            counts.set(row.catalog, (counts.get(row.catalog) ?? 0) + 1),
          );
        return Promise.resolve(
          [...counts].map(([catalog, n]) => ({ catalog, _count: { _all: n } })),
        );
      }),
    },
    siatCatalogSync: { findMany: jest.fn(() => Promise.resolve([])) },
    $transaction: jest.fn((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
  };
  const settings = {
    getStoredValues: jest.fn(() =>
      Promise.resolve({ SIAT_DEFAULT_ACTIVITY: defaultActivity }),
    ),
  };
  const clock = {
    status: jest.fn(() => ({
      offsetMs: 0,
      sampledAt: null,
      stale: true,
      warning: false,
    })),
  };
  const service = new SiatCatalogsService(
    prisma as unknown as PrismaService,
    settings as unknown as PharmacyConfigService,
    clock as unknown as OffsetSiatClock,
  );
  return { service };
}

const ACTIVITIES = 'sincronizarActividades';
const LEGENDS = 'sincronizarListaLeyendasFactura';
const ACTIVITY_DOC_SECTORS = 'sincronizarListaActividadesDocumentoSector';
const POS_TYPES = 'sincronizarParametricaTipoPuntoVenta';
const PAYMENT_METHODS = 'sincronizarParametricaTipoMetodoPago';

const row = (
  catalog: string,
  code: string,
  description: string,
  parent: string | null = null,
  active = true,
): Item => ({
  catalog,
  code,
  description,
  parent_code: parent,
  active,
});

/** Every emission-required catalog with one active code, and a complete default activity. */
function readyItems(): Item[] {
  const required = [
    'sincronizarParametricaTipoDocumentoIdentidad',
    'sincronizarParametricaTipoDocumentoSector',
    'sincronizarParametricaTipoEmision',
    'sincronizarParametricaTiposFactura',
    PAYMENT_METHODS,
    'sincronizarParametricaTipoMoneda',
    'sincronizarParametricaUnidadMedida',
  ];
  return [
    row(ACTIVITIES, '47730', 'Farmacia'),
    row(LEGENDS, '47730:aa', 'Ley 453', '47730'),
    row(ACTIVITY_DOC_SECTORS, '47730:1', 'FACTURA', '47730'),
    ...required.map((catalog) => row(catalog, '1', 'X')),
  ];
}

describe('SiatCatalogsService.pointOfSaleTypes', () => {
  it('excludes comisionista, which uses another operation', async () => {
    const { service } = setup([
      row(POS_TYPES, '1', 'COMISIONISTA'),
      row(POS_TYPES, '2', 'VENTANILLA'),
      row(POS_TYPES, '5', 'CAJEROS', null, false),
    ]);
    expect(await service.pointOfSaleTypes()).toEqual([
      { codigo: 2, descripcion: 'VENTANILLA' },
    ]);
  });

  it('answers 409 until the catalog has been synchronized', async () => {
    const { service } = setup([]);
    await expect(service.pointOfSaleTypes()).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('SiatCatalogsService.assertReadyForEmission', () => {
  it('passes when every required catalog and the default activity are complete', async () => {
    const { service } = setup(readyItems());
    await expect(service.assertReadyForEmission()).resolves.toBeUndefined();
  });

  it('lists the missing catalogs when emission is blocked', async () => {
    const items = readyItems().filter(
      (item) => item.catalog !== 'sincronizarParametricaTipoMoneda',
    );
    const { service } = setup(items);
    await expect(service.assertReadyForEmission()).rejects.toMatchObject({
      response: {
        code: 'SIAT_CATALOGS_MISSING',
        missing: ['currencies'],
      },
    });
  });

  it('requires a legend for the default activity', async () => {
    const { service } = setup(
      readyItems().filter((item) => item.catalog !== LEGENDS),
    );
    await expect(service.assertReadyForEmission()).rejects.toMatchObject({
      // The empty legends catalog and the activity with none.
      response: {
        missing: ['legends', 'legends:47730'],
      },
    });
  });

  it('requires a default activity to be configured', async () => {
    const { service } = setup(readyItems(), null);
    await expect(service.assertReadyForEmission()).rejects.toMatchObject({
      response: { missing: ['defaultActivity'] },
    });
  });
});

describe('SiatCatalogsService.randomLegend', () => {
  it('returns null when the activity has no active legend', async () => {
    const { service } = setup([]);
    expect(await service.randomLegend('47730')).toBeNull();
  });

  it('picks one of the active legends of the activity only', async () => {
    const { service } = setup([
      row(LEGENDS, '47730:aa', 'A', '47730'),
      row(LEGENDS, '47730:bb', 'B', '47730'),
      row(LEGENDS, '99999:cc', 'C', '99999'),
    ]);
    const legend = await service.randomLegend('47730');
    expect(['A', 'B']).toContain(legend?.description);
  });
});

describe('SiatCatalogsService.list', () => {
  it('hides non-public catalogs from non-admin roles', async () => {
    const { service } = setup([]);
    await expect(
      service.list('activities', {}, UserRole.CASHIER),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it('lets every role read a public catalog', async () => {
    const { service } = setup([row(PAYMENT_METHODS, '1', 'EFECTIVO')]);
    const page = await service.list('payment-methods', {}, UserRole.CASHIER);
    expect(page.items).toEqual([
      {
        code: '1',
        parentCode: null,
        description: 'EFECTIVO',
        extra: undefined,
        active: true,
      },
    ]);
  });
});
