import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  paginatedSuppliersSchema,
  supplierSchema,
  type CreateSupplierPayload,
  type PaginatedSuppliers,
  type Supplier,
  type SuppliersListQuery,
  type UpdateSupplierPayload,
} from "@/features/suppliers/types"

export const SUPPLIER_ERROR_MESSAGES = {
  DUPLICATE_NIT: "Este NIT ya está registrado para otro proveedor.",
  SUPPLIER_NOT_FOUND: "Proveedor no encontrado.",
  GENERIC: "Algo salió mal. Inténtalo de nuevo.",
} as const

export type SupplierErrorCode =
  | keyof typeof SUPPLIER_ERROR_MESSAGES
  | "UNKNOWN"

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
): { code: SupplierErrorCode; message: string } {
  const code = (body.code ?? "UNKNOWN") as SupplierErrorCode
  const fallback =
    SUPPLIER_ERROR_MESSAGES[code as keyof typeof SUPPLIER_ERROR_MESSAGES] ??
    SUPPLIER_ERROR_MESSAGES.GENERIC
  if (Array.isArray(body.message)) {
    return { code, message: body.message.join(" ") }
  }
  return { code, message: body.message ?? fallback }
}

export class SupplierApiError extends Error {
  readonly status: number
  readonly code: SupplierErrorCode

  constructor(status: number, code: SupplierErrorCode, message: string) {
    super(message)
    this.name = "SupplierApiError"
    this.status = status
    this.code = code
  }
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
    response = await fetch(`/api${path}`, {
      ...init,
      headers,
      credentials: "include",
    })
  } catch {
    throw new SupplierApiError(0, "UNKNOWN", SUPPLIER_ERROR_MESSAGES.GENERIC)
  }

  if (!response.ok) {
    const { code, message } = getErrorMessage(await parseErrorBody(response))
    throw new SupplierApiError(response.status, code, message)
  }

  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new SupplierApiError(0, "UNKNOWN", SUPPLIER_ERROR_MESSAGES.GENERIC)
  }
  return parsed.data
}

function toSupplierPayload(
  values: CreateSupplierPayload | UpdateSupplierPayload,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue
    if (key === "contactPerson") {
      payload.contact_person = value === "" ? undefined : value
    } else if (key === "paymentTerms") {
      payload.payment_terms = value === "" ? undefined : value
    } else {
      payload[key] = value === "" ? undefined : value
    }
  }
  return payload
}

function buildQueryString(query: SuppliersListQuery): string {
  const params = new URLSearchParams()
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  if (typeof query.active === "boolean") params.set("active", String(query.active))
  if (query.q && query.q.trim().length > 0) params.set("q", query.q.trim())
  const qs = params.toString()
  return qs.length > 0 ? `?${qs}` : ""
}

export function listSuppliers(query: SuppliersListQuery = {}): Promise<PaginatedSuppliers> {
  return request(`/suppliers/search${buildQueryString(query)}`, { method: "GET" }, paginatedSuppliersSchema)
}

export function listActiveSuppliers(): Promise<Supplier[]> {
  return request("/suppliers", { method: "GET" }, z.array(supplierSchema))
}

export function getSupplier(id: string): Promise<Supplier> {
  return request(`/suppliers/${id}`, { method: "GET" }, supplierSchema)
}

export function createSupplier(values: CreateSupplierPayload): Promise<Supplier> {
  return request("/suppliers", { method: "POST", body: JSON.stringify(toSupplierPayload(values)) }, supplierSchema)
}

export function updateSupplier(
  id: string,
  values: UpdateSupplierPayload,
): Promise<Supplier> {
  return request(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(toSupplierPayload(values)) }, supplierSchema)
}

export function deactivateSupplier(id: string): Promise<Supplier> {
  return request(`/suppliers/${id}/deactivate`, { method: "PATCH" }, supplierSchema)
}

export function activateSupplier(id: string): Promise<Supplier> {
  return request(`/suppliers/${id}/activate`, { method: "PATCH" }, supplierSchema)
}
