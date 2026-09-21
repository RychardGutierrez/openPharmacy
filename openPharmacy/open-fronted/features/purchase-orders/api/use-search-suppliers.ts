"use client"

import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"

export const supplierSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  nit: z.string(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  active: z.boolean(),
})
export type SupplierSummary = z.infer<typeof supplierSummarySchema>

const searchResponseSchema = z.object({
  data: z.array(supplierSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})

export const supplierSearchKeys = {
  all: ["suppliers", "search"] as const,
  query: (q: string) => [...supplierSearchKeys.all, q] as const,
}

/**
 * Search suppliers by name, NIT, or contact. The hook only runs when the
 * search term has at least one character so the picker stays idle until
 * the user actually starts looking for a supplier.
 */
export function useSupplierSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: supplierSearchKeys.query(trimmed),
    queryFn: async (): Promise<SupplierSummary[]> => {
      const token = useAuthStore.getState().accessToken
      const response = await fetch(
        `/api/suppliers/search?q=${encodeURIComponent(trimmed)}&page=1&pageSize=20`,
        {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch suppliers (${response.status})`)
      }
      const json = await response.json()
      return searchResponseSchema.parse(json).data
    },
    enabled: trimmed.length >= 1,
    staleTime: 30_000,
  })
}
