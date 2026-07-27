import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { ProductDetailPageClient } from "@/app/(dashboard)/inventory/products/[productId]/product-detail-page-client"

export const metadata: Metadata = {
  title: "Detalle del producto | OpenPharmacy",
  description: "Ver información detallada de un producto.",
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <ProductDetailPageClient id={productId} />
    </RoleGate>
  )
}
