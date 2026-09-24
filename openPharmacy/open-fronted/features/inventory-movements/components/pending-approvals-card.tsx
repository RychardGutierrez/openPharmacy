"use client"

import { useState } from "react"
import { Check, Clock, X } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { useApproveAdjustment } from "@/features/inventory-movements/api/use-approve-adjustment"
import { useRejectAdjustment } from "@/features/inventory-movements/api/use-reject-adjustment"
import {
  ADJUSTMENT_DIRECTION_LABELS,
  type Adjustment,
} from "@/features/inventory-movements/types"

export interface PendingApprovalsCardProps {
  adjustments: Adjustment[]
}

export function PendingApprovalsCard({ adjustments }: PendingApprovalsCardProps) {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === "ADMIN"
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set())

  const approve = useApproveAdjustment()
  const reject = useRejectAdjustment()

  const visibleAdjustments = adjustments.filter(
    (adjustment) => !optimisticIds.has(adjustment.id),
  )

  const handleApprove = (id: string) => {
    setOptimisticIds((prev) => new Set(prev).add(id))
    approve.mutate(id, {
      onError: () => {
        setOptimisticIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      },
    })
  }

  const handleReject = (id: string) => {
    setOptimisticIds((prev) => new Set(prev).add(id))
    reject.mutate(id, {
      onError: () => {
        setOptimisticIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      },
    })
  }

  if (visibleAdjustments.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          Aprobaciones pendientes
        </CardTitle>
        <CardDescription>
          Ajustes manuales a la espera de aprobación por un administrador.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {visibleAdjustments.map((adjustment) => (
          <div
            key={adjustment.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {adjustment.product?.commercialName ?? adjustment.product_id}
                </span>
                <span className="text-sm text-muted-foreground">
                  · {adjustment.lot?.lotNumber ?? adjustment.lot_id}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {ADJUSTMENT_DIRECTION_LABELS[adjustment.direction]} de{" "}
                <span className="font-medium tabular-nums">
                  {adjustment.quantity}
                </span>{" "}
                unidades
              </p>
              <p className="text-sm text-muted-foreground">
                Solicitado por {adjustment.requester?.fullName ?? adjustment.requested_by}
                {" · "}
                {format(new Date(adjustment.created_at), "dd/MM/yyyy HH:mm")}
              </p>
              <p className="text-sm italic text-muted-foreground">
                “{adjustment.reason}”
              </p>
            </div>

            {isAdmin ? (
              <div className="flex flex-row gap-2 sm:flex-col lg:flex-row">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(adjustment.id)}
                  disabled={approve.isPending || reject.isPending}
                >
                  <X className="size-4" aria-hidden="true" />
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(adjustment.id)}
                  disabled={approve.isPending || reject.isPending}
                >
                  <Check className="size-4" aria-hidden="true" />
                  Aprobar
                </Button>
              </div>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Esperando administrador
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
