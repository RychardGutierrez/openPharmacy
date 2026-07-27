import { Injectable } from '@nestjs/common';
import { Product, ProductCategory } from '@prisma/client';

/**
 * Pure rule engine for pharmaceutical products.
 *
 * Kept separate from `ProductsService` so downstream modules (Sales) can
 * import just the rules without depending on the full catalog data-access
 * layer. The helpers operate on any object that has a `category` field, so
 * they can be used with raw Prisma products, DTOs, or CSV rows.
 */
@Injectable()
export class ProductRulesService {
  /**
   * Returns true for products whose sale is restricted by controlled-substance
   * law. The ticket specifies only PSYCHOTROPIC and NARCOTIC categories.
   */
  isControlled(product: Pick<Product, 'category'>): boolean {
    return (
      product.category === ProductCategory.PSYCHOTROPIC ||
      product.category === ProductCategory.NARCOTIC
    );
  }

  /**
   * Returns true for products that require a prescription before sale.
   * This includes controlled substances plus PRESCRIPTION_ONLY medicines.
   */
  requiresPrescription(product: Pick<Product, 'category'>): boolean {
    return (
      product.category === ProductCategory.PRESCRIPTION_ONLY ||
      this.isControlled(product)
    );
  }
}
