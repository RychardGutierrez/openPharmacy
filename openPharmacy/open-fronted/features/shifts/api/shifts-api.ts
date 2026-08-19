import { z } from "zod"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { SHIFTS_ERROR_MESSAGES, type ShiftsErrorCode } from "@/features/shifts/api/constants"
import {
  closeShiftFormSchema,
  openShiftFormSchema,
  reopenRequestFormSchema,
  shiftCloseResponseSchema,
  shiftReopenRequestSchema,
  shiftReopenRequestWithRelationsSchema,
  shiftSchema,
  shiftSalesSchema,
  type CloseShiftFormValues,
  type OpenShiftFormValues,
  type ReopenRequestFormValues,
} from "@/features/shifts/types"

export class ShiftsApiError extends Error {
  readonly status: number
  readonly code: ShiftsErrorCode

  constructor(status: number, code: ShiftsErrorCode, message: string) {
    super(message)
    this.name = "ShiftsApiError"
    this.status = status
    this.code = code
  }
}

interface ApiErrorBody { code?: string; message?: string | string[] }

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try { return (await response.json()) as ApiErrorBody } catch { return {} }
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>, emptyValue?: unknown): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) ?? {}) }
  if (!headers["Content-Type"] && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json"
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: "include" })
  } catch {
    throw new ShiftsApiError(0, "UNKNOWN", SHIFTS_ERROR_MESSAGES.GENERIC)
  }
  if (!response.ok) {
    const body = await parseErrorBody(response)
    const code = (body.code ?? "UNKNOWN") as ShiftsErrorCode
    const fallback = SHIFTS_ERROR_MESSAGES[code as keyof typeof SHIFTS_ERROR_MESSAGES] ?? SHIFTS_ERROR_MESSAGES.GENERIC
    const message = Array.isArray(body.message) ? body.message.join(" ") : body.message ?? fallback
    throw new ShiftsApiError(response.status, code, message)
  }
  const body = await response.text()
  let json: unknown = emptyValue
  if (body.trim().length > 0) {
    try {
      json = JSON.parse(body) as unknown
    } catch {
      throw new ShiftsApiError(0, "UNKNOWN", SHIFTS_ERROR_MESSAGES.GENERIC)
    }
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw new ShiftsApiError(0, "UNKNOWN", SHIFTS_ERROR_MESSAGES.GENERIC)
  return parsed.data
}

export function openShift(values: OpenShiftFormValues) {
  return request("/shifts/open", { method: "POST", body: JSON.stringify(openShiftFormSchema.parse(values)) }, shiftSchema)
}

export function getCurrentShift() {
  return request("/shifts/current", { method: "GET" }, shiftSchema.nullable(), null)
}

export function listMyShifts() {
  return request("/shifts/mine", { method: "GET" }, z.array(shiftSchema))
}

export function getShiftSales(shiftId: string) {
  return request(`/shifts/${shiftId}/sales`, { method: "GET" }, shiftSalesSchema)
}

export function closeShift(id: string, values: CloseShiftFormValues) {
  return request(`/shifts/${id}/close`, { method: "PATCH", body: JSON.stringify(closeShiftFormSchema.parse(values)) }, shiftCloseResponseSchema)
}

export function requestReopen(shiftId: string, values: ReopenRequestFormValues) {
  return request(`/shifts/${shiftId}/reopen-request`, { method: "POST", body: JSON.stringify(reopenRequestFormSchema.parse(values)) }, shiftReopenRequestSchema)
}

export function listPendingReopenRequests() {
  return request("/shifts/reopen-requests", { method: "GET" }, z.array(shiftReopenRequestWithRelationsSchema))
}

export function approveReopenRequest(requestId: string) {
  return request(`/shifts/reopen-requests/${requestId}/approve`, { method: "PATCH" }, shiftSchema)
}

export function rejectReopenRequest(requestId: string) {
  return request(`/shifts/reopen-requests/${requestId}/reject`, { method: "PATCH" }, shiftReopenRequestSchema)
}

export function reopenShiftDirectly(shiftId: string) {
  return request(`/shifts/${shiftId}/reopen`, { method: "PATCH" }, shiftSchema)
}
