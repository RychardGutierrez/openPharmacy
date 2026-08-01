"use client"

import { useQuery } from "@tanstack/react-query"
import { listLots } from "@/features/lots/api/lots-api"
import type { LotsListQuery } from "@/features/lots/types"

export const lotsKeys = {
  all: ["lots"] as const,
  list: (query: LotsListQuery) => [...lotsKeys.all, "list", query] as const,
  detail: (id: string) => [...lotsKeys.all, "detail", id] as const,
  byProduct: (productId: string, includeVoided?: boolean) =>
    [...lotsKeys.all, "byProduct", productId, includeVoided ?? false] as const,
  dashboard: () => [...lotsKeys.all, "dashboard"] as const,
  trace: (lotNumber: string) =>
    [...lotsKeys.all, "trace", lotNumber] as const,
}

export function useLots(query: LotsListQuery = {}) {
  return useQuery({
    queryKey: lotsKeys.list(query),
    queryFn: () => listLots(query),
  })
}
