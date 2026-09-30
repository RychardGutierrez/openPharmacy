import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  expiringSchema,
  kpisSchema,
  lowStockSchema,
  recentSalesSchema,
  salesTrendSchema,
  unitsSoldSchema,
  type DashboardQuery,
  type ExpiringResponse,
  type DashboardKpis,
  type LowStockResponse,
  type RecentSalesResponse,
  type SalesTrendResponse,
  type UnitsSoldResponse,
} from "@/features/dashboard/types"

export class DashboardApiError extends Error {}

async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const token = useAuthStore.getState().accessToken
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new DashboardApiError("No se pudo cargar el dashboard.")
  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) throw new DashboardApiError("La respuesta del dashboard es inválida.")
  return parsed.data
}

function queryString(query: DashboardQuery, extra: Record<string, string | number> = {}) {
  const params = new URLSearchParams({ ...query, ...Object.fromEntries(
    Object.entries(extra).map(([key, value]) => [key, String(value)]),
  ) })
  return `?${params.toString()}`
}

export function getDashboardKpis(query: DashboardQuery): Promise<DashboardKpis> {
  return request(`/dashboard/kpis${queryString(query)}`, kpisSchema)
}

export function getLowStock(query: DashboardQuery, limit: number): Promise<LowStockResponse> {
  return request(`/dashboard/low-stock${queryString(query, { limit })}`, lowStockSchema)
}

export function getExpiring(query: DashboardQuery, limit: number): Promise<ExpiringResponse> {
  return request(`/dashboard/expiring${queryString(query, { horizonDays: 90, limit })}`, expiringSchema)
}

export function getRecentSales(query: DashboardQuery): Promise<RecentSalesResponse> {
  return request(`/dashboard/recent-sales${queryString(query, { limit: 10 })}`, recentSalesSchema)
}

export function getSalesTrend(query: DashboardQuery): Promise<SalesTrendResponse> {
  const interval = query.from === query.to ? "hour" : "day"
  return request(`/dashboard/sales-trend${queryString(query, { interval })}`, salesTrendSchema)
}

export function getUnitsSold(query: DashboardQuery, limit: number): Promise<UnitsSoldResponse> {
  return request(`/dashboard/units-sold${queryString(query, { limit })}`, unitsSoldSchema)
}
