"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { listMyShifts } from "@/features/shifts/api/shifts-api"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"

export function useShiftHistory() {
  const userId = useAuthStore((state) => state.user?.id)
  return useQuery({
    queryKey: [...shiftsKeys.all, "mine", userId ?? "anonymous"],
    queryFn: listMyShifts,
    enabled: Boolean(userId),
    retry: false,
  })
}
