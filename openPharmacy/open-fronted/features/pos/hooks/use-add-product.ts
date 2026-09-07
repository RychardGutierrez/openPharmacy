"use client"

import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { getLotsByProduct } from "@/features/lots/api/lots-api"
import { lotsKeys } from "@/features/lots/api/use-lots"
import { usePosStore } from "@/features/pos/store/pos-store"
import { POS_ERROR_MESSAGES } from "@/features/pos/api/constants"
import type { Product } from "@/features/products/types"

interface LotRow {
  id: string
  lotNumber: string
  expiryDate: string
  currentQty: number
}

export function useAddProduct() {
  const queryClient = useQueryClient()
  const addProduct = usePosStore((state) => state.addProduct)

  async function add(product: Product): Promise<void> {
    let lots: LotRow[] = []
    try {
      lots = await queryClient.fetchQuery({
        queryKey: lotsKeys.byProduct(product.id, false),
        queryFn: () => getLotsByProduct(product.id, false),
      })
    } catch {
      toast.error(POS_ERROR_MESSAGES.GENERIC)
      return
    }

    const sellable = lots.filter(
      (lot) => new Date(lot.expiryDate).getTime() >= Date.now() - 86_400_000,
    )
    const availableQty = sellable.reduce((sum, lot) => sum + lot.currentQty, 0)

    if (availableQty <= 0) {
      toast.warning(`${product.commercialName} sin stock disponible`)
      return
    }

    const inCart = usePosStore
      .getState()
      .lines.find((line) => line.productId === product.id)
    if (inCart && inCart.quantity >= availableQty) {
      toast.warning(
        `Stock máximo alcanzado para ${product.commercialName} (${availableQty})`,
      )
      return
    }

    addProduct(product, lots)
  }

  return { add }
}
