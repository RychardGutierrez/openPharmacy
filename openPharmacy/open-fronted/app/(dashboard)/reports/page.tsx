import type { Metadata } from "next"

import { ReportsPageClient } from "@/features/reports/components/reports-page-client"

export const metadata: Metadata = {
  title: "Reportes | OpenPharmacy",
  description: "Analiza ventas, inventario y compras de la farmacia.",
}

export default function ReportsPage() {
  return <ReportsPageClient />
}
