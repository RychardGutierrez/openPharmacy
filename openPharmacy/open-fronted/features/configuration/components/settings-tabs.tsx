"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfigurationPageClient } from "@/features/configuration/components/configuration-page-client"
import { SiatSettingsPanel } from "@/features/siat-settings/components/siat-settings-panel"

/** `/settings`: general configuration and SIAT invoicing (SIAT-04), each saved on its own. */
export function SettingsTabs() {
  return (
    <Tabs defaultValue="general" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="siat">Facturación SIAT</TabsTrigger>
      </TabsList>
      <TabsContent value="general"><ConfigurationPageClient /></TabsContent>
      <TabsContent value="siat"><SiatSettingsPanel /></TabsContent>
    </Tabs>
  )
}
