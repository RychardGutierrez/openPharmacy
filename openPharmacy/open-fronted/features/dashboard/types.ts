import { z } from "zod"

export const dashboardQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
})
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>

const dateSchema = z.coerce.date()

export const kpisSchema = z.object({
  salesVisible: z.boolean(),
  startAt: dateSchema,
  endAt: dateSchema,
  totalSales: z.number().nullable(),
  transactions: z.number().nullable(),
  unitsSold: z.number(),
  lowStockCount: z.number(),
  expiringCount: z.number(),
  activeAlerts: z.number(),
  cashierTotals: z.array(z.object({
    userId: z.string(),
    fullName: z.string(),
    transactions: z.number(),
    totalSales: z.number(),
  })),
})
export type DashboardKpis = z.infer<typeof kpisSchema>

export const lowStockSchema = z.object({
  generatedAt: dateSchema,
  items: z.array(z.object({
    productId: z.string(),
    commercialName: z.string(),
    dciName: z.string(),
    category: z.string(),
    minStock: z.number(),
    currentStock: z.number(),
    deficit: z.number(),
  })),
})
export type LowStockResponse = z.infer<typeof lowStockSchema>

export const expiringSchema = z.object({
  generatedAt: dateSchema,
  lots: z.array(z.object({
    lotId: z.string(),
    productId: z.string(),
    productName: z.string(),
    lotNumber: z.string(),
    expiryDate: dateSchema,
    currentQty: z.number(),
    daysUntilExpiry: z.number(),
    status: z.enum(["RED", "ORANGE", "GREEN"]),
  })),
})
export type ExpiringResponse = z.infer<typeof expiringSchema>

export const recentSalesSchema = z.object({
  generatedAt: dateSchema,
  sales: z.array(z.object({
    id: z.string(),
    receiptNumber: z.string(),
    createdAt: dateSchema,
    cashier: z.string(),
    paymentMethod: z.string(),
    itemCount: z.number(),
    total: z.number(),
  })),
})
export type RecentSalesResponse = z.infer<typeof recentSalesSchema>

export const salesTrendSchema = z.object({
  generatedAt: dateSchema,
  interval: z.enum(["hour", "day"]),
  points: z.array(z.object({
    bucket: z.string(),
    totalSales: z.number(),
    transactions: z.number(),
  })),
})
export type SalesTrendResponse = z.infer<typeof salesTrendSchema>

export const unitsSoldSchema = z.object({
  generatedAt: dateSchema,
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    unitsSold: z.number(),
  })),
})
export type UnitsSoldResponse = z.infer<typeof unitsSoldSchema>
