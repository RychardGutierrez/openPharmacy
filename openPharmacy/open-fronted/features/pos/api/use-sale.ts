"use client"

import { useQuery } from "@tanstack/react-query"
import { getSale } from "@/features/pos/api/sales-api"

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
