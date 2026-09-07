"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { createSale, PosApiError } from "@/features/pos/api/sales-api"
import { POS_ERROR_MESSAGES } from "@/features/pos/api/constants"
import type { CreateSalePayload, SaleReceipt } from "@/features/pos/types"
import { lotsKeys } from "@/features/lots/api/use-lots"
import { shiftsKeys } from "@/features/shifts/api/use-shifts-keys"
import { usePosStore } from "@/features/pos/store/pos-store"

export function useCreateSale() {
  const queryClient = useQueryClient()
  const finishSale = usePosStore((state) => state.finishSale)

  return useMutation<SaleReceipt, PosApiError, CreateSalePayload>({
    mutationFn: createSale,
    onSuccess: (receipt) => {
      finishSale(receipt)
      queryClient.invalidateQueries({ queryKey: lotsKeys.all })
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all })
      toast.success(`Venta ${receipt.receiptNumber} registrada`)
    },
    onError: (error) => {
      toast.error(error.message || POS_ERROR_MESSAGES.GENERIC)
    },
  })
}
