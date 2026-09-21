"use client"

import { use } from "react"
import { ReceivePurchaseOrderPageClient } from "@/features/purchase-orders/components/receive-purchase-order-form"

export default function ReceivePurchaseOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = use(params)
  return <ReceivePurchaseOrderPageClient orderId={orderId} />
}
