import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { LotsPageClient } from "@/features/lots/components/lots-page-client"

export const metadata: Metadata = {
  title: "Lotes | OpenPharmacy",
  description: "Todos los lotes del inventario.",
}

export default function LotsPage() {
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <LotsPageClient />
    </RoleGate>
  )
}
