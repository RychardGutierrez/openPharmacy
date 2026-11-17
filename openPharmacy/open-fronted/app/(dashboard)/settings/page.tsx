import { SettingsTabs } from "@/features/configuration/components/settings-tabs"
import { RoleGate } from "@/core/guards/role-guard"

export default function SettingsPage() {
  return <RoleGate allowedRoles={["ADMIN"]}><SettingsTabs /></RoleGate>
}
