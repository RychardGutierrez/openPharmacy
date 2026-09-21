import {
  PURCHASE_ORDER_ERROR_CODES,
  type PurchaseOrderErrorCode,
} from "@/features/purchase-orders/types"

export { PURCHASE_ORDER_ERROR_CODES, type PurchaseOrderErrorCode }

export const PURCHASE_ORDER_ERROR_MESSAGES: Record<PurchaseOrderErrorCode, string> = {
  GENERIC: "No se pudo procesar la solicitud. Inténtalo de nuevo.",
  PURCHASE_ORDER_NOT_PENDING:
    "Solo se pueden editar o enviar órdenes en estado Borrador.",
  PURCHASE_ORDER_EMPTY: "La orden no puede estar vacía.",
  PURCHASE_ORDER_NOT_RECEIVABLE:
    "Solo se pueden recibir órdenes enviadas o parcialmente recibidas.",
  PURCHASE_ORDER_ITEM_NOT_FOUND:
    "Uno o más productos de la orden no existen.",
  PURCHASE_ORDER_ITEM_MISMATCH:
    "Uno o más productos no pertenecen a esta orden.",
  PURCHASE_ORDER_QTY_EXCEEDED:
    "La cantidad a recibir supera lo pendiente.",
  EXPIRY_DATE_IN_PAST:
    "La fecha de vencimiento no puede estar en el pasado.",
  LOT_VOIDED:
    "El lote está anulado y no puede recibir más inventario.",
  LOT_EXPIRY_MISMATCH:
    "La fecha de vencimiento del lote no coincide con el registro existente.",
  LOT_COST_MISMATCH:
    "El costo unitario del lote no coincide con el registro existente.",
  PRODUCT_INACTIVE: "El producto está inactivo o fue eliminado.",
  VALIDATION: "Revisa los datos ingresados. Algún campo no cumple las reglas.",
  NOT_FOUND: "Orden de compra no encontrada.",
}

