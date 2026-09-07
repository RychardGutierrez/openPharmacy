import { Prisma } from '@prisma/client';

export interface MarginAlert {
  previousUnitCost: number | null;
  newUnitCost: number;
  increasePct: number | null;
  currentSalePrice: number;
  currentMarginPct: number;
  suggestedSalePrice: number | null;
}

/**
 * Computes a margin alert when a new lot's unit cost is higher than the most
 * recent active lot's unit cost for the same product.
 *
 * Returns `null` when there is no previous lot (first lot for the product) so
 * we avoid noise for brand-new products.
 */
export async function computeMarginAlert(
  tx: Prisma.TransactionClient,
  productId: string,
  newUnitCost: number,
): Promise<MarginAlert | null> {
  const [previousLot, product] = await Promise.all([
    tx.lot.findFirst({
      where: {
        product_id: productId,
        voided_at: null,
      },
      orderBy: { created_at: 'desc' },
      select: { unit_cost: true },
    }),
    tx.product.findUnique({
      where: { id: productId },
      select: { sale_price: true, min_sale_price: true },
    }),
  ]);

  if (!product) {
    return null;
  }

  const previousUnitCost = previousLot ? Number(previousLot.unit_cost) : null;
  const currentSalePrice = Number(product.sale_price);
  const increase =
    previousUnitCost === null ? 0 : newUnitCost - previousUnitCost;
  const increasePct =
    previousUnitCost !== null && previousUnitCost > 0
      ? Math.round((increase / previousUnitCost) * 10000) / 100
      : null;
  const currentMarginPct =
    currentSalePrice > 0
      ? Math.round(
          ((currentSalePrice - newUnitCost) / currentSalePrice) * 10000,
        ) / 100
      : 0;
  // Do not multiply the current price by a cost ratio: a bad/very low
  // historical cost could produce suggestions such as Bs 125 instead of
  // Bs 12.50. Keep the current price while it still covers the new cost;
  // otherwise use the agreed 20% markup over the new cost.
  const suggestedSalePrice =
    currentSalePrice > newUnitCost
      ? currentSalePrice
      : Math.round(newUnitCost * 1.2 * 100) / 100;

  const costIncrease = previousUnitCost !== null && increase > 0;
  const aboveMinimumSalePrice = newUnitCost > Number(product.min_sale_price);

  if (!costIncrease && !aboveMinimumSalePrice) {
    return null;
  }

  return {
    previousUnitCost,
    newUnitCost,
    increasePct,
    currentSalePrice,
    currentMarginPct,
    suggestedSalePrice,
  };
}
