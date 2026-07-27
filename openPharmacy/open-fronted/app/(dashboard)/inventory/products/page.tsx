import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { ProductsPageClient } from "@/features/products/components/products-page-client"

export const metadata: Metadata = {
  title: "Productos | OpenPharmacy",
  description: "Catálogo farmacéutico, categorías y precios.",
}

export default function ProductsPage() {
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <ProductsPageClient />
    </RoleGate>
  )
}
