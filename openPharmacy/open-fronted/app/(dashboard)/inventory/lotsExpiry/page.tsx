import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { ExpiryDashboardPageClient } from "@/features/lots/components/expiry-dashboard-page-client"

export const metadata: Metadata = {
  title: "Vencimientos | OpenPharmacy",
  description: "Lotes próximos a vencer y lotes vigentes.",
}

export default function LotsExpiryPage() {
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <ExpiryDashboardPageClient />
    </RoleGate>
  )
}
