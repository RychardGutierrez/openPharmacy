import { z } from "zod"

export const LOT_EXPIRY_STATUSES = ["RED", "ORANGE", "GREEN"] as const
export type LotExpiryStatus = (typeof LOT_EXPIRY_STATUSES)[number]

export const LOT_EXPIRY_LABELS: Record<LotExpiryStatus, string> = {
  RED: "Vencido / Por vencer",
  ORANGE: "Por vencer pronto",
  GREEN: "Vigente",
}

export const LOT_EXPIRY_TONE: Record<LotExpiryStatus, string> = {
  RED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  ORANGE:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  GREEN:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
}

/**
 * Single source of truth for the expiry proximity policy.
 * Mirrors the backend LotsService.classifyExpiry thresholds.
 */
export function classifyExpiry(daysUntil: number): LotExpiryStatus {
  if (daysUntil <= 30) return "RED"
  if (daysUntil <= 60) return "ORANGE"
  return "GREEN"
}

export function formatDaysUntilExpiry(daysUntil: number): string {
  if (daysUntil < 0) return "Vencido"
  if (daysUntil === 0) return "Vence hoy"
  return `En ${daysUntil} día${daysUntil === 1 ? "" : "s"}`
}

export const lotSchema = z.object({
  id: z.string(),
  productId: z.string(),
  product: z
    .object({
      id: z.string(),
      commercialName: z.string(),
      dciName: z.string(),
    })
    .nullable()
    .optional(),
  lotNumber: z.string(),
  expiryDate: z.string(),
  initialQty: z.number().int(),
  currentQty: z.number().int(),
  voidedAt: z.string().nullable().optional(),
  voidReason: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})
export type Lot = z.infer<typeof lotSchema>

export const paginatedLotsSchema = z.object({
  data: z.array(lotSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedLots = z.infer<typeof paginatedLotsSchema>

export const lotFormSchema = z.object({
  productId: z
    .string()
    .min(1, "Selecciona un producto")
    .optional()
    .refine((value) => Boolean(value?.trim()), {
      message: "Selecciona un producto",
    }),
  lotNumber: z
    .string()
    .min(1, "El número de lote es obligatorio")
    .max(100, "Máximo 100 caracteres"),
  expiryDate: z.string().min(1, "La fecha de vencimiento es obligatoria"),
  initialQty: z
    .number({ message: "Ingresa una cantidad válida" })
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo")
    .max(999999, "Máximo 999999"),
  reason: z
    .string()
    .min(5, "La razón debe tener al menos 5 caracteres")
    .max(500, "Máximo 500 caracteres")
    .optional(),
})
export type LotFormValues = z.infer<typeof lotFormSchema>

export const expiryDashboardLotSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  lotNumber: z.string(),
  expiryDate: z.string(),
  currentQty: z.number().int(),
  status: z.enum(LOT_EXPIRY_STATUSES),
  daysUntilExpiry: z.number().int(),
})
export type ExpiryDashboardLot = z.infer<typeof expiryDashboardLotSchema>

export const expiryDashboardGroupSchema = z.object({
  status: z.enum(LOT_EXPIRY_STATUSES),
  count: z.number(),
  lots: z.array(expiryDashboardLotSchema),
})
export type ExpiryDashboardGroup = z.infer<typeof expiryDashboardGroupSchema>

export const expiryDashboardSchema = z.object({
  generatedAt: z.string(),
  red: expiryDashboardGroupSchema,
  orange: expiryDashboardGroupSchema,
  green: expiryDashboardGroupSchema,
})
export type ExpiryDashboard = z.infer<typeof expiryDashboardSchema>

export const lotTraceMovementSchema = z.object({
  id: z.string(),
  movementType: z.string(),
  quantity: z.number().int(),
  reason: z.string().nullable().optional(),
  createdAt: z.string(),
  userFullName: z.string(),
})
export type LotTraceMovement = z.infer<typeof lotTraceMovementSchema>

export const lotTraceSaleItemSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  createdAt: z.string(),
})
export type LotTraceSaleItem = z.infer<typeof lotTraceSaleItemSchema>

export const lotTraceProductSchema = z.object({
  id: z.string(),
  dciName: z.string(),
  commercialName: z.string(),
  barcode: z.string().nullable().optional(),
  category: z.string(),
})
export type LotTraceProduct = z.infer<typeof lotTraceProductSchema>

export const lotTraceSchema = z.object({
  id: z.string(),
  lotNumber: z.string(),
  expiryDate: z.string(),
  initialQty: z.number().int(),
  currentQty: z.number().int(),
  product: lotTraceProductSchema.nullable().optional(),
  movements: z.array(lotTraceMovementSchema),
  saleItems: z.array(lotTraceSaleItemSchema),
})
export type LotTrace = z.infer<typeof lotTraceSchema>

export interface LotsListQuery {
  page?: number
  pageSize?: number
  productId?: string
  includeVoided?: boolean
  q?: string
}

export interface LotsFiltersValue {
  q: string
  status: LotExpiryStatus | undefined
}
