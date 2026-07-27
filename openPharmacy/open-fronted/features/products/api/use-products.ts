"use client"

import { useQuery } from "@tanstack/react-query"
import { listProducts, type ProductsListQuery } from "@/features/products/api/products-api"

export const productsKeys = {
  all: ["products"] as const,
  list: (query: ProductsListQuery) => [...productsKeys.all, "list", query] as const,
  detail: (id: string) => [...productsKeys.all, "detail", id] as const,
  search: (q: string) => [...productsKeys.all, "search", q] as const,
}

export function useProducts(query: ProductsListQuery = {}) {
  return useQuery({
    queryKey: productsKeys.list(query),
    queryFn: () => listProducts(query),
  })
}
