import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { EditProductPageClient } from "@/app/(dashboard)/inventory/products/[productId]/edit/edit-product-page-client"

export const metadata: Metadata = {
  title: "Editar producto | OpenPharmacy",
  description: "Actualizar un producto del catálogo.",
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <EditProductPageClient id={productId} />
    </RoleGate>
  )
}
