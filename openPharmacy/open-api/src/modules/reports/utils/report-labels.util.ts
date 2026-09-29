import {
  MovementType,
  PaymentMethod,
  ProductCategory,
  PurchaseOrderStatus,
  ReportType,
  ReturnSource,
} from '@prisma/client';

/**
 * Spanish display labels for every enum value that can appear inside an
 * exported file (Excel/PDF). Exports are customer-facing, so raw enum codes
 * like `SALES_DETAIL` must never leak into them.
 *
 * Vocabulary mirrors the frontend label maps (`REPORT_TYPE_LABELS`,
 * `PAYMENT_METHOD_LABELS`, `MOVEMENT_TYPE_LABELS`, `PRODUCT_CATEGORY_LABELS`,
 * `PURCHASE_ORDER_STATUS_LABELS`, `RETURN_SOURCE_LABELS`, `LOT_EXPIRY_LABELS`)
 * so the app UI and the exported files speak the same language.
 *
 * Every helper falls back to the raw value when it receives something
 * unknown, so a future enum member degrades to English rather than crashing.
 */
export const REPORT_TYPE_LABELS_ES: Record<ReportType, string> = {
  SALES_SUMMARY: 'Ventas',
  SALES_DETAIL: 'Detalle de ventas',
  INVENTORY_MOVEMENTS: 'Movimientos de inventario',
  STOCK_SNAPSHOT: 'Inventario actual',
  EXPIRY: 'Vencimientos',
  PURCHASES: 'Compras',
  RETURNS: 'Devoluciones y ajustes',
};

export const MOVEMENT_TYPE_LABELS_ES: Record<MovementType, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venta',
  RETURN: 'Devolución',
  CANCELLATION: 'Cancelación',
  DAMAGE: 'Daño',
  EXPIRED: 'Vencido',
  THEFT_LOSS: 'Robo / Pérdida',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  ADJUSTMENT: 'Ajuste',
  TRANSFER: 'Traspaso',
};

export const PAYMENT_METHOD_LABELS_ES: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  QR: 'QR',
  MIXED: 'Mixto',
};

export const PRODUCT_CATEGORY_LABELS_ES: Record<ProductCategory, string> = {
  OTC: 'Venta libre',
  PRESCRIPTION_ONLY: 'Con receta',
  PSYCHOTROPIC: 'Psicotrópico',
  NARCOTIC: 'Estupefaciente',
  NON_PHARMACEUTICAL: 'No farmacéutico',
};

export const PURCHASE_ORDER_STATUS_LABELS_ES: Record<
  PurchaseOrderStatus,
  string
> = {
  PENDING: 'Borrador',
  ORDERED: 'Enviada',
  PARTIAL: 'Recibida parcialmente',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
};

export const RETURN_SOURCE_LABELS_ES: Record<ReturnSource, string> = {
  RETURN: 'Devolución',
  CANCELLATION: 'Cancelación',
};

export type ExpiryStatus = 'RED' | 'ORANGE' | 'GREEN';

export const EXPIRY_STATUS_LABELS_ES: Record<ExpiryStatus, string> = {
  RED: 'Vencido / Por vencer',
  ORANGE: 'Por vencer pronto',
  GREEN: 'Vigente',
};

export function expiryStatusFor(daysUntilExpiry: number): ExpiryStatus {
  if (daysUntilExpiry <= 30) return 'RED';
  if (daysUntilExpiry <= 60) return 'ORANGE';
  return 'GREEN';
}

export function labelReportType(value: string): string {
  return REPORT_TYPE_LABELS_ES[value as ReportType] ?? value;
}

export function labelMovementType(value: string): string {
  return MOVEMENT_TYPE_LABELS_ES[value as MovementType] ?? value;
}

export function labelPaymentMethod(value: string): string {
  return PAYMENT_METHOD_LABELS_ES[value as PaymentMethod] ?? value;
}

export function labelProductCategory(value: string): string {
  return PRODUCT_CATEGORY_LABELS_ES[value as ProductCategory] ?? value;
}

export function labelPurchaseOrderStatus(value: string): string {
  return PURCHASE_ORDER_STATUS_LABELS_ES[value as PurchaseOrderStatus] ?? value;
}

export function labelReturnSource(value: string): string {
  return RETURN_SOURCE_LABELS_ES[value as ReturnSource] ?? value;
}

export function labelExpiryStatus(status: ExpiryStatus): string {
  return EXPIRY_STATUS_LABELS_ES[status];
}
