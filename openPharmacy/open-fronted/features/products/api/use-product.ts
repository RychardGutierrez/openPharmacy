"use client"

import { useQuery } from "@tanstack/react-query"
import { getProduct } from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"

export function useProduct(id: string) {
  return useQuery({
    queryKey: productsKeys.detail(id),
    queryFn: () => getProduct(id),
    enabled: Boolean(id),
  })
}
