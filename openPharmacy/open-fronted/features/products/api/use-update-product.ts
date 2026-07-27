"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { updateProduct } from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"
import { PRODUCTS_ERROR_MESSAGES } from "@/features/products/api/constants"

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(id, values),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: productsKeys.all })
      queryClient.invalidateQueries({ queryKey: productsKeys.detail(id) })
      toast.success("Producto actualizado")
    },
    onError: (error: Error) => {
      toast.error(error.message || PRODUCTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
