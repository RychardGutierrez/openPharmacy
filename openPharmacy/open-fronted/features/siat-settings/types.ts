import { z } from "zod"

export const siatEnvironmentSchema = z.enum(["PILOTO", "PRODUCCION"])
export type SiatEnvironment = z.infer<typeof siatEnvironmentSchema>

export const SIAT_READINESS_LABELS: Record<string, string> = {
  nit: "NIT de la farmacia (se edita en la pestaña General)",
  systemCode: "Código de sistema",
  razonSocial: "Razón social",
  municipio: "Municipio",
  defaultActivity: "Actividad económica por defecto",
  token: "Token delegado",
  tokenExpired: "Token delegado vigente (el actual está vencido)",
}

/** `GET /api/siat/settings`. The token itself is never returned. */
export const siatSettingsSchema = z.object({
  environment: siatEnvironmentSchema,
  nit: z.string(),
  systemCode: z.string(),
  modality: z.number(),
  razonSocial: z.string(),
  municipio: z.string(),
  telefono: z.string(),
  defaultActivity: z.string(),
  enabled: z.boolean(),
  emailInvoices: z.boolean(),
  token: z.object({
    configured: z.boolean(),
    source: z.enum(["settings", "environment"]).nullable(),
    expiresAt: z.string().nullable(),
    expired: z.boolean(),
    daysUntilExpiry: z.number().nullable(),
  }),
  readiness: z.object({ ready: z.boolean(), missing: z.array(z.string()) }),
})
export type SiatSettings = z.infer<typeof siatSettingsSchema>

export const siatConnectionTestSchema = z.object({
  environment: siatEnvironmentSchema,
  connection: z.object({
    service: z.string(),
    status: z.enum(["ok", "rejected", "unavailable", "not-configured", "error"]),
    checkedAt: z.string(),
    durationMs: z.number(),
    mensajes: z.array(z.object({ codigo: z.number(), descripcion: z.string() })),
    detail: z.string().optional(),
  }),
  cuis: z.object({
    codigoSucursal: z.number(),
    codigoPuntoVenta: z.number(),
    status: z.enum(["active", "expired", "missing", "no-point-of-sale"]),
    validUntil: z.string().nullable(),
  }),
})
export type SiatConnectionTest = z.infer<typeof siatConnectionTestSchema>

const optionalPattern = (pattern: RegExp, message: string) =>
  z.string().trim().refine((value) => value === "" || pattern.test(value), message)

export const siatSettingsFormSchema = z
  .object({
    systemCode: optionalPattern(/^\S{1,100}$/, "El código de sistema no puede contener espacios"),
    razonSocial: z.string().trim().max(200, "Máximo 200 caracteres"),
    municipio: z.string().trim().max(100, "Máximo 100 caracteres"),
    telefono: z.string().trim().max(50, "Máximo 50 caracteres"),
    defaultActivity: optionalPattern(/^\d{1,10}$/, "El código de actividad debe contener solo dígitos"),
    token: optionalPattern(/^\S{1,4096}$/, "El token no puede contener espacios"),
    tokenExpiresAt: optionalPattern(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
    enabled: z.boolean(),
    emailInvoices: z.boolean(),
  })
  .refine((values) => values.token === "" || values.tokenExpiresAt !== "", {
    path: ["tokenExpiresAt"],
    message: "Indica la fecha de vencimiento del nuevo token",
  })
export type SiatSettingsFormValues = z.infer<typeof siatSettingsFormSchema>

/** Payload of `PATCH /api/siat/settings`. An absent token keeps the stored one. */
export type SiatSettingsUpdate = Partial<SiatSettingsFormValues>

export function toSiatFormValues(settings: SiatSettings): SiatSettingsFormValues {
  return {
    systemCode: settings.systemCode,
    razonSocial: settings.razonSocial,
    municipio: settings.municipio,
    telefono: settings.telefono,
    defaultActivity: settings.defaultActivity,
    token: "",
    tokenExpiresAt: settings.token.expiresAt ?? "",
    enabled: settings.enabled,
    emailInvoices: settings.emailInvoices,
  }
}
