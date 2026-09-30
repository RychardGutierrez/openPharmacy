import { ConfigurationPageClient } from "@/features/configuration/components/configuration-page-client"
import { RoleGate } from "@/core/guards/role-guard"

export default function SettingsPage() {
  return <RoleGate allowedRoles={["ADMIN"]}><ConfigurationPageClient /></RoleGate>
}
