"use client"

import {
  Pill,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { USER_ROLES, type UserRole } from "@/features/auth/types"
import { USER_ROLE_LABELS } from "@/features/users/types"
import { cn } from "@/lib/utils"

const roleConfig: Record<UserRole, { icon: LucideIcon; description: string }> = {
  ADMIN: {
    icon: Pill,
    description: "Full system access and user management.",
  },
  PHARMACIST: {
    icon: Stethoscope,
    description: "Manage prescriptions and inventory.",
  },
  CASHIER: {
    icon: Wallet,
    description: "Process sales and returns.",
  },
}

export interface RoleCardGroupProps {
  value: UserRole
  onChange: (value: UserRole) => void
  name: string
}

/**
 * Accessible radio group of role cards. Renders three large selectable
 * cards (Admin, Pharmacist, Cashier) and reports the selection to a
 * controlled parent (typically `react-hook-form`).
 */
export function RoleCardGroup({ value, onChange, name }: RoleCardGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Role"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {USER_ROLES.map((role) => {
        const isSelected = value === role
        const { icon: Icon, description } = roleConfig[role]
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-state={isSelected ? "checked" : "unchecked"}
            name={name}
            onClick={() => onChange(role)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left transition-all outline-none",
              isSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{USER_ROLE_LABELS[role]}</span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </button>
        )
      })}
    </div>
  )
}
