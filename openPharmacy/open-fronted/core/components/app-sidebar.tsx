"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavMain } from "@/core/components/nav-main"
import { NavUser } from "@/core/components/nav-user"
import { PillIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function SidebarBrand() {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  return (
    <div className={cn("flex items-center gap-2.5 px-2 py-2", collapsed ? "justify-center" : "")}>
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center bg-primary text-primary-foreground",
          "ring-1 ring-inset ring-primary/50 transition-transform",
          collapsed ? "mx-auto" : "translate-x-0"
        )}
      >
        <PillIcon className="size-5" />
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-serif text-sm font-semibold tracking-tight">
            OpenPharmacy
          </span>
          <span className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Management OS
          </span>
        </div>
      )}
    </div>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarBrand />
        <SidebarSeparator className="mx-0" />
      </SidebarHeader>
      <SidebarContent className="gap-2 py-2">
        <NavMain />
      </SidebarContent>
      <NavUser />
    </Sidebar>
  )
}