import { z } from "zod"

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "TRANSFER",
  "QR",
  "MIXED",
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const MIXED_SECONDARY_METHODS = ["CARD", "QR", "TRANSFER"] as const
export type MixedSecondaryMethod = (typeof MIXED_SECONDARY_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  QR: "QR",
  MIXED: "Mixto",
}

export const SALE_STATUSES = ["COMPLETED", "CANCELLED", "REFUNDED"] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  barcode: z.string(),
  commercialName: z.string(),
  dciName: z.string(),
  category: z.string(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().min(1),
  discountPct: z.number().min(0).max(100).default(0),
  availableQty: z.number().int().nonnegative().default(0),
  earliestExpiry: z.string().nullable().default(null),
  expiringSoon: z.boolean().default(false),
  fefoLots: z
    .array(
      z.object({
        lotId: z.string(),
        lotNumber: z.string(),
        expiryDate: z.string(),
        availableQty: z.number().int().nonnegative(),
      }),
    )
    .default([]),
})
export type CartLine = z.infer<typeof cartLineSchema>

export const saleReceiptItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  lotId: z.string(),
  lotNumber: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  lineTotal: z.number(),
})
export type SaleReceiptItem = z.infer<typeof saleReceiptItemSchema>

export const saleReceiptSchema = z.object({
  id: z.string(),
  receiptNumber: z.string(),
  shiftId: z.string(),
  userId: z.string(),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  secondaryMethod: z.enum(MIXED_SECONDARY_METHODS).nullable().optional(),
  cashReceived: z.number(),
  changeGiven: z.number(),
  status: z.enum(SALE_STATUSES),
  createdAt: z.string(),
  pharmacy: z.record(z.string(), z.string()),
  items: z.array(saleReceiptItemSchema),
})
export type SaleReceipt = z.infer<typeof saleReceiptSchema>

export interface CreateSaleItemPayload {
  productId: string
  quantity: number
}

export interface CreateSalePayload {
  items: CreateSaleItemPayload[]
  paymentMethod: PaymentMethod
  secondaryMethod?: MixedSecondaryMethod
  discount?: number
  cashReceived?: number
  prescriptionProductIds?: string[]
}

export const RECEIPT_NOTA_FISCAL_FOOTER = "THIS DOCUMENT IS NOT A NOTA FISCAL"

export function isPrescriptionCategory(category: string): boolean {
  return (
    category === "PRESCRIPTION_ONLY" ||
    category === "PSYCHOTROPIC" ||
    category === "NARCOTIC"
  )
}

export function lineTotal(line: CartLine): number {
  const gross = Math.round(line.unitPrice * line.quantity * 100) / 100
  const discount = Math.round(gross * (line.discountPct / 100) * 100) / 100
  return Math.round((gross - discount) * 100) / 100
}
