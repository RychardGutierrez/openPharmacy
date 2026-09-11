import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  returnableSaleSchema,
  returnListResponseSchema,
  returnResponseSchema,
  type CreateReturnPayload,
  type CancelSalePayload,
  type ReturnableSale,
  type ReturnListResponse,
  type ReturnResponse,
} from "@/features/returns/types"
import {
  RETURNS_ERROR_MESSAGES,
  type ReturnsErrorCode,
} from "@/features/returns/api/constants"

export class ReturnsApiError extends Error {
  readonly status: number
  readonly code: ReturnsErrorCode

  constructor(status: number, code: ReturnsErrorCode, message: string) {
    super(message)
    this.name = "ReturnsApiError"
    this.status = status
    this.code = code
  }
}

interface ApiErrorBody {
  statusCode?: number
  code?: string
  message?: string | string[]
}

function mapErrorCode(code: string | undefined): ReturnsErrorCode {
  const known: ReturnsErrorCode[] = [
    "CONTROLLED_PRODUCT",
    "RETURN_QUANTITY_EXCEEDED",
    "RETURN_SALE_NOT_ELIGIBLE",
    "SALE_ALREADY_CANCELLED",
    "SALE_HAS_RETURNS",
    "SALE_NOT_FOUND",
  ]
  if (code && (known as string[]).includes(code)) {
    return code as ReturnsErrorCode
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
    throw new ReturnsApiError(0, "GENERIC", RETURNS_ERROR_MESSAGES.GENERIC)
  }

  if (!response.ok) {
    const body = await parseErrorBody(response)
    const code = mapErrorCode(body.code)
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message ?? RETURNS_ERROR_MESSAGES[code]
    throw new ReturnsApiError(response.status, code, message)
  }

  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new ReturnsApiError(0, "GENERIC", RETURNS_ERROR_MESSAGES.GENERIC)
  }
  return parsed.data
}

export function getReturnableSale(receiptNumber: string): Promise<ReturnableSale> {
  return request(
    `/returns/sale/${encodeURIComponent(receiptNumber)}`,
    { method: "GET" },
    returnableSaleSchema,
  )
}

export function createReturn(payload: CreateReturnPayload): Promise<ReturnResponse> {
  return request(
    "/returns",
    { method: "POST", body: JSON.stringify(payload) },
    returnResponseSchema,
  )
}

export function cancelSale(
  saleId: string,
  payload: CancelSalePayload,
): Promise<ReturnResponse> {
  return request(
    `/sales/${encodeURIComponent(saleId)}/cancel`,
    { method: "POST", body: JSON.stringify(payload) },
    returnResponseSchema,
  )
}

export function getReturns(
  page = 1,
  pageSize = 20,
): Promise<ReturnListResponse> {
  return request(
    `/returns?page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`,
    { method: "GET" },
    returnListResponseSchema,
  )
}
