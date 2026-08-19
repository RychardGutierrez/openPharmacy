"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { getCurrentShift } from "@/features/shifts/api/shifts-api"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"

export function useCurrentShift() {
  const userId = useAuthStore((state) => state.user?.id)
  return useQuery({
    queryKey: shiftsKeys.current(userId),
    queryFn: getCurrentShift,
    enabled: Boolean(userId),
    retry: false,
  })
}
