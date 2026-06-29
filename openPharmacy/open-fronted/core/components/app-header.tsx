"use client"

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { getPageInfo } from "@/core/config/navigation"
import { SearchIcon, BellIcon, SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AppHeader() {
  const pathname = usePathname()
  const { title, subtitle } = getPageInfo(pathname)

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex flex-1 flex-col">
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-8"
          />
        </div>
        <Button variant="ghost" size="icon-sm">
          <BellIcon />
        </Button>
        <Button variant="ghost" size="icon-sm">
          <SettingsIcon />
        </Button>
      </div>
    </header>
  )
}
