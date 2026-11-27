import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  siatCatalogSyncSchema,
  siatCatalogsStatusSchema,
  siatConnectionTestSchema,
  siatSettingsSchema,
  type SiatCatalogSync,
  type SiatCatalogsStatus,
  type SiatConnectionTest,
  type SiatSettings,
  type SiatSettingsUpdate,
} from "@/features/siat-settings/types"

export class SiatSettingsApiError extends Error {
  readonly status: number
  readonly code?: string
  /** Readiness gaps sent with `SIAT_NOT_READY`. */
  readonly missing: string[]

  constructor(status: number, message: string, code?: string, missing: string[] = []) {
    super(message)
    this.name = "SiatSettingsApiError"
    this.status = status
    this.code = code
    this.missing = missing
  }
}

interface ApiErrorBody {
  message?: string | string[]
  code?: string
  missing?: string[]
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: "include" })
  } catch {
    throw new SiatSettingsApiError(0, "El servicio de configuración no está disponible.")
  }
  if (!response.ok) {
    let body: ApiErrorBody = {}
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      // Keep the generic message below.
    }
    const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
    throw new SiatSettingsApiError(
      response.status,
      message ?? "No se pudo completar la operación.",
      body.code,
      body.missing ?? [],
    )
  }

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) throw new SiatSettingsApiError(0, "La respuesta del servidor no es válida.")
  return parsed.data
}

export function getSiatSettings(): Promise<SiatSettings> {
  return request("/siat/settings", { method: "GET" }, siatSettingsSchema)
}

export function updateSiatSettings(values: SiatSettingsUpdate): Promise<SiatSettings> {
  // Write-only token: an empty field means "keep the stored token", so it is not sent.
  // An empty expiry date is not sent either (the API keeps the stored one).
  const payload = Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => !((key === "token" || key === "tokenExpiresAt") && value === ""),
    ),
  )
  return request("/siat/settings", { method: "PATCH", body: JSON.stringify(payload) }, siatSettingsSchema)
}

export function testSiatConnection(): Promise<SiatConnectionTest> {
  return request("/siat/settings/test-connection", { method: "POST" }, siatConnectionTestSchema)
}

export function getSiatCatalogsStatus(): Promise<SiatCatalogsStatus> {
  return request("/siat/catalogs", { method: "GET" }, siatCatalogsStatusSchema)
}

/** Sync now: every catalog and the clock. */
export function syncSiatCatalogs(): Promise<SiatCatalogSync> {
  return request("/siat/catalogs/sync", { method: "POST", body: JSON.stringify({}) }, siatCatalogSyncSchema)
}
