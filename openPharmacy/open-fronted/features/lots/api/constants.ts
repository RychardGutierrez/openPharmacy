export const LOTS_ERROR_MESSAGES = {
  LOT_NOT_FOUND: "Lote no encontrado.",
  DUPLICATE_LOT: "Ya existe un lote con este número para el producto.",
  EXPIRED_LOT: "El lote está vencido.",
  INSUFFICIENT_STOCK: "Stock insuficiente para realizar la operación.",
  LOT_HAS_STOCK: "No se puede anular un lote con stock. Primero ajusta el inventario.",
  LOT_HAS_DEPENDENCIES:
    "El lote tiene movimientos o ventas asociadas. No se puede modificar.",
  LOT_ALREADY_VOIDED: "Este lote ya fue anulado.",
  LOT_NOT_EDITABLE: "Este lote no se puede editar.",
  EXPIRY_DATE_IN_PAST:
    "La fecha de vencimiento no puede estar en el pasado para stock activo.",
  GENERIC: "Algo salió mal. Intenta nuevamente.",
} as const

export type LotsErrorCode = keyof typeof LOTS_ERROR_MESSAGES | "UNKNOWN"
