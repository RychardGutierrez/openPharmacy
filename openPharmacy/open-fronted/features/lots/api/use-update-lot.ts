"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { updateLot } from "@/features/lots/api/lots-api"
import { lotsKeys } from "@/features/lots/api/use-lots"
import { LOTS_ERROR_MESSAGES } from "@/features/lots/api/constants"
import type { LotFormValues } from "@/features/lots/types"

export function useUpdateLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<LotFormValues> }) =>
      updateLot(id, values),
    onSuccess: (lot) => {
      queryClient.invalidateQueries({ queryKey: lotsKeys.all })
      queryClient.invalidateQueries({ queryKey: lotsKeys.detail(lot.id) })
      toast.success("Lote actualizado")
    },
    onError: (error: Error) => {
      toast.error(error.message || LOTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
