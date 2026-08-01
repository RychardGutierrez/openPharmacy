import { cn } from "@/lib/utils"
import {
  classifyExpiry,
  formatDaysUntilExpiry,
  type LotExpiryStatus,
} from "@/features/lots/types"
import { LOT_EXPIRY_TONE } from "@/features/lots/types"

export interface LotStatusBadgeProps {
  daysUntil: number
  className?: string
}

export function LotStatusBadge({ daysUntil, className }: LotStatusBadgeProps) {
  const status: LotExpiryStatus = classifyExpiry(daysUntil)
  return (
    <span
      data-slot="lot-status-badge"
      data-status={status}
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        LOT_EXPIRY_TONE[status],
        className,
      )}
    >
      {formatDaysUntilExpiry(daysUntil)}
    </span>
  )
}
