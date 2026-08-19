"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { SHIFTS_ERROR_MESSAGES } from "@/features/shifts/api/constants"
import { approveReopenRequest, rejectReopenRequest, reopenShiftDirectly } from "@/features/shifts/api/shifts-api"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"

function useReopenMutation<TVariables>(mutationFn: (value: TVariables) => Promise<unknown>, success: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all })
      toast.success(success)
    },
    onError: (error: Error) => toast.error(error.message || SHIFTS_ERROR_MESSAGES.GENERIC),
  })
}

export function useApproveReopenRequest() { return useReopenMutation(approveReopenRequest, "Turno reabierto") }
export function useRejectReopenRequest() { return useReopenMutation(rejectReopenRequest, "Solicitud rechazada") }
export function useReopenShiftDirectly() { return useReopenMutation(reopenShiftDirectly, "Turno reabierto directamente") }
