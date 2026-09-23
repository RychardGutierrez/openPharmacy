"use client"

import { useQuery } from "@tanstack/react-query"

import { listPurchaseOrders } from "@/features/purchase-orders/api/purchase-orders-api"
import { purchaseOrdersKeys } from "@/features/purchase-orders/api/use-purchase-orders"

/**
 * Fetch the latest purchase orders for a supplier. Used by the supplier
 * detail panel to render a recent-orders summary.
 */
export function useSupplierRecentOrders(supplierId: string | undefined) {
  return useQuery({
    queryKey: [...purchaseOrdersKeys.all, "supplier-recent", supplierId ?? ""],
    queryFn: () =>
      listPurchaseOrders({ supplierId }, 1, 5),
    enabled: Boolean(supplierId),
    staleTime: 60_000,
  })
}
