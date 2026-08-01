"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { voidLot } from "@/features/lots/api/lots-api"
import { lotsKeys } from "@/features/lots/api/use-lots"
import { LOTS_ERROR_MESSAGES } from "@/features/lots/api/constants"

export function useVoidLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      voidLot(id, reason),
    onSuccess: (lot) => {
      queryClient.invalidateQueries({ queryKey: lotsKeys.all })
      queryClient.invalidateQueries({ queryKey: lotsKeys.detail(lot.id) })
      toast.success("Lote anulado")
    },
    onError: (error: Error) => {
      toast.error(error.message || LOTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
