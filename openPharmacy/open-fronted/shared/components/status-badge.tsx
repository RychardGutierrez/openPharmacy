import { cn } from "@/lib/utils"

type StatusTone = "active" | "inactive"

const statusStyles: Record<StatusTone, string> = {
  active:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inactive:
    "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

export interface StatusBadgeProps {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
  className?: string
}

/**
 * Generic active/inactive pill. Decoupled from any feature so it can be
 * reused for products, users, lots, etc. Defaults are Spanish to match
 * the OpenPharmacy domain.
 */
export function StatusBadge({
  active,
  activeLabel = "Activo",
  inactiveLabel = "Inactivo",
  className,
}: StatusBadgeProps) {
  const tone: StatusTone = active ? "active" : "inactive"
  return (
    <span
      data-slot="status-badge"
      data-status={tone}
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        statusStyles[tone],
        className,
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}
