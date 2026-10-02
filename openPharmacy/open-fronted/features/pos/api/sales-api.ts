import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  saleReceiptSchema,
  type CreateSalePayload,
  type SaleReceipt,
} from "@/features/pos/types"
import {
  POS_ERROR_MESSAGES,
  type PosErrorCode,
} from "@/features/pos/api/constants"

export class PosApiError extends Error {
  readonly status: number
  readonly code: PosErrorCode

  constructor(status: number, code: PosErrorCode, message: string) {
    super(message)
    this.name = "PosApiError"
    this.status = status
    this.code = code
  }
}

interface ApiErrorBody {
  statusCode?: number
  code?: string
  message?: string | string[]
}

function mapErrorCode(code: string | undefined): PosErrorCode {
  const known: PosErrorCode[] = [
    "INSUFFICIENT_STOCK",
    "PRODUCT_INACTIVE",
    "DISCOUNT_EXCEEDS_SUBTOTAL",
    "CASH_SHORT",
    "INVALID_MIXED_SPLIT",
  ]
  if (code && (known as string[]).includes(code)) {
    return code as PosErrorCode
  }
  return "GENERIC"
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return {}
  }
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
  if (!headers["Content-Type"]) {
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
    throw new PosApiError(0, "GENERIC", POS_ERROR_MESSAGES.GENERIC)
  }

  if (!response.ok) {
    const body = await parseErrorBody(response)
    const code = mapErrorCode(body.code)
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message ?? POS_ERROR_MESSAGES[code]
    throw new PosApiError(response.status, code, message)
  }

  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new PosApiError(0, "GENERIC", POS_ERROR_MESSAGES.GENERIC)
  }
  return parsed.data
}

export function createSale(payload: CreateSalePayload): Promise<SaleReceipt> {
  return request(
    "/sales",
    { method: "POST", body: JSON.stringify(payload) },
    saleReceiptSchema,
  )
}

export function getSale(id: string): Promise<SaleReceipt> {
  return request(`/sales/${id}`, { method: "GET" }, saleReceiptSchema)
}

export const salesHistorySchema = z.object({
  data: z.array(saleReceiptSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})

function localDateStart(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

export function getMySales(page = 1, pageSize = 10, fromDate?: string, toDate?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (fromDate) params.set("from", localDateStart(fromDate).toISOString())
  if (toDate) {
    const end = localDateStart(toDate)
    end.setDate(end.getDate() + 1)
    params.set("to", end.toISOString())
  }
  return request(`/sales/mine?${params.toString()}`, { method: "GET" }, salesHistorySchema)
}
