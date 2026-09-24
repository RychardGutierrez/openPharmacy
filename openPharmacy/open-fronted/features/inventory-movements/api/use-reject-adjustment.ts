"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { rejectAdjustment } from "@/features/inventory-movements/api/inventory-movements-api"
import { adjustmentsKeys } from "@/features/inventory-movements/api/use-adjustments"

export function useRejectAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: rejectAdjustment,
    onSuccess: () => {
      toast.success("Ajuste rechazado")
      void queryClient.invalidateQueries({ queryKey: adjustmentsKeys.all })
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo rechazar el ajuste")
    },
  })
}
