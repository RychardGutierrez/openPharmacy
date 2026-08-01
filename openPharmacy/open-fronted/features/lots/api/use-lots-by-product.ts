"use client"

import { useQuery } from "@tanstack/react-query"
import { getLotsByProduct } from "@/features/lots/api/lots-api"
import { lotsKeys } from "@/features/lots/api/use-lots"

export function useLotsByProduct(
  productId: string | undefined,
  includeVoided = false,
) {
  return useQuery({
    queryKey: lotsKeys.byProduct(productId ?? "", includeVoided),
    queryFn: () => getLotsByProduct(productId ?? "", includeVoided),
    enabled: Boolean(productId),
  })
}
