"use client"

import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_ORDER,
  type PurchaseOrderStatus,
} from "@/features/purchase-orders/types"

export interface PurchaseOrderStatusRailProps {
  status: PurchaseOrderStatus
}

export function PurchaseOrderStatusRail({ status }: PurchaseOrderStatusRailProps) {
  const currentIndex = PURCHASE_ORDER_STATUS_ORDER.indexOf(status)
  const cancelled = status === "CANCELLED"

  return (
    <ol
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0"
      aria-label="Estado de la orden"
    >
      {PURCHASE_ORDER_STATUS_ORDER.map((step, index) => {
        const isCompleted = !cancelled && currentIndex >= index
        const isCurrent = !cancelled && currentIndex === index
        const isLast = index === PURCHASE_ORDER_STATUS_ORDER.length - 1
        return (
          <li
            key={step}
            className="flex flex-1 items-center gap-2 sm:flex-col sm:items-start sm:gap-1"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {isCompleted ? (
                  <CheckIcon className="size-4" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  isCurrent
                    ? "text-foreground"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {PURCHASE_ORDER_STATUS_LABELS[step]}
              </span>
            </div>
            {!isLast ? (
              <span
                className={cn(
                  "hidden h-px flex-1 sm:mx-2 sm:block",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
                aria-hidden="true"
              />
            ) : null}
          </li>
        )
      })}
      {cancelled ? (
        <li
          className="ml-2 inline-flex items-center rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive"
          aria-label="Orden cancelada"
        >
          {PURCHASE_ORDER_STATUS_LABELS.CANCELLED}
        </li>
      ) : null}
    </ol>
  )
}
