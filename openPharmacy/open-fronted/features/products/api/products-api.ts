import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  bulkImportResponseSchema,
  paginatedProductsSchema,
  productSchema,
  type BulkImportResponse,
  type PaginatedProducts,
  type Product,
  type ProductFormValues,
  type ProductSearchResult,
} from "@/features/products/types"
import {
  PRODUCTS_ERROR_MESSAGES,
  type ProductsErrorCode,
} from "@/features/products/api/constants"

export class ProductsApiError extends Error {
  readonly status: number
  readonly code: ProductsErrorCode

  constructor(status: number, code: ProductsErrorCode, message: string) {
    super(message)
    this.name = "ProductsApiError"
    this.status = status
    this.code = code
  }
}

export interface ProductsListQuery {
  page?: number
  pageSize?: number
  category?: import("@/features/products/types").ProductCategory
  active?: boolean
  q?: string
}

interface ApiErrorBody {
  statusCode?: number
  code?: string
  message?: string | string[]
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return {}
  }
}

function getErrorMessage(
  body: ApiErrorBody,
): { code: ProductsErrorCode; message: string } {
  const code = (body.code ?? "UNKNOWN") as ProductsErrorCode
  const fallback =
    PRODUCTS_ERROR_MESSAGES[code as keyof typeof PRODUCTS_ERROR_MESSAGES] ??
    PRODUCTS_ERROR_MESSAGES.GENERIC
  if (Array.isArray(body.message)) {
    return { code, message: body.message.join(" ") }
  }
  return { code, message: body.message ?? fallback }
}

async function request<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  }
  // Do not set Content-Type for FormData; the browser fills the boundary.
  if (!(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers,
      credentials: "include",
    })
  } catch {
    throw new ProductsApiError(0, "UNKNOWN", PRODUCTS_ERROR_MESSAGES.GENERIC)
  }

  if (!response.ok) {
    const { code, message } = getErrorMessage(await parseErrorBody(response))
    throw new ProductsApiError(response.status, code, message)
  }

  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new ProductsApiError(0, "UNKNOWN", PRODUCTS_ERROR_MESSAGES.GENERIC)
  }
  return parsed.data
}

function buildQueryString(query: ProductsListQuery): string {
  const params = new URLSearchParams()
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  if (query.category) params.set("category", query.category)
  if (typeof query.active === "boolean") params.set("active", String(query.active))
  if (query.q && query.q.trim().length > 0) params.set("q", query.q.trim())
  const qs = params.toString()
  return qs.length > 0 ? `?${qs}` : ""
}

export function listProducts(
  query: ProductsListQuery = {},
): Promise<PaginatedProducts> {
  return request(
    `/products${buildQueryString(query)}`,
    { method: "GET" },
    paginatedProductsSchema,
  )
}

export function getProduct(id: string): Promise<Product> {
  return request(`/products/${id}`, { method: "GET" }, productSchema)
}

const searchResponseSchema = z.array(productSchema)

export function searchProducts(q: string): Promise<ProductSearchResult[]> {
  const params = new URLSearchParams()
  params.set("q", q)
  return request(
    `/products/search?${params.toString()}`,
    { method: "GET" },
    searchResponseSchema,
  )
}

export function createProduct(values: ProductFormValues): Promise<Product> {
  return request(
    "/products",
    { method: "POST", body: JSON.stringify(values) },
    productSchema,
  )
}

export function updateProduct(
  id: string,
  values: ProductFormValues,
): Promise<Product> {
  return request(
    `/products/${id}`,
    { method: "PATCH", body: JSON.stringify(values) },
    productSchema,
  )
}

export function deactivateProduct(id: string): Promise<Product> {
  return request(`/products/${id}/deactivate`, { method: "PATCH" }, productSchema)
}

export function activateProduct(id: string): Promise<Product> {
  return request(`/products/${id}/activate`, { method: "PATCH" }, productSchema)
}

export interface UpdateProductPriceValues {
  salePrice: number
  reason: string
}

export function updateProductPrice(
  id: string,
  values: UpdateProductPriceValues,
): Promise<Product> {
  return request(
    `/products/${id}/price`,
    { method: "PATCH", body: JSON.stringify(values) },
    productSchema,
  )
}

export const productPriceHistoryEntrySchema = z.object({
  id: z.string(),
  productId: z.string(),
  oldSalePrice: z.number().nullable().optional(),
  newSalePrice: z.number(),
  reason: z.string().nullable().optional(),
  changedBy: z.string().nullable().optional(),
  changedByName: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type ProductPriceHistoryEntry = z.infer<
  typeof productPriceHistoryEntrySchema
>

export const paginatedPriceHistorySchema = z.object({
  data: z.array(productPriceHistoryEntrySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedPriceHistory = z.infer<typeof paginatedPriceHistorySchema>

export function getProductPriceHistory(
  id: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedPriceHistory> {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("pageSize", String(pageSize))
  return request(
    `/products/${id}/price-history?${params.toString()}`,
    { method: "GET" },
    paginatedPriceHistorySchema,
  )
}

export function bulkImportProducts(file: File): Promise<BulkImportResponse> {
  const formData = new FormData()
  formData.append("file", file)
  return request(
    "/products/bulk-import",
    { method: "POST", body: formData },
    bulkImportResponseSchema,
  )
}
