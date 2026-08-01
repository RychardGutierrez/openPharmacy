"use client"

import { useQuery } from "@tanstack/react-query"
import { searchProducts } from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"

export function useSearchProducts(q: string) {
  return useQuery({
    queryKey: productsKeys.search(q),
    queryFn: () => searchProducts(q),
    enabled: q.trim().length >= 1,
  })
}
