import type { Metadata } from "next"

import { RoleGate } from "@/core/guards/role-guard"
import { EditUserPageClient } from "@/app/(dashboard)/users/[id]/edit/edit-user-page-client"

export const metadata: Metadata = {
  title: "Edit user | OpenPharmacy",
  description: "Update a system user.",
}

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <RoleGate allowedRoles={["ADMIN"]}>
      <EditUserPageClient id={id} />
    </RoleGate>
  )
}
