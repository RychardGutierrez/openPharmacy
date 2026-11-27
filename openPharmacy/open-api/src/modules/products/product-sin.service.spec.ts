import { ProductCategory } from '@prisma/client';
import {
  ProductSinService,
  type HomologationProduct,
} from './product-sin.service';
import {
  IncompleteSinCodesException,
  InvalidSinCodesException,
} from './exceptions/invalid-sin-codes.exception';
import { ProductNotHomologatedException } from '../sales/exceptions/product-not-homologated.exception';

const product = (
  overrides: Partial<HomologationProduct> = {},
): HomologationProduct => ({
  id: 'p-1',
  commercial_name: 'Tylenol',
  category: ProductCategory.OTC,
  sin_activity_code: null,
  sin_product_code: null,
  sin_unit_code: null,
  ...overrides,
});

const coded = {
  sin_activity_code: '47730',
  sin_product_code: '6150031',
  sin_unit_code: '58',
};

const defaultRow = (
  category: ProductCategory,
  codes: Partial<typeof coded> = {},
) => ({ category, ...coded, ...codes });

function setup(
  options: {
    siatEnabled?: boolean;
    defaultCategories?: ProductCategory[];
    defaults?: ReturnType<typeof defaultRow>[];
    catalogSynced?: boolean;
    validationFailures?: {
      field: 'sinActivityCode' | 'sinProductCode' | 'sinUnitCode';
      code: string;
    }[];
    activeCodes?: {
      activities?: string[];
      products?: string[];
      units?: string[];
    };
    codedProducts?: unknown[];
    affected?: unknown[];
  } = {},
) {
  const config = {
    getStoredValues: jest
      .fn()
      .mockResolvedValue({ SIAT_ENABLED: options.siatEnabled ?? true }),
  };
  const active = {
    activities: ['47730'],
    products: ['47730:6150031'],
    units: ['58'],
    ...options.activeCodes,
  };
  const catalogs = {
    hasActiveCodes: jest.fn().mockResolvedValue(options.catalogSynced ?? true),
    validateSinCodes: jest
      .fn()
      .mockResolvedValue(options.validationFailures ?? []),
    activeCodeSet: jest.fn((slug: keyof typeof active) =>
      Promise.resolve(new Set(active[slug])),
    ),
  };
  const defaults =
    options.defaults ??
    (options.defaultCategories ?? []).map((category) => defaultRow(category));
  const tx = {
    productSinDefault: {
      findMany: jest.fn().mockResolvedValue(defaults),
      findUnique: jest.fn(
        ({ where }: { where: { category: ProductCategory } }) =>
          Promise.resolve(
            defaults.find((row) => row.category === where.category) ?? null,
          ),
      ),
      upsert: jest.fn().mockResolvedValue({}),
    },
    product: {
      findMany: jest.fn().mockResolvedValue(options.affected ?? []),
      updateMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve({ count: where.id.in.length }),
      ),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const prisma = {
    productSinDefault: tx.productSinDefault,
    product: {
      ...tx.product,
      findMany: jest.fn().mockResolvedValue(options.codedProducts ?? []),
    },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { createInTx: jest.fn() };
  const service = new ProductSinService(
    prisma as never,
    audit as never,
    config as never,
    catalogs as never,
  );
  return { service, config, catalogs, tx, prisma, audit };
}

/** The `where.AND` scope of the first product lookup made inside the transaction. */
const firstScope = (mock: jest.Mock): unknown[] =>
  (mock.mock.calls[0] as [{ where: { AND: unknown[] } }])[0].where.AND;

/** The "codes incomplete" filter the service adds when it must not overwrite. */
const INCOMPLETE_FILTER = { OR: expect.any(Array) as unknown };

/** The first audit record written. */
const firstAudit = (mock: jest.Mock) =>
  (
    mock.mock.calls[0] as [
      unknown,
      { event: string; metadata: Record<string, unknown> },
    ]
  )[1];

describe('ProductSinService.resolveComplete', () => {
  it('returns null when no code is set', () => {
    expect(ProductSinService.resolveComplete({})).toBeNull();
    expect(
      ProductSinService.resolveComplete({
        sinActivityCode: null,
        sinProductCode: null,
        sinUnitCode: null,
      }),
    ).toBeNull();
  });

  it('returns the codes when all three are set', () => {
    expect(
      ProductSinService.resolveComplete({
        sinActivityCode: '47730',
        sinProductCode: '6150031',
        sinUnitCode: '58',
      }),
    ).toEqual({
      activityCode: '47730',
      productCode: '6150031',
      unitCode: '58',
    });
  });

  it('rejects a partial set and names the missing fields', () => {
    expect(() =>
      ProductSinService.resolveComplete({
        sinActivityCode: '47730',
        sinProductCode: null,
        sinUnitCode: undefined,
      }),
    ).toThrow(IncompleteSinCodesException);
  });
});

describe('ProductSinService.validateCodes', () => {
  const codes = {
    activityCode: '47730',
    productCode: '6150031',
    unitCode: '58',
  };

  it('skips the catalog check until the activities catalog is synchronized', async () => {
    const { service, catalogs } = setup({ catalogSynced: false });
    await service.validateCodes(codes);
    expect(catalogs.validateSinCodes).not.toHaveBeenCalled();
  });

  it('throws 422 with the failing fields when a code is not active in the catalog', async () => {
    const { service } = setup({
      validationFailures: [{ field: 'sinProductCode', code: '6150031' }],
    });
    await expect(service.validateCodes(codes)).rejects.toBeInstanceOf(
      InvalidSinCodesException,
    );
  });
});

describe('ProductSinService.assertSalable (sale guard)', () => {
  it('lets everything through while SIAT is disabled', async () => {
    const { service, tx } = setup({ siatEnabled: false });
    await expect(
      service.assertSalable([product()], tx as never),
    ).resolves.toBeUndefined();
  });

  it('blocks a product with no codes and no category default while SIAT is enabled', async () => {
    const { service, tx } = setup({ siatEnabled: true });
    await expect(
      service.assertSalable([product()], tx as never),
    ).rejects.toBeInstanceOf(ProductNotHomologatedException);
  });

  it('allows a product that carries its own complete codes', async () => {
    const { service, tx } = setup({ siatEnabled: true });
    await expect(
      service.assertSalable([product(coded)], tx as never),
    ).resolves.toBeUndefined();
  });

  it('allows a product whose category has a default', async () => {
    const { service, tx } = setup({
      siatEnabled: true,
      defaultCategories: [ProductCategory.OTC],
    });
    await expect(
      service.assertSalable([product()], tx as never),
    ).resolves.toBeUndefined();
  });

  it('does not treat a partial set of own codes as homologated', async () => {
    const { service, tx } = setup({ siatEnabled: true });
    await expect(
      service.assertSalable(
        [product({ sin_activity_code: '47730' })],
        tx as never,
      ),
    ).rejects.toBeInstanceOf(ProductNotHomologatedException);
  });
});

describe('ProductSinService.resolveEffective', () => {
  it('prefers the own codes, falls back to the category default, and skips the rest', async () => {
    const { service, tx } = setup({
      defaults: [defaultRow(ProductCategory.OTC, { sin_unit_code: '62' })],
    });
    const resolved = await service.resolveEffective(
      [
        product({ id: 'own', ...coded }),
        product({ id: 'default' }),
        product({ id: 'none', category: ProductCategory.PRESCRIPTION_ONLY }),
      ],
      tx as never,
    );
    expect(resolved.get('own')).toEqual({
      activityCode: '47730',
      productCode: '6150031',
      unitCode: '58',
    });
    expect(resolved.get('default')?.unitCode).toBe('62');
    expect(resolved.has('none')).toBe(false);
  });
});

describe('ProductSinService.invalidCodes', () => {
  const stored = (id: string, codes: Partial<typeof coded>) => ({
    id,
    commercial_name: id,
    category: ProductCategory.OTC,
    ...coded,
    ...codes,
  });

  it('reports nothing until the activities catalog is synchronized', async () => {
    const { service, catalogs } = setup({ catalogSynced: false });
    expect(await service.invalidCodes()).toEqual({
      catalogSynced: false,
      products: [],
      defaults: [],
    });
    expect(catalogs.activeCodeSet).not.toHaveBeenCalled();
  });

  it('lists products and defaults whose codes left the catalogs, with the failing fields', async () => {
    const { service } = setup({
      codedProducts: [
        stored('ok', {}),
        stored('gone-unit', { sin_unit_code: '99' }),
        // A valid product code, but filed under another activity.
        stored('other-activity', { sin_activity_code: '11111' }),
      ],
      defaults: [
        defaultRow(ProductCategory.PRESCRIPTION_ONLY, {
          sin_product_code: '000',
        }),
      ],
    });
    const report = await service.invalidCodes();
    expect(report.catalogSynced).toBe(true);
    expect(report.products.map((p) => [p.id, p.invalidFields])).toEqual([
      ['gone-unit', ['sinUnitCode']],
      ['other-activity', ['sinActivityCode', 'sinProductCode']],
    ]);
    expect(report.defaults).toEqual([
      expect.objectContaining({
        category: ProductCategory.PRESCRIPTION_ONLY,
        invalidFields: ['sinProductCode'],
      }),
    ]);
  });
});

describe('ProductSinService.summary', () => {
  it('adds the invalid counts to the progress numbers', async () => {
    const { service, prisma } = setup({
      codedProducts: [
        {
          id: 'x',
          commercial_name: 'x',
          category: ProductCategory.OTC,
          ...coded,
          sin_unit_code: '99',
        },
      ],
    });
    prisma.product.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(4); // pending
    expect(await service.summary()).toEqual({
      total: 10,
      homologated: 6,
      pending: 4,
      invalid: 1,
      invalidDefaults: 0,
    });
  });

  it('excludes the categories with a default from the pending filter', async () => {
    const { service } = setup({ defaultCategories: [ProductCategory.OTC] });
    const where = await service.pendingWhere();
    expect(where.category).toEqual({ notIn: [ProductCategory.OTC] });
  });
});

describe('ProductSinService.bulkAssign', () => {
  const codes = {
    activityCode: '47730',
    productCode: '6150031',
    unitCode: '58',
  };

  it('requires products or a category', async () => {
    const { service } = setup();
    await expect(service.bulkAssign({ codes }, 'u-1')).rejects.toMatchObject({
      response: { code: 'SIN_SCOPE_REQUIRED' },
    });
  });

  it('rejects codes that are not in the catalogs before writing', async () => {
    const { service, tx } = setup({
      validationFailures: [{ field: 'sinUnitCode', code: '58' }],
    });
    await expect(
      service.bulkAssign({ codes, category: ProductCategory.OTC }, 'u-1'),
    ).rejects.toBeInstanceOf(InvalidSinCodesException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('only touches incomplete products unless overwrite is set', async () => {
    const { service, tx } = setup();
    await service.bulkAssign({ codes, category: ProductCategory.OTC }, 'u-1');
    const scope = firstScope(tx.product.findMany);
    expect(scope).toContainEqual(INCOMPLETE_FILTER);

    tx.product.findMany.mockClear();
    await service.bulkAssign(
      { codes, category: ProductCategory.OTC, overwrite: true },
      'u-1',
    );
    const overwriteScope = firstScope(tx.product.findMany);
    expect(overwriteScope).not.toContainEqual(INCOMPLETE_FILTER);
  });

  it('audits each affected product with its previous codes', async () => {
    const { service, tx, audit } = setup({
      affected: [
        {
          id: 'a',
          sin_activity_code: null,
          sin_product_code: null,
          sin_unit_code: null,
        },
        { id: 'b', ...coded, sin_unit_code: '62' },
      ],
    });
    const result = await service.bulkAssign(
      { codes, productIds: ['a', 'b'], overwrite: true },
      'u-1',
    );
    expect(result).toEqual({ updated: 2 });
    expect(tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['a', 'b'] } } }),
    );
    const record = firstAudit(audit.createInTx);
    expect(record.event).toBe('PRODUCT_SIN_CODES_BULK_ASSIGNED');
    expect(record.metadata.products).toEqual([
      {
        id: 'a',
        previous: { activityCode: null, productCode: null, unitCode: null },
      },
      {
        id: 'b',
        previous: {
          activityCode: '47730',
          productCode: '6150031',
          unitCode: '62',
        },
      },
    ]);
  });

  it('writes nothing and no audit row when no product matches', async () => {
    const { service, tx, audit } = setup({ affected: [] });
    expect(
      await service.bulkAssign({ codes, category: ProductCategory.OTC }, 'u-1'),
    ).toEqual({ updated: 0 });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(audit.createInTx).not.toHaveBeenCalled();
  });
});

describe('ProductSinService category defaults', () => {
  const codes = {
    activityCode: '47730',
    productCode: '6150031',
    unitCode: '58',
  };

  it('validates and audits a new default', async () => {
    const { service, tx, audit } = setup();
    await service.upsertDefault(ProductCategory.OTC, codes, 'u-1');
    expect(tx.productSinDefault.upsert).toHaveBeenCalled();
    expect(firstAudit(audit.createInTx).event).toBe(
      'PRODUCT_SIN_DEFAULT_UPDATED',
    );
  });

  it('refuses an invalid default', async () => {
    const { service, tx } = setup({
      validationFailures: [{ field: 'sinActivityCode', code: '47730' }],
    });
    await expect(
      service.upsertDefault(ProductCategory.OTC, codes, 'u-1'),
    ).rejects.toBeInstanceOf(InvalidSinCodesException);
    expect(tx.productSinDefault.upsert).not.toHaveBeenCalled();
  });

  it('answers 409 when applying a category without a default', async () => {
    const { service } = setup();
    await expect(
      service.applyDefault(ProductCategory.OTC, 'u-1'),
    ).rejects.toMatchObject({ response: { code: 'SIN_DEFAULT_NOT_SET' } });
  });

  it('copies the default onto incomplete products only', async () => {
    const { service, tx } = setup({
      defaultCategories: [ProductCategory.OTC],
      affected: [
        {
          id: 'a',
          sin_activity_code: null,
          sin_product_code: null,
          sin_unit_code: null,
        },
      ],
    });
    expect(await service.applyDefault(ProductCategory.OTC, 'u-1')).toEqual({
      updated: 1,
    });
    const scope = firstScope(tx.product.findMany);
    expect(scope).toContainEqual({ category: ProductCategory.OTC });
    expect(scope).toContainEqual(INCOMPLETE_FILTER);
  });
});
