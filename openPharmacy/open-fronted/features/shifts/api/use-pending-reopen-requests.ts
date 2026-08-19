"use client"

import { useQuery } from "@tanstack/react-query"
import { listPendingReopenRequests } from "@/features/shifts/api/shifts-api"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"

export function usePendingReopenRequests() {
  return useQuery({ queryKey: shiftsKeys.reopenRequests(), queryFn: listPendingReopenRequests, retry: false })
}
