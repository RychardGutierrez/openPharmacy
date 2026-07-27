export const PRODUCTS_ERROR_MESSAGES = {
  DUPLICATE_BARCODE: "Este código de barras ya está registrado.",
  PRODUCT_NOT_FOUND: "Producto no encontrado.",
  CSV_EMPTY: "El archivo CSV está vacío o no se envió.",
  CSV_INVALID: "El archivo CSV no tiene un formato válido.",
  GENERIC: "Algo salió mal. Intenta nuevamente.",
} as const

export type ProductsErrorCode = keyof typeof PRODUCTS_ERROR_MESSAGES | "UNKNOWN"
