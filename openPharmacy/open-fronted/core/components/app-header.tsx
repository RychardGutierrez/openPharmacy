"use client"

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getBreadcrumb } from "@/core/config/navigation"
import { SearchIcon, BellIcon, SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const pathname = usePathname()
  const trail = getBreadcrumb(pathname)

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md",
        "supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-16" />

      <div className="hidden min-w-0 flex-1 flex-col gap-0.5 md:flex">
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            {trail.map((item, idx) => (
              <span key={`${item.label}-${idx}`} className="contents">
                {idx > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {idx === trail.length - 1 ? (
                    <BreadcrumbPage className="font-medium text-foreground">
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <span className="text-muted-foreground">{item.label}</span>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-44 pl-8 pr-12 sm:w-56"
          />
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
          <BellIcon />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Settings">
          <SettingsIcon />
        </Button>
      </div>
    </header>
  )
}