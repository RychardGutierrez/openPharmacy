import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { NewProductPageClient } from "@/app/(dashboard)/inventory/products/new/new-product-page-client"

export const metadata: Metadata = {
  title: "Nuevo producto | OpenPharmacy",
  description: "Registrar un producto en el catálogo.",
}

export default function NewProductPage() {
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <NewProductPageClient />
    </RoleGate>
  )
}
