import { cn } from "@/lib/utils"
import type { UserRole } from "@/features/auth/types"
import { USER_ROLE_LABELS } from "@/features/users/types"

const roleStyles: Record<UserRole, string> = {
  ADMIN:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  PHARMACIST:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  CASHIER:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
}

export interface RoleBadgeProps {
  role: UserRole
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      data-slot="role-badge"
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        roleStyles[role],
        className,
      )}
    >
      {USER_ROLE_LABELS[role]}
    </span>
  )
}
