import { ProductCategory, SaleStatus } from '@prisma/client';

/**
 * A sale line item enriched with everything the returns UI needs:
 * real `sale_items.id`, product category, lot, pricing, and how many
 * units have already been returned.
 */
export class ReturnableSaleItemDto {
  /** The real `sale_items.id` — required when submitting `POST /api/returns`. */
  id!: string;

  productId!: string;
  productName!: string;
  productCategory!: ProductCategory;

  lotId!: string;
  lotNumber!: string;

  /** Original sold quantity. */
  quantity!: number;

  unitPrice!: number;
  lineTotal!: number;

  /** Cumulative quantity already returned for this line. */
  alreadyReturnedQuantity!: number;
}

/**
 * Sale lookup payload for the returns / cancellation screen.
 */
export class ReturnableSaleDto {
  id!: string;
  receiptNumber!: string;
  status!: SaleStatus;
  createdAt!: Date;

  subtotal!: number;
  discount!: number;
  total!: number;

  paymentMethod!: string;
  cashReceived!: number;
  changeGiven!: number;

  items!: ReturnableSaleItemDto[];
}
