import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  activateSupplier,
  createSupplier,
  deactivateSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
  type SupplierApiError,
} from "@/features/suppliers/api/suppliers-api"
import { SUPPLIER_ERROR_MESSAGES } from "@/features/suppliers/api/suppliers-api"
import type { SuppliersListQuery } from "@/features/suppliers/types"

export const suppliersKeys = {
  all: ["suppliers"] as const,
  list: (query: SuppliersListQuery) => [...suppliersKeys.all, "list", query] as const,
  detail: (id: string) => [...suppliersKeys.all, "detail", id] as const,
  active: () => [...suppliersKeys.all, "active"] as const,
}

export function useSuppliers(query: SuppliersListQuery = {}) {
  return useQuery({
    queryKey: suppliersKeys.list(query),
    queryFn: () => listSuppliers(query),
    placeholderData: (previous) => previous,
  })
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: suppliersKeys.detail(id ?? ""),
    queryFn: () => getSupplier(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suppliersKeys.all })
      toast.success("Proveedor creado")
    },
    onError: (error: Error) => {
      toast.error(error.message || SUPPLIER_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Parameters<typeof updateSupplier>[1] }) =>
      updateSupplier(id, values),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: suppliersKeys.all })
      queryClient.invalidateQueries({ queryKey: suppliersKeys.detail(id) })
      toast.success("Proveedor actualizado")
    },
    onError: (error: Error) => {
      toast.error(error.message || SUPPLIER_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useDeactivateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deactivateSupplier,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: suppliersKeys.all })
      queryClient.invalidateQueries({ queryKey: suppliersKeys.detail(id) })
      toast.success("Proveedor desactivado")
    },
    onError: (error: Error) => {
      toast.error(error.message || SUPPLIER_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useActivateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activateSupplier,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: suppliersKeys.all })
      queryClient.invalidateQueries({ queryKey: suppliersKeys.detail(id) })
      toast.success("Proveedor activado")
    },
    onError: (error: Error) => {
      toast.error(error.message || SUPPLIER_ERROR_MESSAGES.GENERIC)
    },
  })
}

export { type SupplierApiError }
