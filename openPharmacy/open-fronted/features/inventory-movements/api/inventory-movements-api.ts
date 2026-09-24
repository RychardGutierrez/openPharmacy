import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  adjustmentSchema,
  createAdjustmentFormSchema,
  movementSchema,
  paginatedAdjustmentsSchema,
  paginatedMovementsSchema,
  userLookupResultSchema,
  type Adjustment,
  type AdjustmentsListQuery,
  type CreateAdjustmentFormValues,
  type Movement,
  type MovementsListQuery,
  type PaginatedAdjustments,
  type PaginatedMovements,
  type UserLookupResult,
} from "@/features/inventory-movements/types"

export class InventoryMovementsApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "InventoryMovementsApiError"
    this.status = status
    this.code = code
  }
}

const INVENTORY_MOVEMENTS_ERROR_MESSAGES: Record<string, string> = {
  ADJUSTMENT_ALREADY_PROCESSED: "Este ajuste ya fue procesado.",
  ADJUSTMENT_SELF_APPROVAL: "No puedes aprobar o rechazar tu propio ajuste.",
  INSUFFICIENT_LOT_STOCK: "No hay suficiente stock en este lote para aplicar el ajuste.",
  UNKNOWN: "Algo salió mal. Intenta de nuevo.",
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

function getErrorMessage(body: ApiErrorBody): { code: string; message: string } {
  const code = body.code ?? "UNKNOWN"
  const fallback = INVENTORY_MOVEMENTS_ERROR_MESSAGES[code] ?? INVENTORY_MOVEMENTS_ERROR_MESSAGES.UNKNOWN
  if (Array.isArray(body.message)) {
    return { code, message: body.message.join(" ") }
  }
  return { code, message: body.message ?? fallback }
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: "include" })
  } catch {
    throw new InventoryMovementsApiError(0, "UNKNOWN", INVENTORY_MOVEMENTS_ERROR_MESSAGES.UNKNOWN)
  }

  if (!response.ok) {
    const { code, message } = getErrorMessage(await parseErrorBody(response))
    throw new InventoryMovementsApiError(response.status, code, message)
  }

  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      received: (issue as unknown as { received?: unknown }).received,
    }))
    console.error("Inventory movements response parse error", issues, json)
    throw new InventoryMovementsApiError(
      0,
      "UNKNOWN",
      "La respuesta del servidor no tiene el formato esperado.",
    )
  }
  return parsed.data
}

function buildMovementsQueryString(query: MovementsListQuery): string {
  const params = new URLSearchParams()
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  if (query.productId) params.set("productId", query.productId)
  if (query.lotId) params.set("lotId", query.lotId)
  if (query.movementType) params.set("movementType", query.movementType)
  if (query.userId) params.set("userId", query.userId)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  const qs = params.toString()
  return qs.length > 0 ? `?${qs}` : ""
}

function buildAdjustmentsQueryString(query: AdjustmentsListQuery): string {
  const params = new URLSearchParams()
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  if (query.productId) params.set("productId", query.productId)
  if (query.lotId) params.set("lotId", query.lotId)
  if (query.status) params.set("status", query.status)
  if (query.requestedBy) params.set("requestedBy", query.requestedBy)
  const qs = params.toString()
  return qs.length > 0 ? `?${qs}` : ""
}

export function listMovements(query: MovementsListQuery = {}): Promise<PaginatedMovements> {
  return request(
    `/inventory-movements${buildMovementsQueryString(query)}`,
    { method: "GET" },
    paginatedMovementsSchema,
  )
}

export function listAdjustments(query: AdjustmentsListQuery = {}): Promise<PaginatedAdjustments> {
  return request(
    `/inventory-movements/adjustments${buildAdjustmentsQueryString(query)}`,
    { method: "GET" },
    paginatedAdjustmentsSchema,
  )
}

export function createAdjustment(values: CreateAdjustmentFormValues): Promise<Adjustment> {
  const parsed = createAdjustmentFormSchema.parse(values)
  return request(
    "/inventory-movements/adjustments",
    {
      method: "POST",
      body: JSON.stringify({
        productId: parsed.productId,
        lotId: parsed.lotId,
        direction: parsed.direction,
        quantity: parsed.quantity,
        reason: parsed.reason,
      }),
    },
    adjustmentSchema,
  )
}

export function approveAdjustment(id: string): Promise<{ adjustment: Adjustment; movement: Movement }> {
  return request(
    `/inventory-movements/adjustments/${id}/approve`,
    { method: "POST" },
    z.object({
      adjustment: adjustmentSchema,
      movement: movementSchema,
    }),
  )
}

export function rejectAdjustment(id: string): Promise<Adjustment> {
  return request(
    `/inventory-movements/adjustments/${id}/reject`,
    { method: "POST" },
    adjustmentSchema,
  )
}

const userLookupResponseSchema = z.array(userLookupResultSchema)

export function lookupUsers(q: string, limit = 20): Promise<UserLookupResult[]> {
  const params = new URLSearchParams()
  params.set("q", q)
  params.set("limit", String(limit))
  return request(`/users/lookup?${params.toString()}`, { method: "GET" }, userLookupResponseSchema)
}
