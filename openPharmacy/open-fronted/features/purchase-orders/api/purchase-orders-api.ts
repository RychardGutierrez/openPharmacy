import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  lastSupplierCostSchema,
  purchaseOrderListSchema,
  purchaseOrderSchema,
  receivingResponseSchema,
  type CreatePurchaseOrderPayload,
  type LastSupplierCost,
  type PurchaseOrder,
  type PurchaseOrderFiltersValue,
  type PurchaseOrderList,
  type ReceivePurchaseOrderPayload,
  type ReceivingResponse,
  type UpdatePurchaseOrderPayload,
} from "@/features/purchase-orders/types"
import {
  PURCHASE_ORDER_ERROR_CODES,
  PURCHASE_ORDER_ERROR_MESSAGES,
  type PurchaseOrderErrorCode,
} from "@/features/purchase-orders/api/messages"

export class PurchaseOrderApiError extends Error {
  readonly status: number
  readonly code: PurchaseOrderErrorCode

  constructor(
    status: number,
    code: PurchaseOrderErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "PurchaseOrderApiError"
    this.status = status
    this.code = code
  }
}

interface ApiErrorBody {
  statusCode?: number
  code?: string
  message?: string | string[]
}

/**
 * Translates the NestJS error envelope into one of our stable codes.
 *
 *  - 404 → NOT_FOUND
 *  - 400/422 without an explicit code → VALIDATION (NestJS ValidationPipe
 *    errors do not carry a stable `code` field, but they do carry a useful
 *    `message` that we forward to the user).
 *  - Otherwise pass through the known `code` if we recognize it, or fall
 *    back to GENERIC.
 */
function mapErrorCode(raw: string | undefined, status: number): PurchaseOrderErrorCode {
  if (status === 404) return "NOT_FOUND"
  if ((status === 400 || status === 422) && !raw) return "VALIDATION"
  if (
    raw &&
    (PURCHASE_ORDER_ERROR_CODES as readonly string[]).includes(raw)
  ) {
    return raw as PurchaseOrderErrorCode
  }
  if (raw === "PRODUCT_INACTIVE") return "PRODUCT_INACTIVE"
  return "GENERIC"
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return {}
  }
}

function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().accessToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  })

  if (!response.ok) {
    const body = await parseErrorBody(response)
    const code = mapErrorCode(body.code, response.status)
    const fallback = PURCHASE_ORDER_ERROR_MESSAGES[code]
    const rawMessage = Array.isArray(body.message)
      ? body.message.join(" ")
      : (body.message ?? fallback)
    throw new PurchaseOrderApiError(
      response.status,
      code,
      rawMessage || fallback,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new PurchaseOrderApiError(
      response.status,
      "GENERIC",
      PURCHASE_ORDER_ERROR_MESSAGES.GENERIC,
    )
  }
  return parsed.data
}

function buildFiltersQuery(
  filters: PurchaseOrderFiltersValue,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("pageSize", String(pageSize))
  if (filters.status) params.set("status", filters.status)
  if (filters.supplierId) params.set("supplierId", filters.supplierId)
  const q = filters.q?.trim()
  if (q) params.set("q", q)
  const qs = params.toString()
  return qs.length > 0 ? `?${qs}` : ""
}

export function listPurchaseOrders(
  filters: PurchaseOrderFiltersValue,
  page: number,
  pageSize: number,
): Promise<PurchaseOrderList> {
  return request(
    `/purchase-orders${buildFiltersQuery(filters, page, pageSize)}`,
    { method: "GET" },
    purchaseOrderListSchema,
  )
}

export function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return request(
    `/purchase-orders/${id}`,
    { method: "GET" },
    purchaseOrderSchema,
  )
}

export function createPurchaseOrder(
  payload: CreatePurchaseOrderPayload,
): Promise<PurchaseOrder> {
  return request(
    "/purchase-orders",
    { method: "POST", body: JSON.stringify(payload) },
    purchaseOrderSchema,
  )
}

export function updatePurchaseOrder(
  id: string,
  payload: UpdatePurchaseOrderPayload,
): Promise<PurchaseOrder> {
  return request(
    `/purchase-orders/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    purchaseOrderSchema,
  )
}

export function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return request(
    `/purchase-orders/${id}/submit`,
    { method: "PATCH" },
    purchaseOrderSchema,
  )
}

export function receivePurchaseOrder(
  id: string,
  payload: ReceivePurchaseOrderPayload,
): Promise<ReceivingResponse> {
  return request(
    `/purchase-orders/${id}/receive`,
    { method: "PATCH", body: JSON.stringify(payload) },
    receivingResponseSchema,
  )
}

export function getLastSupplierCost(
  supplierId: string,
  productId: string,
): Promise<LastSupplierCost | null> {
  const params = new URLSearchParams({
    supplierId,
    productId,
  })
  return request(
    `/purchase-orders/last-cost?${params.toString()}`,
    { method: "GET" },
    lastSupplierCostSchema.nullable(),
  )
}
