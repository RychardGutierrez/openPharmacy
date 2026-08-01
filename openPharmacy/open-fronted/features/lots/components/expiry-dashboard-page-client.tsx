"use client"

import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useExpiryDashboard } from "@/features/lots/api/use-expiry-dashboard"
import { LOT_EXPIRY_LABELS, type ExpiryDashboardLot } from "@/features/lots/types"

function DashboardCard({
  status,
  count,
  lots,
}: {
  status: "RED" | "ORANGE" | "GREEN"
  count: number
  lots: ExpiryDashboardLot[]
}) {
  const router = useRouter()
  const icon =
    status === "RED" ? (
      <AlertTriangle className="size-5 text-red-600" aria-hidden="true" />
    ) : status === "ORANGE" ? (
      <AlertCircle className="size-5 text-orange-600" aria-hidden="true" />
    ) : (
      <CheckCircle2 className="size-5 text-green-600" aria-hidden="true" />
    )

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-base">{LOT_EXPIRY_LABELS[status]}</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{count} lote(s)</p>
      </CardHeader>
      <CardContent className="flex-1">
        {lots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin lotes en esta banda.</p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
            {lots.map((lot) => (
              <li
                key={lot.id}
                className="flex cursor-pointer items-center justify-between rounded border border-border p-2 text-sm transition-colors hover:bg-muted/40"
                onClick={() => router.push(`/inventory/products/${lot.productId}/lots`)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    router.push(`/inventory/products/${lot.productId}/lots`)
                  }
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{lot.lotNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {lot.productName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block tabular-nums">{lot.currentQty} u.</span>
                  <span className="text-xs text-muted-foreground">
                    {lot.daysUntilExpiry <= 0
                      ? "Vencido"
                      : `En ${lot.daysUntilExpiry} días`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function ExpiryDashboardPageClient() {
  const { data, isLoading, error } = useExpiryDashboard()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vencimientos</h1>
        <p className="text-sm text-muted-foreground">
          Lotes próximos a vencer y lotes vigentes.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando dashboard…</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          {error.message || "No se pudo cargar el dashboard."}
        </p>
      ) : data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <DashboardCard status="RED" count={data.red.count} lots={data.red.lots} />
          <DashboardCard
            status="ORANGE"
            count={data.orange.count}
            lots={data.orange.lots}
          />
          <DashboardCard
            status="GREEN"
            count={data.green.count}
            lots={data.green.lots}
          />
        </div>
      ) : null}
    </div>
  )
}
