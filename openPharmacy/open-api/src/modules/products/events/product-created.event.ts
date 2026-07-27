import { ProductCategory } from '@prisma/client';

/**
 * Domain event emitted by `ProductsService` after a product is persisted.
 *
 * Consumers (future SalesModule, reporting, etc.) can react to this event
 * without taking a direct dependency on `ProductsService`.
 */
export class ProductCreatedEvent {
  constructor(
    public readonly productId: string,
    public readonly barcode: string,
    public readonly dciName: string,
    public readonly commercialName: string,
    public readonly category: ProductCategory,
  ) {}
}
