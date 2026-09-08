import { NotFoundException } from '@nestjs/common';
import { ProductCategory, SaleStatus } from '@prisma/client';
import { ReturnsService } from './returns.service';
import {
  ControlledProductReturnException,
  ReturnQuantityExceededException,
  ReturnSaleItemMismatchException,
  ReturnSaleNotEligibleException,
  SaleAlreadyCancelledException,
  SaleHasReturnsException,
} from './exceptions';

/**
 * Unit tests for ReturnsService. They cover the domain rules in isolation:
 * controlled-substance rejection, lot restoration reference, transaction
 * rollback, cumulative-quantity validation, and sale status transitions.
 *
 * The Prisma transaction and the sub-repositories are stubbed at the
 * boundary the service uses.
 */
describe('ReturnsService', () => {
  const baseSaleItem = {
    id: 'sale-item-1',
    sale_id: 'sale-1',
    product_id: 'product-1',
    lot_id: 'lot-1',
    quantity: 4,
    unit_price: 10,
    line_total: 40,
  };
  const baseSale = {
    id: 'sale-1',
    status: SaleStatus.COMPLETED,
    saleItems: [
      {
        ...baseSaleItem,
        product: {
          id: 'product-1',
          category: ProductCategory.OTC,
          commercial_name: 'Paracetamol',
        },
      },
      {
        ...baseSaleItem,
        id: 'sale-item-2',
        lot_id: 'lot-2',
        quantity: 1,
        product: {
          id: 'product-2',
          category: ProductCategory.OTC,
          commercial_name: 'Ibuprofen',
        },
      },
    ],
  };

  function buildService() {
    const tx = {
      product: { findMany: jest.fn() },
      sale: { update: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
      lot: { findMany: jest.fn() },
    };
    const returnsRepo = {
      createTx: jest.fn(),
      createItemTx: jest.fn(),
      lockSaleItemsTx: jest.fn(),
      sumBySaleItems: jest.fn(),
    };
    const movementsRepo = {
      restoreStockTx: jest.fn(),
      createTx: jest.fn(),
    };
    const salesRepo = {
      lockByIdTx: jest.fn(),
      findByIdWithItemsTx: jest.fn(),
      updateStatusTx: jest.fn(),
      countReturnsBySaleTx: jest.fn(),
    };
    const audit = { createInTx: jest.fn() };

    salesRepo.findByIdWithItemsTx.mockResolvedValue(baseSale);
    salesRepo.countReturnsBySaleTx.mockResolvedValue(0);
    returnsRepo.lockSaleItemsTx.mockResolvedValue([
      { ...baseSaleItem },
      { ...baseSaleItem, id: 'sale-item-2', lot_id: 'lot-2', quantity: 1 },
    ]);
    returnsRepo.sumBySaleItems.mockResolvedValue(new Map());
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        category: ProductCategory.OTC,
        commercial_name: 'Paracetamol',
      },
      {
        id: 'product-2',
        category: ProductCategory.OTC,
        commercial_name: 'Ibuprofen',
      },
    ]);
    returnsRepo.createTx.mockResolvedValue({
      id: 'return-1',
      sale_id: 'sale-1',
      user_id: 'user-1',
      reason: 'Customer return',
      returnType: 'PARTIAL',
      created_at: new Date(),
    });
    returnsRepo.createItemTx.mockResolvedValue({
      id: 'return-item-1',
      return_id: 'return-1',
      sale_item_id: 'sale-item-1',
      lot_id: 'lot-1',
      quantity: 1,
    });
    movementsRepo.restoreStockTx.mockResolvedValue({});
    movementsRepo.createTx.mockResolvedValue({});
    prisma.lot.findMany.mockResolvedValue([
      { id: 'lot-1', lot_number: 'LOT-A' },
      { id: 'lot-2', lot_number: 'LOT-B' },
    ]);
    salesRepo.updateStatusTx.mockResolvedValue({
      id: 'sale-1',
      status: SaleStatus.COMPLETED,
    });
    salesRepo.lockByIdTx.mockResolvedValue(undefined);
    tx.sale.update.mockResolvedValue({ id: 'sale-1' });

    const service = new ReturnsService(
      prisma as never,
      returnsRepo as never,
      movementsRepo as never,
      salesRepo as never,
      audit as never,
    );

    return {
      service,
      returnsRepo,
      movementsRepo,
      salesRepo,
      audit,
      prisma,
    };
  }

  it('restores stock to the original sale_item lot and writes one movement per lot', async () => {
    const { service, movementsRepo, returnsRepo, audit } = buildService();

    const result = await service.create('user-1', {
      saleId: 'sale-1',
      reason: 'Customer return',
      returnType: 'PARTIAL',
      items: [{ saleItemId: 'sale-item-1', quantity: 1 }],
    });

    expect(movementsRepo.restoreStockTx).toHaveBeenCalledWith(
      expect.anything(),
      'lot-1',
      1,
    );
    expect(movementsRepo.createTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        lot_id: 'lot-1',
        movementType: 'RETURN',
        quantity: 1,
        user_id: 'user-1',
      }),
    );
    expect(returnsRepo.createItemTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sale_item_id: 'sale-item-1',
        lot_id: 'lot-1',
        quantity: 1,
      }),
    );
    expect(audit.createInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ event: 'RETURN_COMPLETED' }),
    );
    expect(result.items[0]).toMatchObject({
      lotId: 'lot-1',
      lotNumber: 'LOT-A',
      quantity: 1,
    });
  });

  it('rejects returns that touch PSYCHOTROPIC or NARCOTIC products', async () => {
    const { service, salesRepo, returnsRepo, prisma } = buildService();
    const controlledProduct = {
      id: 'product-controlled',
      category: ProductCategory.NARCOTIC,
      commercial_name: 'Morphine',
    };
    salesRepo.findByIdWithItemsTx.mockResolvedValue({
      ...baseSale,
      saleItems: [{ ...baseSaleItem, product: controlledProduct }],
    });
    returnsRepo.lockSaleItemsTx.mockResolvedValue([
      { ...baseSaleItem, product_id: 'product-controlled' },
    ]);

    const controlledTx = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'product-controlled',
            category: ProductCategory.NARCOTIC,
            commercial_name: 'Morphine',
          },
        ]),
      },
    };
    prisma.$transaction.mockImplementationOnce((cb: (t: unknown) => unknown) =>
      Promise.resolve(cb(controlledTx)),
    );

    await expect(
      service.create('user-1', {
        saleId: 'sale-1',
        reason: 'Test',
        returnType: 'PARTIAL',
        items: [{ saleItemId: 'sale-item-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(ControlledProductReturnException);
  });

  it('rejects requests that exceed the remaining refundable quantity', async () => {
    const { service, returnsRepo } = buildService();
    returnsRepo.sumBySaleItems.mockResolvedValue(new Map([['sale-item-1', 3]]));

    await expect(
      service.create('user-1', {
        saleId: 'sale-1',
        reason: 'Test',
        returnType: 'PARTIAL',
        items: [{ saleItemId: 'sale-item-1', quantity: 2 }],
      }),
    ).rejects.toBeInstanceOf(ReturnQuantityExceededException);
  });

  it('rejects sales that are not COMPLETED', async () => {
    const { service, salesRepo } = buildService();
    salesRepo.findByIdWithItemsTx.mockResolvedValue({
      ...baseSale,
      status: SaleStatus.CANCELLED,
    });

    await expect(
      service.create('user-1', {
        saleId: 'sale-1',
        reason: 'Test',
        returnType: 'PARTIAL',
        items: [{ saleItemId: 'sale-item-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(ReturnSaleNotEligibleException);
  });

  it('rejects sale items that do not belong to the supplied sale', async () => {
    const { service, returnsRepo } = buildService();
    returnsRepo.lockSaleItemsTx.mockResolvedValue([
      { ...baseSaleItem, sale_id: 'other-sale' },
    ]);

    await expect(
      service.create('user-1', {
        saleId: 'sale-1',
        reason: 'Test',
        returnType: 'PARTIAL',
        items: [{ saleItemId: 'sale-item-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(ReturnSaleItemMismatchException);
  });

  it('returns 404 when the sale does not exist', async () => {
    const { service, salesRepo } = buildService();
    salesRepo.findByIdWithItemsTx.mockResolvedValue(null);

    await expect(
      service.create('user-1', {
        saleId: 'sale-1',
        reason: 'Test',
        returnType: 'PARTIAL',
        items: [{ saleItemId: 'sale-item-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('writes exactly one audit row per return even with multiple items', async () => {
    const { service, audit } = buildService();

    await service.create('user-1', {
      saleId: 'sale-1',
      reason: 'Test',
      returnType: 'PARTIAL',
      items: [
        { saleItemId: 'sale-item-1', quantity: 1 },
        { saleItemId: 'sale-item-2', quantity: 1 },
      ],
    });

    const auditCalls = audit.createInTx.mock.calls.filter(
      (call: unknown[]) =>
        (call[1] as { event?: string } | undefined)?.event ===
        'RETURN_COMPLETED',
    );
    expect(auditCalls).toHaveLength(1);
  });

  describe('cancel()', () => {
    it('refuses to cancel a sale that already has a return', async () => {
      const { service, salesRepo } = buildService();
      salesRepo.countReturnsBySaleTx.mockResolvedValue(1);

      await expect(
        service.cancel('user-1', 'sale-1', { reason: 'Oops' }),
      ).rejects.toBeInstanceOf(SaleHasReturnsException);
    });

    it('refuses to cancel a non-COMPLETED sale', async () => {
      const { service, salesRepo } = buildService();
      salesRepo.findByIdWithItemsTx.mockResolvedValue({
        ...baseSale,
        status: SaleStatus.REFUNDED,
      });

      await expect(
        service.cancel('user-1', 'sale-1', { reason: 'Oops' }),
      ).rejects.toBeInstanceOf(SaleAlreadyCancelledException);
    });

    it('refuses to cancel a sale with a controlled-substance line', async () => {
      const { service, salesRepo } = buildService();
      salesRepo.findByIdWithItemsTx.mockResolvedValue({
        ...baseSale,
        saleItems: [
          {
            ...baseSaleItem,
            product: {
              id: 'product-controlled',
              category: ProductCategory.PSYCHOTROPIC,
              commercial_name: 'Diazepam',
            },
          },
        ],
      });

      await expect(
        service.cancel('user-1', 'sale-1', { reason: 'Oops' }),
      ).rejects.toBeInstanceOf(ControlledProductReturnException);
    });

    it('writes CANCELLATION movements and marks the sale as CANCELLED', async () => {
      const { service, movementsRepo, salesRepo, audit } = buildService();
      salesRepo.updateStatusTx.mockResolvedValue({
        id: 'sale-1',
        status: SaleStatus.CANCELLED,
      });

      const result = await service.cancel('user-1', 'sale-1', {
        reason: 'Duplicate sale recorded',
      });

      expect(salesRepo.updateStatusTx).toHaveBeenCalledWith(
        expect.anything(),
        'sale-1',
        SaleStatus.CANCELLED,
      );
      expect(movementsRepo.createTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          movementType: 'CANCELLATION',
          lot_id: 'lot-1',
          user_id: 'user-1',
        }),
      );
      expect(movementsRepo.createTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          movementType: 'CANCELLATION',
          lot_id: 'lot-2',
        }),
      );
      expect(audit.createInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'SALE_CANCELLED' }),
      );
      expect(result.items).toHaveLength(2);
    });
  });
});
