"use client"

import { useQuery } from "@tanstack/react-query"
import { getLotTraceability } from "@/features/lots/api/lots-api"
import { lotsKeys } from "@/features/lots/api/use-lots"

export function useLotTraceability(lotNumber: string) {
  return useQuery({
    queryKey: lotsKeys.trace(lotNumber),
    queryFn: () => getLotTraceability(lotNumber),
    enabled: lotNumber.trim().length >= 3,
  })
}
