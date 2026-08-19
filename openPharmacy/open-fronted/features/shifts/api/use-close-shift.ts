"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { closeShift } from "@/features/shifts/api/shifts-api"
import { SHIFTS_ERROR_MESSAGES } from "@/features/shifts/api/constants"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"
import { useShiftStore } from "@/features/shifts/store/shift-store"
import type { CloseShiftFormValues } from "@/features/shifts/types"

export function useCloseShift() {
  const queryClient = useQueryClient()
  const clearOpenShift = useShiftStore((state) => state.clearOpenShift)
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CloseShiftFormValues }) => closeShift(id, values),
    onSuccess: (result) => {
      clearOpenShift()
      queryClient.setQueryData(shiftsKeys.current(result.shift.userId), null)
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all })
      toast.success(`Turno cerrado. Diferencia: Bs ${Math.abs(result.difference).toFixed(2)}`)
    },
    onError: (error: Error) => toast.error(error.message || SHIFTS_ERROR_MESSAGES.GENERIC),
  })
}
