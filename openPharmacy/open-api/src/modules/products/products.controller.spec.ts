/* eslint-disable @typescript-eslint/unbound-method -- handlers are only read as metadata targets */
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductCategory, UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductSinService } from './product-sin.service';

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

  const mockProductSin = {
    summary: jest.fn(),
    invalidCodes: jest.fn(),
    bulkAssign: jest.fn(),
    listDefaults: jest.fn(),
    upsertDefault: jest.fn(),
    applyDefault: jest.fn(),
  };

  const request = {
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as never;
  const meta = { ip: '127.0.0.1', userAgent: null };
  const sinDto = {
    sinActivityCode: '47730',
    sinProductCode: '6150031',
    sinUnitCode: '58',
  };
  const codes = {
    activityCode: '47730',
    productCode: '6150031',
    unitCode: '58',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductsService },
        { provide: ProductSinService, useValue: mockProductSin },
      ],
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

  describe('SIN homologation routes (SIAT-08)', () => {
    const user = { id: 'user-1' } as never;

    it('keeps every sin/* route to ADMIN and PHARMACIST (class roles, no cashier override)', () => {
      const reflector = new Reflector();
      const handlers = [
        controller.sinSummary,
        controller.sinInvalid,
        controller.bulkAssignSin,
        controller.listSinDefaults,
        controller.setSinDefault,
        controller.applySinDefault,
      ];
      for (const handler of handlers) {
        const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
          handler,
          ProductsController,
        ]);
        expect(roles).toEqual([UserRole.ADMIN, UserRole.PHARMACIST]);
      }
    });

    it('summary and invalid delegate to ProductSinService', async () => {
      mockProductSin.summary.mockResolvedValue({ total: 0 });
      mockProductSin.invalidCodes.mockResolvedValue({ catalogSynced: false });

      await controller.sinSummary();
      await controller.sinInvalid();

      expect(mockProductSin.summary).toHaveBeenCalled();
      expect(mockProductSin.invalidCodes).toHaveBeenCalled();
    });

    it('bulkAssignSin maps the DTO onto the codes and scope', async () => {
      mockProductSin.bulkAssign.mockResolvedValue({ updated: 2 });

      await controller.bulkAssignSin(
        { ...sinDto, productIds: ['a', 'b'], overwrite: true },
        request,
        user,
      );

      expect(mockProductSin.bulkAssign).toHaveBeenCalledWith(
        { codes, productIds: ['a', 'b'], category: undefined, overwrite: true },
        'user-1',
        meta,
      );
    });

    it('setSinDefault and applySinDefault pass the category through', async () => {
      await controller.setSinDefault(
        ProductCategory.OTC,
        sinDto,
        request,
        user,
      );
      await controller.applySinDefault(ProductCategory.OTC, request, user);

      expect(mockProductSin.upsertDefault).toHaveBeenCalledWith(
        ProductCategory.OTC,
        codes,
        'user-1',
        meta,
      );
      expect(mockProductSin.applyDefault).toHaveBeenCalledWith(
        ProductCategory.OTC,
        'user-1',
        meta,
      );
    });
  });
});
