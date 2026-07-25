"use client"

import type { ReactNode } from "react"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { USER_ROLES, type UserRole } from "@/features/auth/types"
import { AccessDenied } from "@/core/components/access-denied"

export interface RoleGateProps {
  /** Roles allowed to see the children. Defaults to ADMIN only. */
  allowedRoles?: UserRole[]
  children: ReactNode
}

/**
 * Client-side role gate. It assumes the user is already authenticated
 * (i.e. wrapped inside `AuthGuard`).
 *
 * Renders `AccessDenied` when the current user's role is not in
 * `allowedRoles`. Otherwise renders `children`.
 */
export function RoleGate({ allowedRoles = [USER_ROLES[0]], children }: RoleGateProps) {
  const user = useAuthStore((state) => state.user)

  if (!user || !allowedRoles.includes(user.role)) {
    return <AccessDenied />
  }

  return <>{children}</>
}
