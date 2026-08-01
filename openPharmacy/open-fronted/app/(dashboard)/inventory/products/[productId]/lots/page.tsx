import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { ProductLotsPageClient } from "@/features/lots/components/product-lots-page-client"

export const metadata: Metadata = {
  title: "Lotes del producto | OpenPharmacy",
  description: "Lotes y vencimientos de un producto.",
}

export default async function ProductLotsPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <ProductLotsPageClient productId={productId} />
    </RoleGate>
  )
}
