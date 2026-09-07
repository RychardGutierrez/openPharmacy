export const POS_ERROR_MESSAGES = {
  GENERIC: "No se pudo completar la operación. Intenta nuevamente.",
  EMPTY_CART: "El carrito está vacío.",
  INSUFFICIENT_STOCK:
    "Stock insuficiente para uno de los productos. Actualiza el carrito.",
  PRODUCT_INACTIVE: "Un producto del carrito ya no está disponible.",
  DISCOUNT_EXCEEDS_SUBTOTAL: "El descuento no puede superar el subtotal.",
  CASH_SHORT: "El efectivo recibido es menor al total.",
  INVALID_MIXED_SPLIT:
    "En pago mixto, el efectivo debe ser mayor a 0 y menor al total.",
  NO_OPEN_SHIFT:
    "Necesitas un turno abierto para registrar ventas.",
  SALE_NOT_FOUND: "No se encontró la venta solicitada.",
} as const

export type PosErrorCode = keyof typeof POS_ERROR_MESSAGES
