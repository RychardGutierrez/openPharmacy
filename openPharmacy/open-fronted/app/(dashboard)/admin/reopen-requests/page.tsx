import type { Metadata } from "next"
import { RoleGate } from "@/core/guards/role-guard"
import { ReopenRequestsPageClient } from "@/features/shifts/components/reopen-requests-page-client"

export const metadata: Metadata = { title: "Solicitudes de reapertura", description: "Revisión de solicitudes de reapertura de turno" }

export default function ReopenRequestsPage() {
  return <RoleGate allowedRoles={["ADMIN"]}><ReopenRequestsPageClient /></RoleGate>
}
