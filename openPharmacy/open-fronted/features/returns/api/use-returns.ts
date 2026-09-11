"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { salesKeys } from "@/features/pos/api/use-sale"
import { lotsKeys } from "@/features/lots/api/use-lots"
import {
  cancelSale,
  createReturn,
  getReturnableSale,
  getReturns,
  ReturnsApiError,
} from "@/features/returns/api/returns-api"
import { RETURNS_ERROR_MESSAGES } from "@/features/returns/api/constants"
import type {
  CancelSalePayload,
  CreateReturnPayload,
  ReturnableSale,
  ReturnListResponse,
  ReturnResponse,
} from "@/features/returns/types"

export const returnsKeys = {
  all: ["returns"] as const,
  detail: (receiptNumber: string) =>
    [...returnsKeys.all, "sale", receiptNumber] as const,
  list: (page: number, pageSize: number) =>
    [...returnsKeys.all, "list", page, pageSize] as const,
}

export function useReturnableSale(receiptNumber: string | undefined) {
  return useQuery<ReturnableSale, ReturnsApiError>({
    queryKey: returnsKeys.detail(receiptNumber ?? ""),
    queryFn: () => getReturnableSale(receiptNumber ?? ""),
    enabled: Boolean(receiptNumber),
  })
}

export function useCreateReturn() {
  const queryClient = useQueryClient()

  return useMutation<ReturnResponse, ReturnsApiError, CreateReturnPayload>({
    mutationFn: createReturn,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: returnsKeys.all })
      queryClient.invalidateQueries({ queryKey: salesKeys.all })
      queryClient.invalidateQueries({ queryKey: lotsKeys.all })
      toast.success(`Devolución ${response.returnType === "FULL" ? "total" : "parcial"} registrada`)
    },
    onError: (error) => {
      toast.error(error.message || RETURNS_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useCancelSale() {
  const queryClient = useQueryClient()

  return useMutation<
    ReturnResponse,
    ReturnsApiError,
    { saleId: string; payload: CancelSalePayload }
  >({
    mutationFn: ({ saleId, payload }) => cancelSale(saleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: returnsKeys.all })
      queryClient.invalidateQueries({ queryKey: salesKeys.all })
      queryClient.invalidateQueries({ queryKey: lotsKeys.all })
      toast.success("Venta cancelada")
    },
    onError: (error) => {
      toast.error(error.message || RETURNS_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useReturns(page = 1, pageSize = 20) {
  return useQuery<ReturnListResponse, ReturnsApiError>({
    queryKey: returnsKeys.list(page, pageSize),
    queryFn: () => getReturns(page, pageSize),
  })
}
