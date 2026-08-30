import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductCategory } from '@prisma/client';
import { SalesService } from './sales.service';
import { ShiftsService } from '../shifts/shifts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FefoService } from '../lots/fefo.service';
import { SalesRepository } from './repositories/sales.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { ConfigService } from '../config/config.service';
import { EmptyCartException } from './exceptions/empty-cart.exception';

describe('SalesService', () => {
  const tx = {
    shift: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const shifts = { validateActiveShift: jest.fn() };
  const fefo = { deductStockInTx: jest.fn() };
  const sales = {
    nextReceiptNumberTx: jest.fn(),
    createTx: jest.fn(),
    createItemTx: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  };
  const audit = { createInTx: jest.fn() };
  const config = { getPharmacyInfo: jest.fn() };
  const events = { emitAsync: jest.fn() };

  let service: SalesService;

  beforeEach(() => {
    jest.clearAllMocks();
    shifts.validateActiveShift.mockResolvedValue({ id: 'shift-1' });
    tx.shift.findUnique.mockResolvedValue({
      id: 'shift-1',
      user_id: 'user-1',
      status: 'OPEN',
    });
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        active: true,
        deleted_at: null,
        category: ProductCategory.OTC,
        commercial_name: 'Paracetamol',
        sale_price: 10,
      },
    ]);
    fefo.deductStockInTx.mockResolvedValue({
      success: true,
      remainingQty: 0,
      lotsUsed: [{ lotId: 'lot-1', lotNumber: 'LOT-1', deductedQty: 2 }],
    });
    sales.nextReceiptNumberTx.mockResolvedValue('00000001');
    sales.createTx.mockResolvedValue({
      id: 'sale-1',
      shift_id: 'shift-1',
      user_id: 'user-1',
      receipt_number: '00000001',
      subtotal: 20,
      discount: 0,
      total: 20,
      paymentMethod: 'CASH',
      cash_received: 25,
      change_given: 5,
      status: 'COMPLETED',
      created_at: new Date(),
    });
    config.getPharmacyInfo.mockResolvedValue({
      PHARMACY_NAME: 'Test Pharmacy',
    });
    events.emitAsync.mockResolvedValue([]);
    service = new SalesService(
      prisma as unknown as PrismaService,
      shifts as unknown as ShiftsService,
      fefo as unknown as FefoService,
      sales as unknown as SalesRepository,
      audit as unknown as AuditLogRepository,
      config as unknown as ConfigService,
      events as unknown as EventEmitter2,
    );
  });

  it('creates one sale item for each FEFO lot and emits after the transaction', async () => {
    const result = await service.create('user-1', {
      items: [{ productId: 'product-1', quantity: 2 }],
      paymentMethod: 'CASH',
      cashReceived: 25,
    });

    expect(result.receiptNumber).toBe('00000001');
    expect(result.items[0]).toMatchObject({
      lotId: 'lot-1',
      quantity: 2,
      lineTotal: 20,
    });
    expect(sales.createItemTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ lot_id: 'lot-1', quantity: 2 }),
    );
    expect(events.emitAsync).toHaveBeenCalledWith(
      'sale.created',
      expect.objectContaining({ saleId: 'sale-1' }),
    );
  });

  it('propagates a failure after FEFO so the caller transaction rolls back', async () => {
    sales.createTx.mockRejectedValueOnce(new Error('database failure'));

    await expect(
      service.create('user-1', {
        items: [{ productId: 'product-1', quantity: 2 }],
        paymentMethod: 'CARD',
      }),
    ).rejects.toThrow('database failure');

    expect(fefo.deductStockInTx).toHaveBeenCalled();
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it('rejects an empty cart before opening a transaction', async () => {
    await expect(
      service.create('user-1', { items: [], paymentMethod: 'CASH' }),
    ).rejects.toBeInstanceOf(EmptyCartException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
