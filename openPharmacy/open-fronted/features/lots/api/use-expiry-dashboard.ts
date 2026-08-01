"use client"

import { useQuery } from "@tanstack/react-query"
import { getExpiryDashboard } from "@/features/lots/api/lots-api"
import { lotsKeys } from "@/features/lots/api/use-lots"

export function useExpiryDashboard() {
  return useQuery({
    queryKey: lotsKeys.dashboard(),
    queryFn: getExpiryDashboard,
  })
}
