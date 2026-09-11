import { z } from "zod"

export const RETURN_TYPES = ["FULL", "PARTIAL"] as const
export type ReturnType = (typeof RETURN_TYPES)[number]

export const RETURN_SOURCES = ["RETURN", "CANCELLATION"] as const
export type ReturnSource = (typeof RETURN_SOURCES)[number]

export const RETURN_TYPE_LABELS: Record<ReturnType, string> = {
  FULL: "Total",
  PARTIAL: "Parcial",
}

export const RETURN_SOURCE_LABELS: Record<ReturnSource, string> = {
  RETURN: "Devolución",
  CANCELLATION: "Cancelación",
}

export const PRODUCT_CATEGORIES = [
  "OTC",
  "PRESCRIPTION_ONLY",
  "PSYCHOTROPIC",
  "NARCOTIC",
  "NON_PHARMACEUTICAL",
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "TRANSFER",
  "QR",
  "MIXED",
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const SALE_STATUSES = ["COMPLETED", "CANCELLED", "REFUNDED"] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  QR: "QR",
  MIXED: "Mixto",
}

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
}

export const CONTROLLED_CATEGORIES: ProductCategory[] = [
  "PSYCHOTROPIC",
  "NARCOTIC",
]

export function isControlledCategory(category: ProductCategory): boolean {
  return CONTROLLED_CATEGORIES.includes(category)
}

export const returnableSaleItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  productCategory: z.enum(PRODUCT_CATEGORIES),
  lotId: z.string().uuid(),
  lotNumber: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number(),
  lineTotal: z.number(),
  alreadyReturnedQuantity: z.number().int().min(0),
})

export const returnableSaleSchema = z.object({
  id: z.string().uuid(),
  receiptNumber: z.string(),
  status: z.enum(SALE_STATUSES),
  createdAt: z.string(),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  cashReceived: z.number(),
  changeGiven: z.number(),
  items: z.array(returnableSaleItemSchema),
})

export const returnResponseItemSchema = z.object({
  id: z.string(),
  saleItemId: z.string(),
  productId: z.string(),
  lotId: z.string(),
  lotNumber: z.string(),
  quantity: z.number().int(),
})

export const returnResponseSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  userId: z.string(),
  reason: z.string(),
  returnType: z.enum(RETURN_TYPES),
  source: z.enum(RETURN_SOURCES),
  createdAt: z.string(),
  items: z.array(returnResponseItemSchema),
})

export const returnListItemSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  receiptNumber: z.string(),
  userName: z.string(),
  reason: z.string(),
  returnType: z.enum(RETURN_TYPES),
  source: z.enum(RETURN_SOURCES),
  createdAt: z.string(),
  itemCount: z.number().int(),
  totalRefund: z.number(),
})

export const returnListResponseSchema = z.object({
  data: z.array(returnListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
})

export type ReturnableSale = z.infer<typeof returnableSaleSchema>
export type ReturnableSaleItem = z.infer<typeof returnableSaleItemSchema>
export type ReturnResponse = z.infer<typeof returnResponseSchema>
export type ReturnListItem = z.infer<typeof returnListItemSchema>
export type ReturnListResponse = z.infer<typeof returnListResponseSchema>

export interface CreateReturnPayload {
  saleId: string
  reason: string
  returnType: ReturnType
  items: Array<{ saleItemId: string; quantity: number }>
}

export interface CancelSalePayload {
  reason: string
}

export const returnFormSchema = z.object({
  returnType: z.enum(RETURN_TYPES),
  reason: z
    .string()
    .min(3, "El motivo debe tener al menos 3 caracteres")
    .max(500, "El motivo no puede exceder 500 caracteres"),
})

export type ReturnFormValues = z.infer<typeof returnFormSchema>
