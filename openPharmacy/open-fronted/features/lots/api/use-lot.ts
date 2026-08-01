"use client"

import { useQuery } from "@tanstack/react-query"
import { getLot } from "@/features/lots/api/lots-api"
import { lotsKeys } from "@/features/lots/api/use-lots"

export function useLot(id: string | undefined) {
  return useQuery({
    queryKey: lotsKeys.detail(id ?? ""),
    queryFn: () => getLot(id ?? ""),
    enabled: Boolean(id),
  })
}
