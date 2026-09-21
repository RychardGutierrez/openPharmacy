import { PurchaseOrderDetail } from "@/features/purchase-orders/components/purchase-order-detail"

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return <PurchaseOrderDetail orderId={orderId} />
}
