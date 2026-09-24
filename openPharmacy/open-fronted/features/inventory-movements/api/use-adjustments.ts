"use client"

import { useQuery } from "@tanstack/react-query"
import { listAdjustments } from "@/features/inventory-movements/api/inventory-movements-api"
import type { AdjustmentsListQuery } from "@/features/inventory-movements/types"

export const adjustmentsKeys = {
  all: ["adjustments"] as const,
  list: (query: AdjustmentsListQuery) => [...adjustmentsKeys.all, "list", query] as const,
}

export function useAdjustments(query: AdjustmentsListQuery = {}) {
  return useQuery({
    queryKey: adjustmentsKeys.list(query),
    queryFn: () => listAdjustments(query),
  })
}
