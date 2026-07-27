"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createProduct } from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"
import { PRODUCTS_ERROR_MESSAGES } from "@/features/products/api/constants"

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKeys.all })
      toast.success("Producto creado")
    },
    onError: (error: Error) => {
      toast.error(error.message || PRODUCTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
