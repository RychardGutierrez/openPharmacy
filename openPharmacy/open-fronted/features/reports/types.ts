import { z } from "zod"

export const REPORT_TYPES = [
  "SALES_SUMMARY",
  "SALES_DETAIL",
  "INVENTORY_MOVEMENTS",
  "STOCK_SNAPSHOT",
  "EXPIRY",
  "PURCHASES",
  "RETURNS",
] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_FORMATS = ["XLSX", "PDF"] as const
export type ReportFormat = (typeof REPORT_FORMATS)[number]

export const REPORT_STATUSES = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_GROUPS = ["PRODUCT", "CASHIER"] as const
export type ReportGroupBy = (typeof REPORT_GROUPS)[number]

export const REPORT_VIEWS = ["RETURNS", "ADJUSTMENTS"] as const
export type ReportView = (typeof REPORT_VIEWS)[number]

export const PRODUCT_CATEGORIES = [
  "OTC",
  "PRESCRIPTION_ONLY",
  "PSYCHOTROPIC",
  "NARCOTIC",
  "NON_PHARMACEUTICAL",
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  SALES_SUMMARY: "Ventas",
  SALES_DETAIL: "Detalle de ventas",
  INVENTORY_MOVEMENTS: "Movimientos de inventario",
  STOCK_SNAPSHOT: "Inventario actual",
  EXPIRY: "Vencimientos",
  PURCHASES: "Compras",
  RETURNS: "Devoluciones y ajustes",
}

export const REPORT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  OTC: "Venta libre",
  PRESCRIPTION_ONLY: "Con receta",
  PSYCHOTROPIC: "Psicotrópico",
  NARCOTIC: "Estupefaciente",
  NON_PHARMACEUTICAL: "No farmacéutico",
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  QUEUED: "En cola",
  PROCESSING: "Generando",
  COMPLETED: "Listo",
  FAILED: "Fallido",
}

export interface ReportFiltersValue {
  from: string
  to: string
  timezone: string
  category?: ProductCategory
  productId?: string
  supplierId?: string
  userId?: string
  movementType?: string
  horizonDays?: number
  groupBy?: ReportGroupBy
  view?: ReportView
}

export interface ReportDefinition {
  id: string
  label: string
  description: string
  icon: "sales" | "ranking" | "cashier" | "stock" | "valuation" | "lot" | "expiry" | "purchase" | "returns"
  reportType: ReportType
  groupBy?: ReportGroupBy
  defaultView?: ReportView
  dateMode: "today" | "month" | "range" | "none"
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "daily-sales",
    label: "Ventas del día",
    description: "Transacciones y recaudación de hoy",
    icon: "sales",
    reportType: "SALES_SUMMARY",
    dateMode: "today",
  },
  {
    id: "monthly-sales",
    label: "Ventas del mes",
    description: "Evolución de ventas por día",
    icon: "sales",
    reportType: "SALES_SUMMARY",
    dateMode: "month",
  },
  {
    id: "product-ranking",
    label: "Ranking de productos",
    description: "Productos con mayor movimiento",
    icon: "ranking",
    reportType: "SALES_DETAIL",
    groupBy: "PRODUCT",
    dateMode: "range",
  },
  {
    id: "cashier-performance",
    label: "Rendimiento por cajero",
    description: "Ventas agrupadas por usuario",
    icon: "cashier",
    reportType: "SALES_DETAIL",
    groupBy: "CASHIER",
    dateMode: "range",
  },
  {
    id: "current-stock",
    label: "Stock actual",
    description: "Existencias disponibles por lote",
    icon: "stock",
    reportType: "STOCK_SNAPSHOT",
    dateMode: "none",
  },
  {
    id: "inventory-valuation",
    label: "Valorización",
    description: "Valor de inventario a costo",
    icon: "valuation",
    reportType: "STOCK_SNAPSHOT",
    dateMode: "none",
  },
  {
    id: "lot-inventory",
    label: "Inventario por lote",
    description: "Detalle de lotes y vencimientos",
    icon: "lot",
    reportType: "STOCK_SNAPSHOT",
    dateMode: "none",
  },
  {
    id: "expiry",
    label: "Reporte de vencimientos",
    description: "Lotes próximos a vencer",
    icon: "expiry",
    reportType: "EXPIRY",
    dateMode: "none",
  },
  {
    id: "purchases",
    label: "Compras",
    description: "Órdenes y recepción de compras",
    icon: "purchase",
    reportType: "PURCHASES",
    dateMode: "range",
  },
  {
    id: "returns-adjustments",
    label: "Devoluciones / ajustes",
    description: "Movimientos que modifican el inventario",
    icon: "returns",
    reportType: "RETURNS",
    defaultView: "RETURNS",
    dateMode: "range",
  },
]

export const previewColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  format: z.enum(["text", "number", "money", "date", "datetime"]).optional(),
})

export const previewSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  columns: z.array(previewColumnSchema),
  rows: z.array(z.record(z.string(), z.unknown())),
  totals: z.array(z.object({ label: z.string(), value: z.union([z.number(), z.string()]) })).optional(),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
  estimatedRows: z.number(),
  isLargeReport: z.boolean(),
})
export type ReportPreview = z.infer<typeof previewSchema>

export const reportJobSchema = z.object({
  id: z.string(),
  reportType: z.enum(REPORT_TYPES),
  format: z.enum(REPORT_FORMATS),
  status: z.enum(REPORT_STATUSES),
  timezone: z.string(),
  requestedBy: z.string(),
  filters: z.record(z.string(), z.unknown()),
  requestedAt: z.string().or(z.date()),
  startedAt: z.string().or(z.date()).nullable(),
  completedAt: z.string().or(z.date()).nullable(),
  expiresAt: z.string().or(z.date()).nullable(),
  fileName: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
})
export type ReportJob = z.infer<typeof reportJobSchema>

export const paginatedReportJobsSchema = z.object({
  data: z.array(reportJobSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedReportJobs = z.infer<typeof paginatedReportJobsSchema>
