/**
 * Stable error codes thrown by the returns and sale-cancellation flows.
 *
 * Each exception extends the matching NestJS HTTP exception so the global
 * `AllExceptionsFilter` keeps returning the standard `{ statusCode, code,
 * message }` shape to the frontend.
 */

export { ControlledProductReturnException } from './controlled-product-return.exception';
export { ReturnQuantityExceededException } from './return-quantity-exceeded.exception';
export { ReturnSaleNotEligibleException } from './return-sale-not-eligible.exception';
export { ReturnSaleItemMismatchException } from './return-sale-item-mismatch.exception';
export { SaleAlreadyCancelledException } from './sale-already-cancelled.exception';
export { SaleHasReturnsException } from './sale-has-returns.exception';
export { ReturnItemsMissingException } from './return-items-missing.exception';
