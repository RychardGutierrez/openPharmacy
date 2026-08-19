"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { requestReopen } from "@/features/shifts/api/shifts-api"
import { SHIFTS_ERROR_MESSAGES } from "@/features/shifts/api/constants"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"
import type { ReopenRequestFormValues } from "@/features/shifts/types"

export function useRequestReopen() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ shiftId, values }: { shiftId: string; values: ReopenRequestFormValues }) => requestReopen(shiftId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all })
      toast.success("Solicitud de reapertura enviada")
    },
    onError: (error: Error) => toast.error(error.message || SHIFTS_ERROR_MESSAGES.GENERIC),
  })
}
