"use client"

import { useQuery } from "@tanstack/react-query"
import { getShiftSales } from "@/features/shifts/api/shifts-api"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"

export function useShiftSales(shiftId: string | undefined) {
  return useQuery({
    queryKey: [...shiftsKeys.all, "sales", shiftId ?? "none"],
    queryFn: () => getShiftSales(shiftId as string),
    enabled: Boolean(shiftId),
    retry: false,
  })
}
