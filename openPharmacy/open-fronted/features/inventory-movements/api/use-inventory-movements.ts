"use client"

import { useQuery } from "@tanstack/react-query"
import { listMovements } from "@/features/inventory-movements/api/inventory-movements-api"
import type { MovementsListQuery } from "@/features/inventory-movements/types"

export const inventoryMovementsKeys = {
  all: ["inventory-movements"] as const,
  list: (query: MovementsListQuery) => [...inventoryMovementsKeys.all, "list", query] as const,
}

export function useInventoryMovements(query: MovementsListQuery = {}) {
  return useQuery({
    queryKey: inventoryMovementsKeys.list(query),
    queryFn: () => listMovements(query),
  })
}
