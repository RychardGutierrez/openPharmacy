"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrder,
} from "@/features/purchase-orders/types"

const KPI_CARDS: Array<{
  status: PurchaseOrder["status"]
  description: string
}> = [
  { status: "PENDING", description: "Borradores sin enviar" },
  { status: "ORDERED", description: "Esperando recepción" },
  { status: "PARTIAL", description: "Recepción incompleta" },
  { status: "RECEIVED", description: "Recepción completa" },
]

export function PurchaseOrderKpiGrid({ orders }: { orders: PurchaseOrder[] }) {
  const counts: Record<PurchaseOrder["status"], number> = {
    PENDING: 0,
    ORDERED: 0,
    PARTIAL: 0,
    RECEIVED: 0,
    CANCELLED: 0,
  }
  for (const order of orders) counts[order.status] += 1

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {KPI_CARDS.map((entry) => (
        <Card key={entry.status} className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {PURCHASE_ORDER_STATUS_LABELS[entry.status]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {counts[entry.status]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
