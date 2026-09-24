"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { approveAdjustment } from "@/features/inventory-movements/api/inventory-movements-api"
import { adjustmentsKeys } from "@/features/inventory-movements/api/use-adjustments"
import { inventoryMovementsKeys } from "@/features/inventory-movements/api/use-inventory-movements"

export function useApproveAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approveAdjustment,
    onSuccess: () => {
      toast.success("Ajuste aprobado")
      void queryClient.invalidateQueries({ queryKey: adjustmentsKeys.all })
      void queryClient.invalidateQueries({ queryKey: inventoryMovementsKeys.all })
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo aprobar el ajuste")
    },
  })
}
