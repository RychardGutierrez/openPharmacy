import { RoleGate } from "@/core/guards/role-guard"
import { PosPageClient } from "@/features/pos/components/pos-page-client"

export default function PosPage() {
  return (
    <RoleGate allowedRoles={["CASHIER", "PHARMACIST"]}>
      <PosPageClient />
    </RoleGate>
  )
}
