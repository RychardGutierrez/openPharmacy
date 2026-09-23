"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { lotsKeys } from "@/features/lots/api/use-lots"
import {
  createPurchaseOrder,
  getLastSupplierCost,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from "@/features/purchase-orders/api/purchase-orders-api"
import { useSuppliers as useSuppliersBase } from "@/features/suppliers/api/use-suppliers"
import type { Supplier } from "@/features/suppliers/types"
import { PURCHASE_ORDER_ERROR_MESSAGES } from "@/features/purchase-orders/api/messages"
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrder,
  PurchaseOrderFiltersValue,
  PurchaseOrderList,
  ReceivePurchaseOrderPayload,
  ReceivingResponse,
  UpdatePurchaseOrderPayload,
} from "@/features/purchase-orders/types"

export const purchaseOrdersKeys = {
  all: ["purchase-orders"] as const,
  list: (filters: PurchaseOrderFiltersValue, page: number, pageSize: number) =>
    [...purchaseOrdersKeys.all, "list", filters, page, pageSize] as const,
  detail: (id: string) => [...purchaseOrdersKeys.all, "detail", id] as const,
  suppliers: () => ["suppliers"] as const,
  lastCost: (supplierId: string, productId: string) =>
    [...purchaseOrdersKeys.all, "last-cost", supplierId, productId] as const,
}

export function useSuppliers() {
  const query = useSuppliersBase({ active: true, page: 1, pageSize: 1000 })
  return {
    ...query,
    data: query.data?.data,
  } as Omit<typeof query, "data"> & { data: Supplier[] | undefined }
}

export function usePurchaseOrders(
  filters: PurchaseOrderFiltersValue,
  page: number,
  pageSize: number,
) {
  return useQuery<PurchaseOrderList>({
    queryKey: purchaseOrdersKeys.list(filters, page, pageSize),
    queryFn: () => listPurchaseOrders(filters, page, pageSize),
    placeholderData: (previous) => previous,
  })
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery<PurchaseOrder>({
    queryKey: purchaseOrdersKeys.detail(id ?? ""),
    queryFn: () => getPurchaseOrder(id as string),
    enabled: Boolean(id),
  })
}

export function useLastSupplierCost(
  supplierId: string | undefined,
  productId: string | undefined,
) {
  return useQuery({
    queryKey: purchaseOrdersKeys.lastCost(supplierId ?? "", productId ?? ""),
    queryFn: () =>
      getLastSupplierCost(supplierId as string, productId as string),
    enabled: Boolean(supplierId && productId),
    staleTime: 60 * 1000,
  })
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation<PurchaseOrder, Error, CreatePurchaseOrderPayload>({
    mutationFn: createPurchaseOrder,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrdersKeys.all })
      toast.success(`Orden ${order.supplierName} creada como borrador`)
    },
    onError: (error) => {
      toast.error(error.message || PURCHASE_ORDER_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation<PurchaseOrder, Error, { id: string; payload: UpdatePurchaseOrderPayload }>({
    mutationFn: ({ id, payload }) => updatePurchaseOrder(id, payload),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrdersKeys.all })
      queryClient.setQueryData(purchaseOrdersKeys.detail(order.id), order)
      toast.success("Borrador actualizado")
    },
    onError: (error) => {
      toast.error(error.message || PURCHASE_ORDER_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useSubmitPurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation<PurchaseOrder, Error, string>({
    mutationFn: submitPurchaseOrder,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrdersKeys.all })
      queryClient.setQueryData(purchaseOrdersKeys.detail(order.id), order)
      toast.success(`Orden enviada a ${order.supplierName}`)
    },
    onError: (error) => {
      toast.error(error.message || PURCHASE_ORDER_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation<
    ReceivingResponse,
    Error,
    { id: string; payload: ReceivePurchaseOrderPayload }
  >({
    mutationFn: ({ id, payload }) => receivePurchaseOrder(id, payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrdersKeys.all })
      queryClient.invalidateQueries({ queryKey: lotsKeys.all })
      toast.success(`Recepción registrada para la orden`)
      void response
    },
    onError: (error) => {
      toast.error(error.message || PURCHASE_ORDER_ERROR_MESSAGES.GENERIC)
    },
  })
}
