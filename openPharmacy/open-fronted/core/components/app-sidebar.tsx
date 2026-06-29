"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavMain } from "@/core/components/nav-main"
import { NavUser } from "@/core/components/nav-user"
import { PillIcon } from "lucide-react"

function SidebarBrand() {
  const { state } = useSidebar()

  return (
    <div className="flex items-center gap-2 px-2 py-3">
      <PillIcon className="size-5 text-secondary" />
      {state !== "collapsed" && (
        <span className="text-sm font-semibold">OpenPharmacy</span>
      )}
    </div>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>
      <SidebarContent className="gap-4 py-2">
        <NavMain />
      </SidebarContent>
      <NavUser />
    </Sidebar>
  )
}
