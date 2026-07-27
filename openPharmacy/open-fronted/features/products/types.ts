import { z } from "zod"

export const PRODUCT_CATEGORIES = [
  "OTC",
  "PRESCRIPTION_ONLY",
  "PSYCHOTROPIC",
  "NARCOTIC",
  "NON_PHARMACEUTICAL",
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  OTC: "Venta libre",
  PRESCRIPTION_ONLY: "Con receta",
  PSYCHOTROPIC: "Psicotrópico",
  NARCOTIC: "Estupefaciente",
  NON_PHARMACEUTICAL: "No farmacéutico",
}

/** Short descriptions used in the category card group. */
export const PRODUCT_CATEGORY_DESCRIPTIONS: Record<ProductCategory, string> = {
  OTC: "Disponible sin receta médica.",
  PRESCRIPTION_ONLY: "Requiere receta médica para su venta.",
  PSYCHOTROPIC:
    "Sustancia controlada. Activa el flujo obligatorio de SEDES.",
  NARCOTIC:
    "Estupefaciente. Activa el flujo obligatorio de SEDES.",
  NON_PHARMACEUTICAL: "Cosméticos, suplementos o productos de higiene.",
}

export const CONTROLLED_CATEGORIES: readonly ProductCategory[] = [
  "PSYCHOTROPIC",
  "NARCOTIC",
] as const

export function isControlledCategory(category: ProductCategory): boolean {
  return (CONTROLLED_CATEGORIES as readonly ProductCategory[]).includes(category)
}

/** Compliance warning text rendered whenever a controlled category is selected. */
export const COMPLIANCE_WARNING_TEXT =
  "Esta categoría activa el flujo obligatorio de SEDES al registrar la venta."

/** Shape of a product as returned by the API. */
export const productSchema = z.object({
  id: z.string(),
  dciName: z.string(),
  commercialName: z.string(),
  laboratory: z.string().nullable().optional(),
  form: z.string().nullable().optional(),
  concentration: z.string().nullable().optional(),
  barcode: z.string(),
  category: z.enum(PRODUCT_CATEGORIES),
  salePrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  minStock: z.number().int().nonnegative(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
})
export type Product = z.infer<typeof productSchema>

export const paginatedProductsSchema = z.object({
  data: z.array(productSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedProducts = z.infer<typeof paginatedProductsSchema>

/** Subset returned by GET /api/products/search. */
export const productSearchResultSchema = productSchema
export type ProductSearchResult = Product

/**
 * Client-side form schema. Mirrors backend validation:
 *  - barcode: 3–14 digits
 *  - numeric fields non-negative
 *  - minStock is an integer
 *
 * The `laboratory`, `form`, and `concentration` fields are optional
 * (≤255 / ≤100 chars).
 */
export const productFormSchema = z.object({
  dciName: z
    .string()
    .min(1, "El nombre DCI es obligatorio")
    .max(255, "Máximo 255 caracteres"),
  commercialName: z
    .string()
    .min(1, "El nombre comercial es obligatorio")
    .max(255, "Máximo 255 caracteres"),
  laboratory: z.string().max(255, "Máximo 255 caracteres").optional(),
  form: z.string().max(100, "Máximo 100 caracteres").optional(),
  concentration: z.string().max(100, "Máximo 100 caracteres").optional(),
  barcode: z
    .string()
    .min(3, "El código debe tener al menos 3 dígitos")
    .max(14, "El código debe tener como máximo 14 dígitos")
    .regex(/^\d+$/, "Solo dígitos permitidos"),
  category: z.enum(PRODUCT_CATEGORIES, {
    message: "Selecciona una categoría",
  }),
  salePrice: z.number({ message: "Ingresa un precio válido" }).min(0, "No puede ser negativo"),
  costPrice: z.number({ message: "Ingresa un costo válido" }).min(0, "No puede ser negativo"),
  minStock: z
    .number({ message: "Ingresa un stock válido" })
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo")
    .max(999999, "Máximo 999999"),
})
export type ProductFormValues = z.infer<typeof productFormSchema>

/** Header row for the downloadable CSV template. */
export const BULK_IMPORT_HEADERS = [
  "dciName",
  "commercialName",
  "laboratory",
  "form",
  "concentration",
  "barcode",
  "category",
  "salePrice",
  "costPrice",
  "minStock",
] as const

/** Per-row error from the bulk-import endpoint. */
export interface BulkImportFailedRow {
  row: number
  barcode: string
  errors: string[]
}

export const bulkImportResponseSchema = z.object({
  inserted: z.number(),
  failed: z.array(
    z.object({
      row: z.number(),
      barcode: z.string(),
      errors: z.array(z.string()),
    }),
  ),
})
export type BulkImportResponse = z.infer<typeof bulkImportResponseSchema>
