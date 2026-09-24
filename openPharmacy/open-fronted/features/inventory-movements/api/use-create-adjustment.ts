"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createAdjustment } from "@/features/inventory-movements/api/inventory-movements-api"
import { adjustmentsKeys } from "@/features/inventory-movements/api/use-adjustments"

export function useCreateAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAdjustment,
    onSuccess: () => {
      toast.success("Solicitud de ajuste enviada")
      void queryClient.invalidateQueries({ queryKey: adjustmentsKeys.all })
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo enviar el ajuste")
    },
  })
}
