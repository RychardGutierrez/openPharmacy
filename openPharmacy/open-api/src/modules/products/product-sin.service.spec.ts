import { ProductCategory } from '@prisma/client';
import { ProductSinService, type HomologationProduct } from './product-sin.service';
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

function setup(
  options: {
    siatEnabled?: boolean;
    defaultCategories?: ProductCategory[];
    catalogSynced?: boolean;
    validationFailures?: { field: 'sinActivityCode' | 'sinProductCode' | 'sinUnitCode'; code: string }[];
  } = {},
) {
  const config = {
    getStoredValues: jest
      .fn()
      .mockResolvedValue({ SIAT_ENABLED: options.siatEnabled ?? true }),
  };
  const catalogs = {
    hasActiveCodes: jest.fn().mockResolvedValue(options.catalogSynced ?? true),
    validateSinCodes: jest.fn().mockResolvedValue(options.validationFailures ?? []),
  };
  const tx = {
    productSinDefault: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (options.defaultCategories ?? []).map((category) => ({ category })),
        ),
    },
  };
  const service = new ProductSinService(
    {} as never,
    { createInTx: jest.fn() } as never,
    config as never,
    catalogs as never,
  );
  return { service, config, catalogs, tx };
}

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
    ).toEqual({ activityCode: '47730', productCode: '6150031', unitCode: '58' });
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
  const codes = { activityCode: '47730', productCode: '6150031', unitCode: '58' };

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
