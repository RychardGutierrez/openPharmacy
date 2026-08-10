import { BadRequestException } from '@nestjs/common';

export class PriceBelowFloorException extends BadRequestException {
  constructor(
    productId: string,
    minSalePrice: number,
    requestedSalePrice: number,
  ) {
    super({
      statusCode: 400,
      code: 'PRICE_BELOW_FLOOR',
      field: 'salePrice',
      message: `Sale price cannot be below the minimum sale price of ${minSalePrice}`,
      metadata: { productId, minSalePrice, requestedSalePrice },
    });
  }
}
