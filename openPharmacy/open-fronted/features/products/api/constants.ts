export const PRODUCTS_ERROR_MESSAGES = {
  DUPLICATE_BARCODE: "Este código de barras ya está registrado.",
  PRODUCT_NOT_FOUND: "Producto no encontrado.",
  PRICE_BELOW_FLOOR: "El precio no puede ser menor al precio mínimo de venta.",
  CSV_EMPTY: "El archivo CSV está vacío o no se envió.",
  CSV_INVALID: "El archivo CSV no tiene un formato válido.",
  INCOMPLETE_SIN_CODES:
    "Los códigos SIN deben enviarse completos: actividad, producto y unidad.",
  INVALID_SIN_CODES:
    "Algún código SIN no está activo en el catálogo sincronizado, o el producto no pertenece a la actividad.",
  PRODUCT_NOT_HOMOLOGATED:
    "Algún producto no tiene códigos SIN. Asígnalos antes de vender.",
  SIN_DEFAULT_NOT_SET: "Esta categoría no tiene códigos SIN por defecto.",
  SIN_SCOPE_REQUIRED: "Selecciona productos o una categoría.",
  GENERIC: "Algo salió mal. Intenta nuevamente.",
} as const

export type ProductsErrorCode = keyof typeof PRODUCTS_ERROR_MESSAGES | "UNKNOWN"
