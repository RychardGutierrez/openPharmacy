import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { NewUserPageClient } from "@/app/(dashboard)/users/new/new-user-page-client"

export const metadata: Metadata = {
  title: "New user | OpenPharmacy",
  description: "Crea un nuevo usuario del sistema.",
}

export default function NewUserPage() {
  return (
    <RoleGate allowedRoles={["ADMIN"]}>
      <NewUserPageClient />
    </RoleGate>
  )
}
