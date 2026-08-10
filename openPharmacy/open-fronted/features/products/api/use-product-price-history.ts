"use client"

import { useQuery } from "@tanstack/react-query"
import { getProductPriceHistory } from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"

export function useProductPriceHistory(id: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...productsKeys.detail(id), "price-history", page, pageSize],
    queryFn: () => getProductPriceHistory(id, page, pageSize),
    enabled: Boolean(id),
  })
}
