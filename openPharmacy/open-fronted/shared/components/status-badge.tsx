import { cn } from "@/lib/utils"
import {
  USER_STATUS_LABELS,
  type UserStatus,
} from "@/features/users/types"

const statusStyles: Record<UserStatus, string> = {
  active:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inactive:
    "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

export interface StatusBadgeProps {
  status: UserStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        statusStyles[status],
        className,
      )}
    >
      {USER_STATUS_LABELS[status]}
    </span>
  )
}
