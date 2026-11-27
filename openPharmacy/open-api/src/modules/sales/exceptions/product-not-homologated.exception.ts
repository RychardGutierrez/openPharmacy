import { ConflictException } from '@nestjs/common';

/**
 * A product in the cart has no SIN codes of its own and no category default, while SIAT is
 * enabled (SIAT-08). Invoices for it would be rejected by SIN.
 */
export class ProductNotHomologatedException extends ConflictException {
  constructor(products: { id: string; commercialName: string }[]) {
    super({
      statusCode: 409,
      code: 'PRODUCT_NOT_HOMOLOGATED',
      message:
        'Some products have no SIN codes. Assign them before selling while SIAT is enabled',
      products,
    });
  }
}
