import type { Metadata } from "next"
import { RoleGate } from "@/core/guards/role-guard"
import { CashRegisterPageClient } from "@/features/shifts/components/cash-register-page-client"

export const metadata: Metadata = { title: "Caja registradora", description: "Apertura y cierre de turno de caja" }

export default function CashRegisterPage() {
  return <RoleGate allowedRoles={["CASHIER", "PHARMACIST"]}><CashRegisterPageClient /></RoleGate>
}
