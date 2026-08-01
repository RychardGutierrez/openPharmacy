"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createLot } from "@/features/lots/api/lots-api"
import { lotsKeys } from "@/features/lots/api/use-lots"
import { LOTS_ERROR_MESSAGES } from "@/features/lots/api/constants"

export function useCreateLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createLot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lotsKeys.all })
      toast.success("Lote creado")
    },
    onError: (error: Error) => {
      toast.error(error.message || LOTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
