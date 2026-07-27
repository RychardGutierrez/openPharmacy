"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { bulkImportProducts } from "@/features/products/api/products-api"
import { productsKeys } from "@/features/products/api/use-products"
import { PRODUCTS_ERROR_MESSAGES } from "@/features/products/api/constants"

export function useBulkImportProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => bulkImportProducts(file),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: productsKeys.all })
      toast.success(
        `Importación completada: ${response.inserted} producto${response.inserted === 1 ? "" : "s"} creado${response.inserted === 1 ? "" : "s"}.`,
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || PRODUCTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
