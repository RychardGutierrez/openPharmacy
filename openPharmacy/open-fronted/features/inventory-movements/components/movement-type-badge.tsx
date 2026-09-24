import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  MOVEMENT_TYPE_LABELS,
  type MovementType,
} from "@/features/inventory-movements/types"

const MOVEMENT_TYPE_VARIANTS: Record<
  MovementType,
  { className: string; label: string }
> = {
  PURCHASE: {
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    label: MOVEMENT_TYPE_LABELS.PURCHASE,
  },
  SALE: {
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    label: MOVEMENT_TYPE_LABELS.SALE,
  },
  RETURN: {
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    label: MOVEMENT_TYPE_LABELS.RETURN,
  },
  CANCELLATION: {
    className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    label: MOVEMENT_TYPE_LABELS.CANCELLATION,
  },
  DAMAGE: {
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    label: MOVEMENT_TYPE_LABELS.DAMAGE,
  },
  EXPIRED: {
    className:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    label: MOVEMENT_TYPE_LABELS.EXPIRED,
  },
  THEFT_LOSS: {
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    label: MOVEMENT_TYPE_LABELS.THEFT_LOSS,
  },
  MANUAL_ADJUSTMENT: {
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    label: MOVEMENT_TYPE_LABELS.MANUAL_ADJUSTMENT,
  },
  ENTRY: {
    className:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    label: MOVEMENT_TYPE_LABELS.ENTRY,
  },
  EXIT: {
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    label: MOVEMENT_TYPE_LABELS.EXIT,
  },
  ADJUSTMENT: {
    className:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    label: MOVEMENT_TYPE_LABELS.ADJUSTMENT,
  },
  TRANSFER: {
    className:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    label: MOVEMENT_TYPE_LABELS.TRANSFER,
  },
}

interface MovementTypeBadgeProps {
  type: MovementType
  className?: string
}

export function MovementTypeBadge({ type, className }: MovementTypeBadgeProps) {
  const config = MOVEMENT_TYPE_VARIANTS[type]
  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
