"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  applySinDefault,
  bulkAssignSin,
  getSinSummary,
  listSinDefaults,
  setSinDefault,
  type BulkAssignSinInput,
} from "@/features/products/api/products-api"
import { PRODUCTS_ERROR_MESSAGES } from "@/features/products/api/constants"
import { productsKeys } from "@/features/products/api/use-products"
import type { ProductCategory, SinCodes } from "@/features/products/types"

const sinSummaryKey = [...productsKeys.all, "sin-summary"] as const
const sinDefaultsKey = [...productsKeys.all, "sin-defaults"] as const

/** Pending counter of SIN homologation (SIAT-08). */
export function useSinSummary() {
  return useQuery({ queryKey: sinSummaryKey, queryFn: getSinSummary })
}

/** Default SIN codes per category (SIAT-08). */
export function useSinDefaults(enabled = true) {
  return useQuery({ queryKey: sinDefaultsKey, queryFn: listSinDefaults, enabled })
}

/** Every SIN mutation changes product codes and the pending count, so all product queries refresh. */
function useInvalidateProducts() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: productsKeys.all })
}

export function useBulkAssignSin() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (input: BulkAssignSinInput) => bulkAssignSin(input),
    onSuccess: (result) => {
      void invalidate()
      toast.success(
        result.updated === 1
          ? "Código SIN asignado a 1 producto"
          : `Códigos SIN asignados a ${result.updated} productos`,
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || PRODUCTS_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useSetSinDefault() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: ({ category, codes }: { category: ProductCategory; codes: SinCodes }) =>
      setSinDefault(category, codes),
    onSuccess: () => {
      void invalidate()
      toast.success("Códigos SIN por defecto guardados")
    },
    onError: (error: Error) => {
      toast.error(error.message || PRODUCTS_ERROR_MESSAGES.GENERIC)
    },
  })
}

export function useApplySinDefault() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (category: ProductCategory) => applySinDefault(category),
    onSuccess: (result) => {
      void invalidate()
      toast.success(
        result.updated === 0
          ? "No había productos sin códigos en esta categoría"
          : `Códigos aplicados a ${result.updated} producto${result.updated === 1 ? "" : "s"}`,
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || PRODUCTS_ERROR_MESSAGES.GENERIC)
    },
  })
}
