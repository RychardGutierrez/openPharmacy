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

/** Aggregated sellable-stock info attached when `includeStock=true` (POS). */
export const stockSummarySchema = z.object({
  availableQty: z.number().int(),
  earliestExpiry: z.string().nullable(),
  daysUntilExpiry: z.number().int().nullable(),
  expiringSoon: z.boolean(),
})
export type StockSummary = z.infer<typeof stockSummarySchema>

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
  minSalePrice: z.number().nonnegative(),
  minStock: z.number().int().nonnegative(),
  sinActivityCode: z.string().nullable().optional(),
  sinProductCode: z.string().nullable().optional(),
  sinUnitCode: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  stockSummary: stockSummarySchema.nullable().optional(),
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

/** SIN homologation codes (SIAT-08): digits only, sent together or not at all. */
export const SIN_CODE_FIELDS = [
  "sinActivityCode",
  "sinProductCode",
  "sinUnitCode",
] as const
export type SinCodeField = (typeof SIN_CODE_FIELDS)[number]

/** Empty string = "not set" in the form. The API layer turns it into null. */
const sinCodeFormField = z
  .union([z.literal(""), z.string().regex(/^\d{1,20}$/, "Solo dígitos (máximo 20)")])
  .optional()

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
  minSalePrice: z.number({ message: "Ingresa el precio mínimo" }).min(0, "No puede ser negativo"),
  minStock: z
    .number({ message: "Ingresa un stock válido" })
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo")
    .max(999999, "Máximo 999999"),
  sinActivityCode: sinCodeFormField,
  sinProductCode: sinCodeFormField,
  sinUnitCode: sinCodeFormField,
}).superRefine((values, ctx) => {
  const fields = SIN_CODE_FIELDS.filter((field) => !!values[field])
  if (fields.length === 0 || fields.length === SIN_CODE_FIELDS.length) return
  for (const field of SIN_CODE_FIELDS) {
    if (!values[field]) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: "Completa los tres códigos SIN o deja los tres vacíos",
      })
    }
  }
})
export type ProductFormValues = z.infer<typeof productFormSchema>

/** Stored SIN codes of a product, as the API returns them. */
export interface SinCodes {
  sinActivityCode: string
  sinProductCode: string
  sinUnitCode: string
}

/** Counts from GET /products/sin/summary. */
export const sinSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  homologated: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
})
export type SinSummary = z.infer<typeof sinSummarySchema>

/**
 * One category default from GET /products/sin/defaults. The backend returns raw Prisma rows, so
 * the keys are snake_case.
 */
export const sinCategoryDefaultSchema = z.object({
  category: z.enum(PRODUCT_CATEGORIES),
  sin_activity_code: z.string(),
  sin_product_code: z.string(),
  sin_unit_code: z.string(),
  updated_at: z.string(),
})
export type SinCategoryDefault = z.infer<typeof sinCategoryDefaultSchema>

export const sinCategoryDefaultsSchema = z.array(sinCategoryDefaultSchema)

export const sinBulkResultSchema = z.object({ updated: z.number().int().nonnegative() })
export type SinBulkResult = z.infer<typeof sinBulkResultSchema>

/** One item of GET /siat/catalogs/:catalog (activities, products, units). */
export const siatCatalogItemSchema = z.object({
  code: z.string(),
  parentCode: z.string().nullable(),
  description: z.string(),
  extra: z.record(z.string(), z.unknown()).nullable().optional(),
  active: z.boolean(),
})
export type SiatCatalogItem = z.infer<typeof siatCatalogItemSchema>

export const siatCatalogItemsPageSchema = z.object({
  catalog: z.string(),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  items: z.array(siatCatalogItemSchema),
})
export type SiatCatalogItemsPage = z.infer<typeof siatCatalogItemsPageSchema>

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
  "minSalePrice",
  "minStock",
  // SIAT-08: optional SIN codes. Leave all three empty, or fill all three.
  "sinActivityCode",
  "sinProductCode",
  "sinUnitCode",
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
