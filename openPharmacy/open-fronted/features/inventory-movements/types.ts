import { z } from "zod"

export const MOVEMENT_TYPES = [
  "PURCHASE",
  "SALE",
  "RETURN",
  "CANCELLATION",
  "DAMAGE",
  "EXPIRED",
  "THEFT_LOSS",
  "MANUAL_ADJUSTMENT",
  "ENTRY",
  "EXIT",
  "ADJUSTMENT",
  "TRANSFER",
] as const

export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PURCHASE: "Compra",
  SALE: "Venta",
  RETURN: "Devolución",
  CANCELLATION: "Cancelación",
  DAMAGE: "Daño",
  EXPIRED: "Vencido",
  THEFT_LOSS: "Robo / Pérdida",
  MANUAL_ADJUSTMENT: "Ajuste manual",
  ENTRY: "Entrada",
  EXIT: "Salida",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Traspaso",
}

export const ADJUSTMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number]

export const ADJUSTMENT_STATUS_LABELS: Record<AdjustmentStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
}

export const ADJUSTMENT_DIRECTIONS = ["INCREASE", "DECREASE"] as const
export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number]

export const ADJUSTMENT_DIRECTION_LABELS: Record<AdjustmentDirection, string> = {
  INCREASE: "Incremento",
  DECREASE: "Decremento",
}

const movementRelationSchema = z.object({
  id: z.string(),
  commercialName: z.string(),
})

const movementLotSchema = z.object({
  id: z.string(),
  lotNumber: z.string(),
})

const movementUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
})

export const movementSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  lot_id: z.string(),
  user_id: z.string(),
  movementType: z.enum(MOVEMENT_TYPES),
  quantity: z.number().int(),
  reason: z.string().nullable(),
  approved_by: z.string().nullable(),
  created_at: z.string(),
  product: movementRelationSchema.nullable().optional(),
  lot: movementLotSchema.nullable().optional(),
  user: movementUserSchema.nullable().optional(),
  approver: movementUserSchema.nullable().optional(),
})
export type Movement = z.infer<typeof movementSchema>

export const paginatedMovementsSchema = z.object({
  data: z.array(movementSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedMovements = z.infer<typeof paginatedMovementsSchema>

export const adjustmentSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  lot_id: z.string(),
  requested_by: z.string(),
  quantity: z.number().int(),
  direction: z.enum(ADJUSTMENT_DIRECTIONS),
  movementType: z.enum(MOVEMENT_TYPES),
  reason: z.string(),
  status: z.enum(ADJUSTMENT_STATUSES),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
  product: movementRelationSchema.nullable().optional(),
  lot: movementLotSchema.nullable().optional(),
  requester: movementUserSchema.nullable().optional(),
  approver: movementUserSchema.nullable().optional(),
})
export type Adjustment = z.infer<typeof adjustmentSchema>

export const paginatedAdjustmentsSchema = z.object({
  data: z.array(adjustmentSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedAdjustments = z.infer<typeof paginatedAdjustmentsSchema>

export const createAdjustmentFormSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  lotId: z.string().min(1, "Selecciona un lote"),
  direction: z.enum(ADJUSTMENT_DIRECTIONS),
  quantity: z
    .number({ message: "Ingresa una cantidad válida" })
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad debe ser al menos 1")
    .max(999999, "Máximo 999999"),
  reason: z
    .string()
    .min(20, "El motivo debe tener al menos 20 caracteres")
    .max(500, "Máximo 500 caracteres"),
})
export type CreateAdjustmentFormValues = z.infer<typeof createAdjustmentFormSchema>

export interface MovementsFiltersValue {
  productId: string | undefined
  lotId: string | undefined
  movementType: MovementType | undefined
  userId: string | undefined
  from: string | undefined
  to: string | undefined
}

export interface MovementsListQuery {
  page?: number
  pageSize?: number
  productId?: string
  lotId?: string
  movementType?: MovementType
  userId?: string
  from?: string
  to?: string
}

export interface AdjustmentsListQuery {
  page?: number
  pageSize?: number
  productId?: string
  lotId?: string
  status?: AdjustmentStatus
  requestedBy?: string
}

export const userLookupResultSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
})
export type UserLookupResult = z.infer<typeof userLookupResultSchema>
