"use client"

import { useQuery } from "@tanstack/react-query"
import { getMySales, getSale } from "@/features/pos/api/sales-api"

export const salesKeys = {
  all: ["sales"] as const,
  detail: (id: string) => [...salesKeys.all, "detail", id] as const,
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: salesKeys.detail(id ?? ""),
    queryFn: () => getSale(id ?? ""),
    enabled: Boolean(id),
  })
}

export function useMySales(page: number, fromDate: string, toDate: string, enabled = true) {
  return useQuery({
    queryKey: [...salesKeys.all, "mine", page, fromDate, toDate],
    queryFn: () => getMySales(page, 10, fromDate, toDate),
    enabled,
  })
}
