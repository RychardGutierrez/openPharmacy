import { z } from "zod"

import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from "@/features/returns/types"

export const PURCHASE_ORDER_STATUSES = [
  "PENDING",
  "ORDERED",
  "PARTIAL",
  "RECEIVED",
  "CANCELLED",
] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  PENDING: "Borrador",
  ORDERED: "Enviada",
  PARTIAL: "Recibida parcialmente",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
}

export const PURCHASE_ORDER_STATUS_ORDER: PurchaseOrderStatus[] = [
  "PENDING",
  "ORDERED",
  "PARTIAL",
  "RECEIVED",
]

const optionalDateString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Fecha inválida",
  })

export { supplierSchema, type Supplier } from "@/features/suppliers/types"

export const purchaseOrderLineSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  qtyOrdered: z.number().int().min(1),
  qtyReceived: z.number().int().min(0),
  unitCost: z.number().min(0),
})
export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>

export const purchaseOrderSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  supplierNit: z.string(),
  userId: z.string(),
  userName: z.string(),
  userRole: z.string(),
  status: z.enum(PURCHASE_ORDER_STATUSES),
  orderDate: z.string(),
  items: z.array(purchaseOrderLineSchema),
  createdAt: z.string(),
})
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>

export const receivingLotSchema = z.object({
  lotId: z.string(),
  lotNumber: z.string(),
  productId: z.string(),
  productName: z.string(),
  qtyReceived: z.number().int().min(0),
  unitCost: z.number(),
})
export type ReceivingLot = z.infer<typeof receivingLotSchema>

export const receivingResponseSchema = z.object({
  receivingId: z.string(),
  orderId: z.string(),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  receivedBy: z.string(),
  status: z.enum(PURCHASE_ORDER_STATUSES),
  lots: z.array(receivingLotSchema),
  createdAt: z.string(),
})
export type ReceivingResponse = z.infer<typeof receivingResponseSchema>

export const purchaseOrderListSchema = z.object({
  data: z.array(purchaseOrderSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
})
export type PurchaseOrderList = z.infer<typeof purchaseOrderListSchema>

export const lastSupplierCostSchema = z.object({
  supplierId: z.string(),
  productId: z.string(),
  unitCost: z.number(),
  invoiceDate: z.string(),
})
export type LastSupplierCost = z.infer<typeof lastSupplierCostSchema>

export const draftLineSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  productName: z.string(),
  qtyOrdered: z.coerce
    .number({ message: "La cantidad debe ser un número" })
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad debe ser mayor o igual a 1")
    .max(999999, "La cantidad excede el máximo permitido"),
  unitCost: z.coerce
    .number({ message: "El costo unitario debe ser un número" })
    .min(0.01, "El costo unitario debe ser mayor o igual a 0.01")
    .max(99999999.99, "El costo unitario excede el máximo permitido"),
})
export type DraftLine = z.infer<typeof draftLineSchema>

export const purchaseOrderFormSchema = z.object({
  supplierId: z.string().min(1, "Selecciona un proveedor"),
  orderDate: optionalDateString,
  items: z
    .array(draftLineSchema)
    .min(1, "Agrega al menos un producto"),
})
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>

export const receiveLineSchema = z.object({
  orderItemId: z.string(),
  qtyReceived: z.coerce
    .number({ message: "La cantidad debe ser un número" })
    .int("La cantidad debe ser un número entero")
    .min(0, "La cantidad debe ser mayor o igual a 0"),
  lotNumber: z.string().trim().optional(),
  expiryDate: z.string().optional(),
  unitCost: z.coerce
    .number({ message: "El costo unitario debe ser un número" })
    .min(0.01, "El costo unitario debe ser mayor o igual a 0.01"),
})
export type ReceiveLineFormValues = z.infer<typeof receiveLineSchema>

export interface PurchaseOrderFiltersValue {
  status?: PurchaseOrderStatus
  supplierId?: string
  q?: string
}

export interface CreatePurchaseOrderPayload {
  supplierId: string
  orderDate: string
  items: Array<{
    productId: string
    qtyOrdered: number
    unitCost: number
  }>
}

export interface UpdatePurchaseOrderPayload {
  supplierId?: string
  orderDate?: string
  reason?: string
  items: Array<{
    orderItemId: string
    productId: string
    qtyOrdered: number
    unitCost: number
  }>
}

export interface ReceivePurchaseOrderPayload {
  invoiceNumber: string
  invoiceDate: string
  items: Array<{
    orderItemId: string
    qtyReceived: number
    lotNumber: string
    expiryDate: string
    unitCost: number
  }>
}

export const PRODUCT_CATEGORIES_FOR_PURCHASE = PRODUCT_CATEGORIES
export type ProductCategoryForPurchase = ProductCategory

export const PURCHASE_ORDER_ERROR_CODES = [
  "GENERIC",
  "PURCHASE_ORDER_NOT_PENDING",
  "PURCHASE_ORDER_EMPTY",
  "PURCHASE_ORDER_NOT_RECEIVABLE",
  "PURCHASE_ORDER_ITEM_NOT_FOUND",
  "PURCHASE_ORDER_ITEM_MISMATCH",
  "PURCHASE_ORDER_QTY_EXCEEDED",
  "EXPIRY_DATE_IN_PAST",
  "LOT_VOIDED",
  "LOT_EXPIRY_MISMATCH",
  "LOT_COST_MISMATCH",
  "PRODUCT_INACTIVE",
  "VALIDATION",
  "NOT_FOUND",
] as const
export type PurchaseOrderErrorCode =
  (typeof PURCHASE_ORDER_ERROR_CODES)[number]
