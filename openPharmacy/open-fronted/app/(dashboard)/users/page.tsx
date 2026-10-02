import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { UsersPageClient } from "@/features/users/components/users-page-client"

export const metadata: Metadata = {
  title: "Users | OpenPharmacy",
  description: "Gestiona los usuarios y roles del sistema.",
}

export default function UsersPage() {
  return (
    <RoleGate allowedRoles={["ADMIN"]}>
      <UsersPageClient />
    </RoleGate>
  )
}
