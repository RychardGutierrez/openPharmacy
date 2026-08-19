import { z } from "zod"

export const SHIFT_STATUSES = ["OPEN", "CLOSED"] as const
export type ShiftStatus = (typeof SHIFT_STATUSES)[number]

export const SHIFT_REOPEN_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const
export type ShiftReopenRequestStatus = (typeof SHIFT_REOPEN_REQUEST_STATUSES)[number]

function parsePrismaDecimal(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value
  const decimal = value as { s?: unknown; e?: unknown; d?: unknown }
  if (typeof decimal.s !== "number" || typeof decimal.e !== "number" || !Array.isArray(decimal.d)) {
    return value
  }
  const digits = decimal.d.map((digit) => String(digit).padStart(7, "0")).join("").replace(/^0+(?=\d)/, "")
  const decimalPosition = decimal.e + 1
  const coefficient = digits || "0"
  const normalized = decimalPosition <= 0
    ? `0.${"0".repeat(Math.abs(decimalPosition))}${coefficient}`
    : decimalPosition >= coefficient.length
      ? `${coefficient}${"0".repeat(decimalPosition - coefficient.length)}`
      : `${coefficient.slice(0, decimalPosition)}.${coefficient.slice(decimalPosition)}`
  return decimal.s < 0 ? `-${normalized}` : normalized
}

const moneySchema = z.preprocess(parsePrismaDecimal, z.coerce.number().finite().nonnegative())

const rawShiftSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  opening_cash: moneySchema,
  closing_cash: moneySchema.nullable(),
  expected_cash: moneySchema.nullable(),
  status: z.enum(SHIFT_STATUSES),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
})

export const shiftSchema = rawShiftSchema.transform((shift) => ({
  id: shift.id,
  userId: shift.user_id,
  openingCash: shift.opening_cash,
  closingCash: shift.closing_cash,
  expectedCash: shift.expected_cash,
  status: shift.status,
  openedAt: shift.opened_at,
  closedAt: shift.closed_at,
}))
export type Shift = z.infer<typeof shiftSchema>

export const shiftCloseResponseSchema = z.object({
  shift: shiftSchema,
  countedCash: z.coerce.number(),
  expectedCash: z.coerce.number(),
  difference: z.coerce.number(),
})
export type ShiftCloseResponse = z.infer<typeof shiftCloseResponseSchema>

const shiftSalesSchema = z.object({
  products: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    quantity: z.number().int(),
    total: z.number(),
  })),
  totals: z.object({
    units: z.number().int(),
    distinctProducts: z.number().int(),
    transactions: z.number().int(),
    grossSales: z.number(),
    discounts: z.number(),
    returns: z.number(),
    netSales: z.number(),
  }),
  payments: z.record(z.string(), z.number()),
})
export type ShiftSales = z.infer<typeof shiftSalesSchema>
export { shiftSalesSchema }

export const openShiftFormSchema = z.object({
  openingCash: moneySchema,
})
export type OpenShiftFormValues = z.infer<typeof openShiftFormSchema>

export const closeShiftFormSchema = z.object({
  closingCash: moneySchema,
})
export type CloseShiftFormValues = z.infer<typeof closeShiftFormSchema>

const rawReopenRequestSchema = z.object({
  id: z.string(),
  shift_id: z.string(),
  requested_by: z.string(),
  reason: z.string(),
  status: z.enum(SHIFT_REOPEN_REQUEST_STATUSES),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const shiftReopenRequestSchema = rawReopenRequestSchema.transform((request) => ({
  id: request.id,
  shiftId: request.shift_id,
  requestedBy: request.requested_by,
  reason: request.reason,
  status: request.status,
  reviewedBy: request.reviewed_by,
  reviewedAt: request.reviewed_at,
  createdAt: request.created_at,
  updatedAt: request.updated_at,
}))
export type ShiftReopenRequest = z.infer<typeof shiftReopenRequestSchema>

const requesterSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  roleName: z.string().optional(),
})

export const shiftReopenRequestWithRelationsSchema = rawReopenRequestSchema
  .extend({
    shift: rawShiftSchema,
    requester: requesterSchema,
  })
  .transform((request) => ({
    ...shiftReopenRequestSchema.parse(request),
    shift: shiftSchema.parse(request.shift),
    requester: {
      id: request.requester.id,
      fullName: request.requester.full_name,
      email: request.requester.email,
      role: request.requester.roleName,
    },
  }))
export type ShiftReopenRequestWithRelations = z.infer<typeof shiftReopenRequestWithRelationsSchema>

export const reopenRequestFormSchema = z.object({
  reason: z.string().trim().min(5, "La razón debe tener al menos 5 caracteres").max(500, "Máximo 500 caracteres"),
})
export type ReopenRequestFormValues = z.infer<typeof reopenRequestFormSchema>

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
}

export const SHIFT_REOPEN_STATUS_LABELS: Record<ShiftReopenRequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
}
