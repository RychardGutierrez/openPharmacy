"use client"

import { useQuery } from "@tanstack/react-query"
import { searchProducts } from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"

export function useSearchProducts(q: string, includeStock = false) {
  return useQuery({
    queryKey: productsKeys.search(includeStock ? `${q}|stock` : q),
    queryFn: () => searchProducts(q, includeStock),
    enabled: q.trim().length >= 1,
  })
}
