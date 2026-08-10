/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Prisma } from '@prisma/client';
import { computeMarginAlert } from './margin-alert';

describe('computeMarginAlert', () => {
  const tx = {
    lot: { findFirst: jest.fn() },
    product: { findUnique: jest.fn() },
  } as unknown as {
    lot: { findFirst: jest.Mock };
    product: { findUnique: jest.Mock };
  };

  const asTx = tx as unknown as Prisma.TransactionClient;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when there is no previous lot', async () => {
    (tx.lot.findFirst as jest.Mock).mockResolvedValue(null);
    (tx.product.findUnique as jest.Mock).mockResolvedValue({
      sale_price: 25,
      min_sale_price: 20,
    });

    const result = await computeMarginAlert(asTx, 'p-1', 14);
    expect(result).toBeNull();
  });

  it('returns null when cost decreases (no alert needed)', async () => {
    (tx.lot.findFirst as jest.Mock).mockResolvedValue({ unit_cost: 14 });
    (tx.product.findUnique as jest.Mock).mockResolvedValue({
      sale_price: 25,
      min_sale_price: 20,
    });

    const result = await computeMarginAlert(asTx, 'p-1', 12);
    expect(result).toBeNull();
  });

  it('computes increase pct and suggested price when cost rises', async () => {
    (tx.lot.findFirst as jest.Mock).mockResolvedValue({ unit_cost: 14 });
    (tx.product.findUnique as jest.Mock).mockResolvedValue({
      sale_price: 25,
      min_sale_price: 8,
    });

    const result = await computeMarginAlert(asTx, 'p-1', 16.5);
    expect(result).not.toBeNull();
    expect(result?.previousUnitCost).toBe(14);
    expect(result?.newUnitCost).toBe(16.5);
    expect(result?.increasePct).toBe(17.86);
    expect(result?.currentSalePrice).toBe(25);
    expect(result?.currentMarginPct).toBe(34);
    expect(result?.suggestedSalePrice).toBe(25);
  });

  it('returns null when the product does not exist', async () => {
    (tx.lot.findFirst as jest.Mock).mockResolvedValue({ unit_cost: 14 });
    (tx.product.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await computeMarginAlert(asTx, 'p-1', 16.5);
    expect(result).toBeNull();
  });

  it('alerts on the first lot when cost exceeds the minimum sale price', async () => {
    (tx.lot.findFirst as jest.Mock).mockResolvedValue(null);
    (tx.product.findUnique as jest.Mock).mockResolvedValue({
      sale_price: 25,
      min_sale_price: 10,
    });

    const result = await computeMarginAlert(asTx, 'p-1', 12);
    expect(result?.previousUnitCost).toBeNull();
    expect(result?.suggestedSalePrice).toBe(25);
  });
});
