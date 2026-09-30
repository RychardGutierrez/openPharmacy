import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import { configurationSchema, EMPTY_CONFIGURATION, type ConfigurationValues } from "@/features/configuration/types"

const runtimeConfigurationSchema = z.object({
  pharmacy: z.record(z.string(), z.string()),
  receipt: z.record(z.string(), z.string()),
  inventory: z.object({ lowStock: z.number(), expiryWarningDays: z.number() }),
})
export type RuntimeConfiguration = z.infer<typeof runtimeConfigurationSchema>

export class ConfigurationApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = "ConfigurationApiError"
    this.status = status
    this.code = code
  }
}

interface ApiErrorBody {
  message?: string | string[]
  code?: string
}

async function parseError(response: Response): Promise<never> {
  let body: ApiErrorBody = {}
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    // Keep the generic response error below.
  }
  const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
  throw new ConfigurationApiError(response.status, message ?? "No se pudo guardar la configuración.", body.code)
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  }
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json"
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: "include" })
  } catch {
    throw new ConfigurationApiError(0, "El servicio de configuración no está disponible.")
  }
  if (!response.ok) await parseError(response)

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) throw new ConfigurationApiError(0, "La respuesta de configuración no es válida.")
  return parsed.data
}

export function getConfiguration(): Promise<ConfigurationValues> {
  return request("/config", { method: "GET" }, z.record(z.string(), z.unknown())).then((values) =>
    configurationSchema.parse({ ...EMPTY_CONFIGURATION, ...values, SMTP_PASSWORD: "" }),
  )
}

export function getRuntimeConfiguration(): Promise<RuntimeConfiguration> {
  return request("/config/runtime", { method: "GET" }, runtimeConfigurationSchema)
}

export function updateConfiguration(values: Partial<ConfigurationValues>): Promise<ConfigurationValues> {
  const payload = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => key !== "SMTP_PASSWORD" || value !== "" || values.SMTP_HOST !== ""),
  )
  return request(
    "/config",
    { method: "PATCH", body: JSON.stringify({ values: payload }) },
    z.record(z.string(), z.unknown()),
  ).then((response) => configurationSchema.parse({ ...EMPTY_CONFIGURATION, ...response, SMTP_PASSWORD: "" }))
}

export function uploadConfigurationLogo(file: File): Promise<{ path: string }> {
  const body = new FormData()
  body.append("file", file)
  return request("/config/logo", { method: "POST", body }, z.object({ path: z.string() }))
}
