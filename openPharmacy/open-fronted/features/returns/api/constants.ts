export const RETURNS_ERROR_MESSAGES = {
  CONTROLLED_PRODUCT:
    "La venta incluye un producto controlado que no admite devolución ni cancelación.",
  RETURN_QUANTITY_EXCEEDED:
    "La cantidad a devolver excede el límite permitido para esta línea.",
  RETURN_SALE_NOT_ELIGIBLE: "La venta no está disponible para devolución.",
  SALE_ALREADY_CANCELLED: "La venta ya fue cancelada o reembolsada.",
  SALE_HAS_RETURNS:
    "La venta tiene devoluciones previas. Use el flujo de devolución.",
  SALE_NOT_FOUND: "Venta no encontrada.",
  GENERIC:
    "No se pudo procesar la devolución. Intente nuevamente.",
} as const

export type ReturnsErrorCode = keyof typeof RETURNS_ERROR_MESSAGES
