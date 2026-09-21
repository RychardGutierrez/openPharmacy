"use client"

import {
  CircleDashedIcon,
  CircleCheckIcon,
  CircleXIcon,
  PackageCheckIcon,
  TruckIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderStatus,
} from "@/features/purchase-orders/types"

const STATUS_TONE: Record<
  PurchaseOrderStatus,
  {
    icon: typeof CircleDashedIcon
    className: string
  }
> = {
  PENDING: {
    icon: CircleDashedIcon,
    className: "bg-muted text-foreground border-border",
  },
  ORDERED: {
    icon: TruckIcon,
    className: "bg-accent text-accent-foreground border-transparent",
  },
  PARTIAL: {
    icon: PackageCheckIcon,
    className: "bg-chart-3/15 text-chart-3 border-transparent",
  },
  RECEIVED: {
    icon: CircleCheckIcon,
    className: "bg-chart-2/15 text-chart-2 border-transparent",
  },
  CANCELLED: {
    icon: CircleXIcon,
    className: "bg-destructive/15 text-destructive border-transparent",
  },
}

export interface PurchaseOrderStatusBadgeProps {
  status: PurchaseOrderStatus
  className?: string
}

export function PurchaseOrderStatusBadge({
  status,
  className,
}: PurchaseOrderStatusBadgeProps) {
  const tone = STATUS_TONE[status]
  const Icon = tone.icon
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 ${tone.className} ${className ?? ""}`}
      aria-label={`Estado: ${PURCHASE_ORDER_STATUS_LABELS[status]}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{PURCHASE_ORDER_STATUS_LABELS[status]}</span>
    </Badge>
  )
}
