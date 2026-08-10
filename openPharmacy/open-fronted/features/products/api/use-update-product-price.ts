"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  updateProductPrice,
  type UpdateProductPriceValues,
} from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"
import { PRODUCTS_ERROR_MESSAGES } from "@/features/products/api/constants"

export function useUpdateProductPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateProductPriceValues }) =>
      updateProductPrice(id, values),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: productsKeys.detail(product.id) })
      queryClient.invalidateQueries({ queryKey: productsKeys.list({}) })
      toast.success("Precio actualizado")
    },
    onError: (error: Error) => {
      toast.error(error.message || PRODUCTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
