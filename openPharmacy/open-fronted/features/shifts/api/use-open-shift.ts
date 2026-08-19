"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { openShift } from "@/features/shifts/api/shifts-api"
import { SHIFTS_ERROR_MESSAGES } from "@/features/shifts/api/constants"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"
import { useShiftStore } from "@/features/shifts/store/shift-store"
import type { OpenShiftFormValues } from "@/features/shifts/types"

export function useOpenShift() {
  const queryClient = useQueryClient()
  const setOpenShift = useShiftStore((state) => state.setOpenShift)
  return useMutation({
    mutationFn: (values: OpenShiftFormValues) => openShift(values),
    onSuccess: (shift) => {
      setOpenShift(shift)
      queryClient.setQueryData(shiftsKeys.current(shift.userId), shift)
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all })
      toast.success("Turno abierto")
    },
    onError: (error: Error) => toast.error(error.message || SHIFTS_ERROR_MESSAGES.GENERIC),
  })
}
