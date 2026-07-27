"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { activateProduct } from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"
import { PRODUCTS_ERROR_MESSAGES } from "@/features/products/api/constants"

export function useActivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => activateProduct(id),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: productsKeys.all })
      queryClient.invalidateQueries({ queryKey: productsKeys.detail(product.id) })
      toast.success("Producto reactivado")
    },
    onError: (error: Error) => {
      toast.error(error.message || PRODUCTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
