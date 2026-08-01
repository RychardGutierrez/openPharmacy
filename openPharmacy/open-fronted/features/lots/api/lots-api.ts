import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  expiryDashboardSchema,
  lotSchema,
  lotTraceSchema,
  paginatedLotsSchema,
  type ExpiryDashboard,
  type Lot,
  type LotFormValues,
  type LotsListQuery,
  type LotTrace,
  type PaginatedLots,
} from "@/features/lots/types"
import {
  LOTS_ERROR_MESSAGES,
  type LotsErrorCode,
} from "@/features/lots/api/constants"

export class LotsApiError extends Error {
  readonly status: number
  readonly code: LotsErrorCode

  constructor(status: number, code: LotsErrorCode, message: string) {
    super(message)
    this.name = "LotsApiError"
    this.status = status
    this.code = code
  }
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
): { code: LotsErrorCode; message: string } {
  const code = (body.code ?? "UNKNOWN") as LotsErrorCode
  const fallback =
    LOTS_ERROR_MESSAGES[code as keyof typeof LOTS_ERROR_MESSAGES] ??
    LOTS_ERROR_MESSAGES.GENERIC
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
    throw new LotsApiError(0, "UNKNOWN", LOTS_ERROR_MESSAGES.GENERIC)
  }

  if (!response.ok) {
    const { code, message } = getErrorMessage(await parseErrorBody(response))
    throw new LotsApiError(response.status, code, message)
  }

  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new LotsApiError(0, "UNKNOWN", LOTS_ERROR_MESSAGES.GENERIC)
  }
  return parsed.data
}

function buildListQueryString(query: LotsListQuery): string {
  const params = new URLSearchParams()
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  if (query.productId) params.set("productId", query.productId)
  if (typeof query.includeVoided === "boolean") {
    params.set("includeVoided", String(query.includeVoided))
  }
  if (query.q && query.q.trim().length > 0) {
    params.set("q", query.q.trim())
  }
  const qs = params.toString()
  return qs.length > 0 ? `?${qs}` : ""
}

export function listLots(query: LotsListQuery = {}): Promise<PaginatedLots> {
  return request(
    `/lots${buildListQueryString(query)}`,
    { method: "GET" },
    paginatedLotsSchema,
  )
}

export function getLot(id: string): Promise<Lot> {
  return request(`/lots/${id}`, { method: "GET" }, lotSchema)
}

export function getLotsByProduct(
  productId: string,
  includeVoided = false,
): Promise<Lot[]> {
  const params = new URLSearchParams()
  if (includeVoided) params.set("includeVoided", "true")
  return request(
    `/lots/product/${productId}?${params.toString()}`,
    { method: "GET" },
    z.array(lotSchema),
  )
}

export function getExpiryDashboard(): Promise<ExpiryDashboard> {
  return request(
    "/lots/expiry-dashboard",
    { method: "GET" },
    expiryDashboardSchema,
  )
}

export function getLotTraceability(lotNumber: string): Promise<LotTrace> {
  return request(
    `/lots/traceability/${encodeURIComponent(lotNumber)}`,
    { method: "GET" },
    lotTraceSchema,
  )
}

export function createLot(values: LotFormValues): Promise<Lot> {
  return request(
    "/lots",
    { method: "POST", body: JSON.stringify(values) },
    lotSchema,
  )
}

export function updateLot(
  id: string,
  values: Partial<LotFormValues>,
): Promise<Lot> {
  return request(
    `/lots/${id}`,
    { method: "PATCH", body: JSON.stringify(values) },
    lotSchema,
  )
}

export function voidLot(id: string, reason: string): Promise<Lot> {
  return request(
    `/lots/${id}/void`,
    { method: "PATCH", body: JSON.stringify({ reason }) },
    lotSchema,
  )
}
