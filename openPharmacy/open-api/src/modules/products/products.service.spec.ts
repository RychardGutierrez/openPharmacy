/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Product, ProductCategory } from '@prisma/client';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repositories/products.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DuplicateBarcodeException } from './exceptions/duplicate-barcode.exception';
import { ProductNotFoundException } from './exceptions/product-not-found.exception';
import { CreateProductDto } from './dto/create-product.dto';

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  dci_name: 'Paracetamol',
  commercial_name: 'Tylenol',
  laboratory: 'PharmaCo',
  form: 'Tablet',
  concentration: '500mg',
  barcode: '7501234567890',
  category: ProductCategory.OTC,
  sale_price: 12.5 as unknown as Product['sale_price'],
  cost_price: 8.0 as unknown as Product['cost_price'],
  min_stock: 10,
  active: true,
  deleted_at: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockTx = {} as never;

describe('ProductsService', () => {
  let service: ProductsService;
  let products: jest.Mocked<ProductsRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let audit: jest.Mocked<AuditLogRepository>;

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
    } as unknown as jest.Mocked<PrismaService>;

    eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventEmitter2>;

    audit = {
      createInTx: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: products },
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: AuditLogRepository, useValue: audit },
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
        costPrice: 8.0,
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
          costPrice: 0.5,
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
});
