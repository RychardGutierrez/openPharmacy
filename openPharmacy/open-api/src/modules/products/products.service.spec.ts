/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Product, ProductCategory } from '@prisma/client';
import { ProductsService } from './products.service';
import { ProductSinService } from './product-sin.service';
import { ProductsRepository } from './repositories/products.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DuplicateBarcodeException } from './exceptions/duplicate-barcode.exception';
import { ProductNotFoundException } from './exceptions/product-not-found.exception';
import { CreateProductDto } from './dto/create-product.dto';
import { InvalidSinCodesException } from './exceptions/invalid-sin-codes.exception';

const mockProduct = (
  overrides: Partial<Record<keyof Product, unknown>> = {},
): Product =>
  ({
    id: 'p-1',
    dci_name: 'Paracetamol',
    commercial_name: 'Tylenol',
    laboratory: 'PharmaCo',
    form: 'Tablet',
    concentration: '500mg',
    barcode: '7501234567890',
    category: ProductCategory.OTC,
    sale_price: 12.5 as unknown as Product['sale_price'],
    min_sale_price: 8.0 as unknown as Product['min_sale_price'],
    min_stock: 10,
    active: true,
    deleted_at: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as Product;

const mockTx = {
  productPriceHistory: {
    create: jest.fn().mockResolvedValue({}),
  },
  product: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
};

const CSV_HEADER =
  'dciName,commercialName,laboratory,form,concentration,barcode,category,salePrice,minSalePrice,minStock,sinActivityCode,sinProductCode,sinUnitCode';
const csvFile = (...rows: string[]) =>
  ({
    originalname: 'products.csv',
    buffer: Buffer.from([CSV_HEADER, ...rows].join('\n')),
  }) as Express.Multer.File;

describe('ProductsService', () => {
  let service: ProductsService;
  let products: jest.Mocked<ProductsRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let audit: jest.Mocked<AuditLogRepository>;
  let module: TestingModule;

  beforeEach(async () => {
    products = {
      createTx: jest.fn(),
      updateTx: jest.fn(),
      softDeleteTx: jest.fn(),
      restoreTx: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      findAllPaginated: jest.fn(),
      searchAutocomplete: jest.fn(),
      findByBarcode: jest.fn(),
      findByBarcodeExcept: jest.fn(),
    } as unknown as jest.Mocked<ProductsRepository>;

    prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockTx),
      ),
      productPriceHistory: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as jest.Mocked<PrismaService>;

    eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventEmitter2>;

    audit = {
      createInTx: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogRepository>;

    module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: products },
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: AuditLogRepository, useValue: audit },
        {
          provide: ProductSinService,
          useValue: { validateCodes: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates an OTC product and emits product.created', async () => {
      const dto: CreateProductDto = {
        dciName: 'Paracetamol',
        commercialName: 'Tylenol',
        laboratory: 'PharmaCo',
        form: 'Tablet',
        concentration: '500mg',
        barcode: '7501234567890',
        category: ProductCategory.OTC,
        salePrice: 12.5,
        minSalePrice: 8.0,
        minStock: 10,
      };
      const created = mockProduct({ barcode: dto.barcode });

      products.findByBarcode.mockResolvedValue(null);
      products.createTx.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result.barcode).toBe(dto.barcode);
      expect(result.category).toBe(ProductCategory.OTC);
      expect(products.createTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          dci_name: dto.dciName,
          commercial_name: dto.commercialName,
          barcode: dto.barcode,
          category: dto.category,
        }),
      );
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'PRODUCT_CREATED' }),
      );
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'product.created',
        expect.objectContaining({ productId: 'p-1' }),
      );
    });

    it('throws DuplicateBarcodeException when barcode already exists', async () => {
      products.findByBarcode.mockResolvedValue(mockProduct());

      await expect(
        service.create({
          dciName: 'X',
          commercialName: 'Y',
          barcode: '7501234567890',
          category: ProductCategory.OTC,
          salePrice: 1,
          minSalePrice: 0.5,
          minStock: 0,
        }),
      ).rejects.toThrow(DuplicateBarcodeException);
    });
  });

  describe('findOne', () => {
    it('returns a product when found', async () => {
      products.findByIdIncludingDeleted.mockResolvedValue(mockProduct());

      const result = await service.findOne('p-1');

      expect(result.id).toBe('p-1');
    });

    it('throws ProductNotFoundException when not found', async () => {
      products.findByIdIncludingDeleted.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        ProductNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates a product when barcode is unchanged', async () => {
      const existing = mockProduct({ id: 'p-1', barcode: '7501234567890' });
      products.findByIdIncludingDeleted.mockResolvedValue(existing);
      products.updateTx.mockResolvedValue({
        ...existing,
        commercial_name: 'Tylenol Extra',
      });

      const result = await service.update('p-1', {
        commercialName: 'Tylenol Extra',
      });

      expect(result.commercialName).toBe('Tylenol Extra');
      expect(products.findByBarcodeExcept).not.toHaveBeenCalled();
    });

    it('throws DuplicateBarcodeException when new barcode is taken', async () => {
      const existing = mockProduct({ id: 'p-1', barcode: '7501234567890' });
      products.findByIdIncludingDeleted.mockResolvedValue(existing);
      products.findByBarcodeExcept.mockResolvedValue(
        mockProduct({ id: 'p-2' }),
      );

      await expect(
        service.update('p-1', { barcode: '7509999999999' }),
      ).rejects.toThrow(DuplicateBarcodeException);
    });

    it('throws ProductNotFoundException when product does not exist', async () => {
      products.findByIdIncludingDeleted.mockResolvedValue(null);

      await expect(service.update('missing', {})).rejects.toThrow(
        ProductNotFoundException,
      );
    });

    describe('SIN codes (SIAT-08)', () => {
      const stored = {
        sin_activity_code: '47730',
        sin_product_code: '6150031',
        sin_unit_code: '58',
      };

      it('audits a code change with the previous and new codes', async () => {
        const existing = mockProduct(stored);
        products.findByIdIncludingDeleted.mockResolvedValue(existing);
        products.updateTx.mockResolvedValue(
          mockProduct({ ...stored, sin_unit_code: '62' }),
        );

        await service.update('p-1', { sinUnitCode: '62' }, undefined, 'u-1');

        expect(audit.createInTx).toHaveBeenCalledWith(
          mockTx,
          expect.objectContaining({
            event: 'PRODUCT_SIN_CODES_UPDATED',
            userId: 'u-1',
            metadata: {
              productId: 'p-1',
              before: {
                activityCode: '47730',
                productCode: '6150031',
                unitCode: '58',
              },
              after: {
                activityCode: '47730',
                productCode: '6150031',
                unitCode: '62',
              },
            },
          }),
        );
      });

      it('validates the merged set when only one code is sent', async () => {
        const sin = module.get(ProductSinService);
        products.findByIdIncludingDeleted.mockResolvedValue(
          mockProduct(stored),
        );
        products.updateTx.mockResolvedValue(mockProduct(stored));

        await service.update('p-1', { sinUnitCode: '62' });

        expect(sin.validateCodes).toHaveBeenCalledWith({
          activityCode: '47730',
          productCode: '6150031',
          unitCode: '62',
        });
      });

      it('does not write a SIN audit row when the codes are unchanged', async () => {
        products.findByIdIncludingDeleted.mockResolvedValue(
          mockProduct(stored),
        );
        products.updateTx.mockResolvedValue(mockProduct(stored));

        await service.update('p-1', { sinUnitCode: '58', commercialName: 'X' });

        expect(audit.createInTx).not.toHaveBeenCalledWith(
          mockTx,
          expect.objectContaining({ event: 'PRODUCT_SIN_CODES_UPDATED' }),
        );
      });

      it('rejects a partial set when the product has no codes yet', async () => {
        products.findByIdIncludingDeleted.mockResolvedValue(
          mockProduct({
            sin_activity_code: null,
            sin_product_code: null,
            sin_unit_code: null,
          }),
        );

        await expect(
          service.update('p-1', { sinActivityCode: '47730' }),
        ).rejects.toMatchObject({ response: { code: 'INCOMPLETE_SIN_CODES' } });
        expect(products.updateTx).not.toHaveBeenCalled();
      });
    });
  });

  describe('bulkImport SIN columns (SIAT-08)', () => {
    beforeEach(() => {
      products.createTx.mockImplementation((_tx, data) =>
        Promise.resolve(mockProduct({ barcode: data.barcode })),
      );
    });

    it('stores empty SIN cells as null (not homologated yet)', async () => {
      const result = await service.bulkImport(
        csvFile(
          'Paracetamol,Paragesic,Lab,Tableta,500mg,779,OTC,12.50,8.00,100,,,',
        ),
      );

      expect(result).toEqual({ inserted: 1, failed: [] });
      expect(products.createTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          sin_activity_code: null,
          sin_product_code: null,
          sin_unit_code: null,
        }),
      );
    });

    it('stores a complete, valid set of codes', async () => {
      const sin = module.get(ProductSinService);
      const result = await service.bulkImport(
        csvFile(
          'Paracetamol,Paragesic,Lab,Tableta,500mg,779,OTC,12.50,8.00,100,47730,6150031,58',
        ),
      );

      expect(result.inserted).toBe(1);
      expect(sin.validateCodes).toHaveBeenCalledWith({
        activityCode: '47730',
        productCode: '6150031',
        unitCode: '58',
      });
      expect(products.createTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ sin_unit_code: '58' }),
      );
    });

    it('fails the row, and only that row, on a partial set of codes', async () => {
      const result = await service.bulkImport(
        csvFile(
          'Paracetamol,Paragesic,Lab,Tableta,500mg,779,OTC,12.50,8.00,100,47730,,',
          'Ibuprofeno,Ibuprom,Medix,Tableta,400mg,771,OTC,18.00,11.00,80,,,',
        ),
      );

      expect(result.inserted).toBe(1);
      expect(result.failed).toEqual([
        expect.objectContaining({ row: 2, barcode: '779' }),
      ]);
    });

    it('fails the row when a code is not in the SIN catalogs', async () => {
      const sin = module.get(ProductSinService);
      (sin.validateCodes as jest.Mock).mockRejectedValueOnce(
        new InvalidSinCodesException([{ field: 'sinUnitCode', code: '99' }]),
      );

      const result = await service.bulkImport(
        csvFile(
          'Paracetamol,Paragesic,Lab,Tableta,500mg,779,OTC,12.50,8.00,100,47730,6150031,99',
        ),
      );

      expect(result.inserted).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(products.createTx).not.toHaveBeenCalled();
    });

    it('fails the row on a non-numeric code', async () => {
      const result = await service.bulkImport(
        csvFile(
          'Paracetamol,Paragesic,Lab,Tableta,500mg,779,OTC,12.50,8.00,100,47730,ABC,58',
        ),
      );

      expect(result.inserted).toBe(0);
      expect(result.failed[0].errors.join(' ')).toMatch(/sinProductCode/);
    });
  });

  describe('deactivate', () => {
    it('soft-deletes an active product', async () => {
      products.findByIdIncludingDeleted.mockResolvedValue(mockProduct());
      products.softDeleteTx.mockResolvedValue({
        ...mockProduct(),
        active: false,
        deleted_at: new Date(),
      });

      const result = await service.deactivate('p-1');

      expect(result.active).toBe(false);
      expect(products.softDeleteTx).toHaveBeenCalledWith(
        mockTx,
        'p-1',
        expect.any(Date),
      );
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'PRODUCT_DEACTIVATED' }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated mapped results', async () => {
      products.findAllPaginated.mockResolvedValue({
        data: [mockProduct()],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const result = await service.findAll({
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('searchAutocomplete', () => {
    it('returns mapped search results', async () => {
      products.searchAutocomplete.mockResolvedValue([mockProduct()]);

      const result = await service.searchAutocomplete('tylenol', 10);

      expect(result).toHaveLength(1);
      expect(products.searchAutocomplete).toHaveBeenCalledWith('tylenol', 10);
    });
  });

  describe('updatePrice', () => {
    it('updates the sale price and records history + audit', async () => {
      const existing = mockProduct({ sale_price: 12.5 });
      products.findByIdIncludingDeleted.mockResolvedValue(existing);
      products.updateTx.mockResolvedValue(mockProduct({ sale_price: 15 }));

      const result = await service.updatePrice(
        'p-1',
        { salePrice: 15, reason: 'Cost increase' },
        'user-1',
      );

      expect(result.salePrice).toBe(15);
      expect(products.updateTx).toHaveBeenCalledWith(mockTx, 'p-1', {
        sale_price: 15,
      });
      expect(mockTx.productPriceHistory.create).toHaveBeenCalledWith({
        data: {
          product_id: 'p-1',
          old_sale_price: existing.sale_price,
          new_sale_price: 15,
          reason: 'Cost increase',
          changed_by: 'user-1',
        },
      });
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'PRODUCT_PRICE_CHANGED' }),
      );
    });

    it('throws when sale price is below the floor', async () => {
      products.findByIdIncludingDeleted.mockResolvedValue(
        mockProduct({ sale_price: 12.5, min_sale_price: 10 }),
      );

      await expect(
        service.updatePrice('p-1', { salePrice: 5, reason: 'Sale' }, 'user-1'),
      ).rejects.toThrow('Sale price cannot be below the minimum sale price');
    });
  });

  describe('getPriceHistory', () => {
    it('returns paginated history entries', async () => {
      products.findByIdIncludingDeleted.mockResolvedValue(mockProduct());
      (prisma.productPriceHistory.count as jest.Mock).mockResolvedValue(1);
      (prisma.productPriceHistory.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'h-1',
          product_id: 'p-1',
          old_sale_price: 12.5,
          new_sale_price: 15,
          reason: 'Cost increase',
          changed_by: 'user-1',
          created_at: new Date(),
          user: { full_name: 'Carlos' },
        },
      ]);

      const result = await service.getPriceHistory('p-1', {
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].oldSalePrice).toBe(12.5);
      expect(result.data[0].newSalePrice).toBe(15);
      expect(result.data[0].changedByName).toBe('Carlos');
    });
  });
});
