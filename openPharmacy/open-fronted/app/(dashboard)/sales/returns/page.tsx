import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { ReturnsPageClient } from "@/features/returns/components/returns-page-client"

export const metadata: Metadata = {
  title: "Devoluciones",
  description: "Procesar devoluciones y cancelaciones de ventas",
}

export default function ReturnsPage() {
  return (
    <RoleGate allowedRoles={["PHARMACIST", "ADMIN"]}>
      <ReturnsPageClient />
    </RoleGate>
  )
}
