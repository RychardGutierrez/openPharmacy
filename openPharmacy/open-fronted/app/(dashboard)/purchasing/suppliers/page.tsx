import { RoleGate } from "@/core/guards/role-guard"
import { SuppliersPageClient } from "@/features/suppliers/components/suppliers-page-client"

export default function SuppliersPage() {
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <SuppliersPageClient />
    </RoleGate>
  )
}
