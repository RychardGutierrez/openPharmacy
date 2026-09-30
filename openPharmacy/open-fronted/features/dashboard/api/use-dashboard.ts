"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { getDashboardKpis, getExpiring, getLowStock, getRecentSales, getSalesTrend, getUnitsSold } from "@/features/dashboard/api/dashboard-api"
import type { DashboardQuery } from "@/features/dashboard/types"

export const dashboardKeys = {
  all: ["dashboard"] as const,
  kpis: (query: DashboardQuery) => ["dashboard", "kpis", query] as const,
  lowStock: (query: DashboardQuery, limit: number) => ["dashboard", "low-stock", query, limit] as const,
  expiring: (query: DashboardQuery, limit: number) => ["dashboard", "expiring", query, limit] as const,
  recentSales: (query: DashboardQuery) => ["dashboard", "recent-sales", query] as const,
  trend: (query: DashboardQuery) => ["dashboard", "trend", query] as const,
  unitsSold: (query: DashboardQuery, limit: number) => ["dashboard", "units-sold", query, limit] as const,
}

export function useDashboardQueries(query: DashboardQuery, expanded: boolean) {
  const salesVisible = useAuthStore((state) => state.user?.role === "ADMIN")
  const limit = expanded ? 50 : 10
  return {
    kpis: useQuery({ queryKey: dashboardKeys.kpis(query), queryFn: () => getDashboardKpis(query) }),
    lowStock: useQuery({ queryKey: dashboardKeys.lowStock(query, limit), queryFn: () => getLowStock(query, limit) }),
    expiring: useQuery({ queryKey: dashboardKeys.expiring(query, limit), queryFn: () => getExpiring(query, limit) }),
    recentSales: useQuery({ queryKey: dashboardKeys.recentSales(query), queryFn: () => getRecentSales(query), enabled: salesVisible }),
    trend: useQuery({ queryKey: dashboardKeys.trend(query), queryFn: () => getSalesTrend(query), enabled: salesVisible }),
    unitsSold: useQuery({ queryKey: dashboardKeys.unitsSold(query, limit), queryFn: () => getUnitsSold(query, limit) }),
  }
}

export function useDashboardInvalidation() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.invalidateQueries({ queryKey: dashboardKeys.all }), [queryClient])
}
