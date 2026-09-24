import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { MovementsPageClient } from "@/features/inventory-movements/components/movements-page-client"

export const metadata: Metadata = {
  title: "Movimientos | OpenPharmacy",
  description: "Registra movimientos de stock y gestiona ajustes.",
}

export default function MovementsPage() {
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <MovementsPageClient />
    </RoleGate>
  )
}
