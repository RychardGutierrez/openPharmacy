/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { LotsController } from './lots.controller';
import { LotsService } from './lots.service';
import { FefoService } from './fefo.service';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto } from './dto/update-lot.dto';
import { VoidLotDto } from './dto/void-lot.dto';
import { DeductStockDto } from './dto/deduct-stock.dto';
import type { LotResponseDto } from './dto/lot-response.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { Request } from 'express';

const mockRequest = {
  headers: {},
  ip: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' },
} as unknown as Request;

describe('LotsController', () => {
  let controller: LotsController;
  let lotsService: jest.Mocked<LotsService>;
  let fefoService: jest.Mocked<FefoService>;

  const user: AuthenticatedUser = {
    id: 'user-1',
    role: 'PHARMACIST',
    fullName: 'Test Pharmacist',
    email: 'pharmacist@openpharmacy.com',
  };

  beforeEach(async () => {
    lotsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByProduct: jest.fn(),
      getExpiryDashboard: jest.fn(),
      traceByLotNumber: jest.fn(),
      update: jest.fn(),
      void: jest.fn(),
    } as unknown as jest.Mocked<LotsService>;

    fefoService = {
      deductStock: jest.fn(),
    } as unknown as jest.Mocked<FefoService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LotsController],
      providers: [
        { provide: LotsService, useValue: lotsService },
        { provide: FefoService, useValue: fefoService },
      ],
    }).compile();

    controller = module.get<LotsController>(LotsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('delegates to LotsService.create', async () => {
      const dto: CreateLotDto = {
        productId: 'product-1',
        lotNumber: 'LOT-001',
        expiryDate: '2027-12-31',
        initialQty: 100,
      };
      const expected = { id: 'lot-1', lotNumber: dto.lotNumber };
      lotsService.create.mockResolvedValue(
        expected as unknown as LotResponseDto,
      );

      const result = await controller.create(dto, user, mockRequest);

      expect(result).toEqual(expected);
      expect(lotsService.create).toHaveBeenCalledWith(dto, user.id, {
        ip: '127.0.0.1',
        userAgent: null,
      });
    });
  });

  describe('findAll', () => {
    it('delegates to LotsService.findAll with defaults', async () => {
      const expected = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      lotsService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll({
        page: 1,
        pageSize: 20,
      });

      expect(result).toEqual(expected);
      expect(lotsService.findAll).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe('findOne', () => {
    it('delegates to LotsService.findOne', async () => {
      const expected = { id: 'lot-1' };
      lotsService.findOne.mockResolvedValue(
        expected as unknown as LotResponseDto,
      );

      const result = await controller.findOne('lot-1');

      expect(result).toEqual(expected);
      expect(lotsService.findOne).toHaveBeenCalledWith('lot-1');
    });
  });

  describe('findByProduct', () => {
    it('delegates to LotsService.findByProduct', async () => {
      lotsService.findByProduct.mockResolvedValue([]);

      await controller.findByProduct('product-1', 'true');

      expect(lotsService.findByProduct).toHaveBeenCalledWith('product-1', true);
    });
  });

  describe('update', () => {
    it('delegates to LotsService.update', async () => {
      const dto: UpdateLotDto = {
        lotNumber: 'LOT-002',
        reason: 'Typo',
      };
      lotsService.update.mockResolvedValue({
        id: 'lot-1',
      } as unknown as LotResponseDto);

      await controller.update('lot-1', dto, user, mockRequest);

      expect(lotsService.update).toHaveBeenCalledWith(
        'lot-1',
        dto,
        user.id,
        expect.any(Object),
      );
    });
  });

  describe('void', () => {
    it('delegates to LotsService.void', async () => {
      const dto: VoidLotDto = { reason: 'Mistake' };
      lotsService.void.mockResolvedValue({
        id: 'lot-1',
      } as unknown as LotResponseDto);

      await controller.void('lot-1', dto, user, mockRequest);

      expect(lotsService.void).toHaveBeenCalledWith(
        'lot-1',
        dto,
        user.id,
        expect.any(Object),
      );
    });
  });

  describe('deductStock', () => {
    it('delegates to FefoService.deductStock', async () => {
      const dto: DeductStockDto = {
        productId: 'product-1',
        quantity: 10,
      };
      const expected = { success: true, lotsUsed: [], remainingQty: 0 };
      fefoService.deductStock.mockResolvedValue(expected);

      const result = await controller.deductStock(dto, user);

      expect(result).toEqual(expected);
      expect(fefoService.deductStock).toHaveBeenCalledWith(
        dto.productId,
        dto.quantity,
        user.id,
      );
    });
  });
});
