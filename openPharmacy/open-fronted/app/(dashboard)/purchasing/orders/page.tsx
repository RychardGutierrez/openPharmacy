import { RoleGate } from "@/core/guards/role-guard"
import { PurchaseOrdersPageClient } from "@/features/purchase-orders/components/purchase-orders-page-client"

export default function PurchaseOrdersPage() {
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <PurchaseOrdersPageClient />
    </RoleGate>
  )
}
