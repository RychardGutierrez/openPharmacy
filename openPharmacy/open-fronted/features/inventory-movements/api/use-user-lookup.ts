"use client"

import { useQuery } from "@tanstack/react-query"
import { lookupUsers } from "@/features/inventory-movements/api/inventory-movements-api"

export const userLookupKeys = {
  all: ["users", "lookup"] as const,
  search: (q: string) => [...userLookupKeys.all, q] as const,
}

export function useUserLookup(q: string) {
  return useQuery({
    queryKey: userLookupKeys.search(q),
    queryFn: () => lookupUsers(q, 20),
    enabled: q.trim().length >= 2,
  })
}
