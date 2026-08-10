import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updatePrice: jest.fn(),
    getPriceHistory: jest.fn(),
    deactivate: jest.fn(),
    activate: jest.fn(),
    searchAutocomplete: jest.fn(),
    bulkImport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('updatePrice delegates to ProductsService.updatePrice', async () => {
    const dto = { salePrice: 30, reason: 'Cost increase' };
    const user = { id: 'user-1' };
    mockProductsService.updatePrice.mockResolvedValue({ id: 'p-1' });

    await controller.updatePrice(
      'p-1',
      dto,
      user as never,
      {
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
    );

    expect(mockProductsService.updatePrice).toHaveBeenCalledWith(
      'p-1',
      dto,
      'user-1',
      { ip: '127.0.0.1', userAgent: null },
    );
  });

  it('getPriceHistory delegates to ProductsService.getPriceHistory', async () => {
    mockProductsService.getPriceHistory.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    await controller.getPriceHistory('p-1', { page: 1, pageSize: 20 });

    expect(mockProductsService.getPriceHistory).toHaveBeenCalledWith('p-1', {
      page: 1,
      pageSize: 20,
    });
  });
});
