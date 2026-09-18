import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersRepository } from './repositories/purchase-orders.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

const mockPrisma = {
  $transaction: jest.fn(),
  purchaseOrder: {},
  orderItem: {},
  purchaseReceiving: {},
  purchaseReceivingItem: {},
  lot: {},
  inventoryMovement: {},
};

const mockAudit = {
  createInTx: jest.fn().mockResolvedValue(undefined),
};

const mockRepository = {
  createTx: jest.fn(),
  createItemTx: jest.fn(),
  findByIdWithItems: jest.fn(),
  findByIdWithItemsTx: jest.fn(),
  findById: jest.fn(),
  lockByIdTx: jest.fn().mockResolvedValue(undefined),
  lockItemsTx: jest.fn().mockResolvedValue(undefined),
  findItemsByIdsTx: jest.fn(),
  updateStatusTx: jest.fn(),
  updateItemReceivedTx: jest.fn(),
  findAll: jest.fn(),
};

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PurchaseOrdersRepository, useValue: mockRepository },
        { provide: AuditLogRepository, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a pending purchase order with items', async () => {
      const dto: CreatePurchaseOrderDto = {
        supplierId: 'supplier-1',
        orderDate: '2026-09-11',
        items: [{ productId: 'product-1', qtyOrdered: 100, unitCost: 2.5 }],
      };

      const order = {
        id: 'order-1',
        supplier_id: dto.supplierId,
        user_id: 'user-1',
        status: PurchaseOrderStatus.PENDING,
        order_date: new Date(dto.orderDate),
        created_at: new Date(),
      };
      const item = {
        id: 'item-1',
        order_id: order.id,
        product_id: 'product-1',
        qty_ordered: 100,
        qty_received: 0,
        unit_cost: 2.5,
      };
      const fullOrder = {
        ...order,
        supplier: { name: 'Supplier A' },
        user: { id: 'user-1' },
        orderItems: [
          {
            ...item,
            product: { commercial_name: 'Paracetamol' },
          },
        ],
      };

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      );
      mockRepository.createTx.mockResolvedValue(order);
      mockRepository.createItemTx.mockResolvedValue(item);
      mockRepository.findByIdWithItems.mockResolvedValue(fullOrder);

      const result = await service.create('user-1', dto);

      expect(result.id).toBe('order-1');
      expect(result.status).toBe(PurchaseOrderStatus.PENDING);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].qtyOrdered).toBe(100);
      expect(mockRepository.createTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: PurchaseOrderStatus.PENDING }),
      );
    });
  });

  describe('submit', () => {
    it('transitions a pending order to ordered', async () => {
      const order = buildOrder({ status: PurchaseOrderStatus.PENDING });
      const updated = { ...order, status: PurchaseOrderStatus.ORDERED };
      const fullOrder = buildFullOrder(updated);

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      );
      mockRepository.findByIdWithItemsTx.mockResolvedValue(order);
      mockRepository.updateStatusTx.mockResolvedValue(updated);
      mockRepository.findByIdWithItems.mockResolvedValue(fullOrder);

      const result = await service.submit('user-1', order.id);

      expect(result.status).toBe(PurchaseOrderStatus.ORDERED);
      expect(mockRepository.updateStatusTx).toHaveBeenCalledWith(
        expect.anything(),
        order.id,
        PurchaseOrderStatus.ORDERED,
      );
    });

    it('rejects submission of non-pending orders', async () => {
      const order = buildOrder({ status: PurchaseOrderStatus.ORDERED });
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      );
      mockRepository.findByIdWithItemsTx.mockResolvedValue(order);

      await expect(service.submit('user-1', order.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('receive', () => {
    it('receives goods, creates lots and inventory movements, and marks order received', async () => {
      const order = buildOrder({ status: PurchaseOrderStatus.ORDERED });
      const fullOrder = buildFullOrder(order);
      const dto: ReceivePurchaseOrderDto = {
        invoiceNumber: 'INV-001',
        invoiceDate: '2026-09-11',
        items: [
          {
            orderItemId: 'item-1',
            qtyReceived: 100,
            lotNumber: 'LOT-001',
            expiryDate: '2026-12-31',
            unitCost: 2.5,
          },
        ],
      };

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      );
      mockRepository.findByIdWithItemsTx.mockResolvedValue(fullOrder);
      mockRepository.findItemsByIdsTx.mockResolvedValue(fullOrder.orderItems);
      mockRepository.updateStatusTx.mockResolvedValue({
        ...order,
        status: PurchaseOrderStatus.RECEIVED,
      });
      mockRepository.updateItemReceivedTx.mockResolvedValue({});

      const txLot = {
        id: 'lot-1',
        lot_number: 'LOT-001',
        unit_cost: 2.5,
      };

      let capturedLotCreate: unknown;
      const txMock = {
        purchaseReceiving: {
          create: jest.fn().mockResolvedValue({
            id: 'receiving-1',
            invoice_number: dto.invoiceNumber,
            invoice_date: new Date(dto.invoiceDate),
            created_at: new Date(),
          }),
        },
        purchaseReceivingItem: { create: jest.fn().mockResolvedValue({}) },
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
        lot: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation((args: { data: unknown }) => {
            capturedLotCreate = args.data;
            return Promise.resolve(txLot);
          }),
          update: jest.fn().mockResolvedValue(txLot),
        },
      };

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock),
      );

      const result = await service.receive('user-1', order.id, dto);

      expect(result.status).toBe(PurchaseOrderStatus.RECEIVED);
      expect(result.lots).toHaveLength(1);
      expect(result.lots[0].qtyReceived).toBe(100);
      expect(txMock.lot.create).toHaveBeenCalled();
      const movementCalls = (
        txMock.inventoryMovement.create as unknown as {
          mock: { calls: Array<[unknown]> };
        }
      ).mock.calls;
      const movementCall = movementCalls[0][0] as {
        data: { movementType: string };
      };
      expect(movementCall.data.movementType).toBe('PURCHASE');
      expect(mockRepository.updateItemReceivedTx).toHaveBeenCalledWith(
        txMock,
        'item-1',
        100,
      );
      expect(capturedLotCreate).toMatchObject({
        lot_number: 'LOT-001',
        initial_qty: 100,
        current_qty: 100,
      });
    });

    it('rejects receiving more than ordered', async () => {
      const order = buildOrder({ status: PurchaseOrderStatus.ORDERED });
      const fullOrder = buildFullOrder(order);
      const dto: ReceivePurchaseOrderDto = {
        invoiceNumber: 'INV-001',
        invoiceDate: '2026-09-11',
        items: [
          {
            orderItemId: 'item-1',
            qtyReceived: 200,
            lotNumber: 'LOT-001',
            expiryDate: '2026-12-31',
            unitCost: 2.5,
          },
        ],
      };

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      );
      mockRepository.findByIdWithItemsTx.mockResolvedValue(fullOrder);
      mockRepository.findItemsByIdsTx.mockResolvedValue(fullOrder.orderItems);

      await expect(service.receive('user-1', order.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects receiving against a pending order', async () => {
      const order = buildOrder({ status: PurchaseOrderStatus.PENDING });
      const fullOrder = buildFullOrder(order);
      const dto: ReceivePurchaseOrderDto = {
        invoiceNumber: 'INV-001',
        invoiceDate: '2026-09-11',
        items: [
          {
            orderItemId: 'item-1',
            qtyReceived: 50,
            lotNumber: 'LOT-001',
            expiryDate: '2026-12-31',
            unitCost: 2.5,
          },
        ],
      };

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      );
      mockRepository.findByIdWithItemsTx.mockResolvedValue(fullOrder);

      await expect(service.receive('user-1', order.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects receiving an order item that belongs to another order', async () => {
      const order = buildOrder({ status: PurchaseOrderStatus.ORDERED });
      const fullOrder = buildFullOrder(order);
      const dto: ReceivePurchaseOrderDto = {
        invoiceNumber: 'INV-001',
        invoiceDate: '2026-09-11',
        items: [
          {
            orderItemId: 'item-1',
            qtyReceived: 50,
            lotNumber: 'LOT-001',
            expiryDate: '2026-12-31',
            unitCost: 2.5,
          },
        ],
      };

      const mismatchItem = {
        ...fullOrder.orderItems[0],
        order_id: 'other-order',
      };

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      );
      mockRepository.findByIdWithItemsTx.mockResolvedValue(fullOrder);
      mockRepository.findItemsByIdsTx.mockResolvedValue([mismatchItem]);

      await expect(service.receive('user-1', order.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('returns a purchase order by id', async () => {
      const order = buildOrder();
      const fullOrder = buildFullOrder(order);
      mockRepository.findById.mockResolvedValue(fullOrder);

      const result = await service.findOne(order.id);

      expect(result.id).toBe(order.id);
    });

    it('throws when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  function buildOrder(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'order-1',
      supplier_id: 'supplier-1',
      user_id: 'user-1',
      status: PurchaseOrderStatus.ORDERED,
      order_date: new Date('2026-09-11'),
      created_at: new Date(),
      supplier: { name: 'Supplier A' },
      user: { id: 'user-1' },
      orderItems: [
        {
          id: 'item-1',
          order_id: 'order-1',
          product_id: 'product-1',
          qty_ordered: 100,
          qty_received: 0,
          unit_cost: 2.5,
          product: { commercial_name: 'Paracetamol' },
        },
      ],
      ...overrides,
    };
  }

  function buildFullOrder(order: ReturnType<typeof buildOrder>) {
    return {
      ...order,
      supplier: { name: 'Supplier A' },
      user: { id: 'user-1' },
      orderItems: order.orderItems,
    };
  }
});
