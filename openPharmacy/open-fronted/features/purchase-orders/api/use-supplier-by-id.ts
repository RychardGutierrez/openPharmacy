"use client"

import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  supplierSummarySchema,
  type SupplierSummary,
} from "@/features/purchase-orders/api/use-search-suppliers"

export const supplierByIdKeys = {
  detail: (id: string) => ["suppliers", "detail", id] as const,
}

/**
 * Fetch a single supplier by id. Used to populate the supplier picker when
 * editing an existing order.
 */
export function useSupplierById(id: string | undefined) {
  return useQuery<SupplierSummary | null>({
    queryKey: supplierByIdKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null
      const token = useAuthStore.getState().accessToken
      const response = await fetch(`/api/suppliers/${id}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`Failed to fetch supplier (${response.status})`)
      }
      const json = await response.json()
      return supplierSummarySchema.parse(json)
    },
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  })
}

const supplierListSchema = z.array(supplierSummarySchema)
export { supplierListSchema }
