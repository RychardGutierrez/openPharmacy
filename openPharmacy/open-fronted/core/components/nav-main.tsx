"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"
import { NAV_SECTIONS, type NavItem, type NavParentItem } from "@/core/config/navigation"

function isParentItem(item: NavItem | NavParentItem): item is NavParentItem {
  return "items" in item
}

function NavItemLink({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        asChild
        isActive={pathname === item.href}
        tooltip={item.title}
        className="h-9"
      >
        <Link href={item.href}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavParentItemLink({ item, pathname }: { item: NavParentItem; pathname: string }) {
  const isActive = item.items.some((child) => pathname === child.href)
  const [open, setOpen] = useState(isActive)

  return (
    <SidebarMenuItem key={item.title}>
      <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            className="h-9"
            data-active={isActive}
          >
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform group-data-[open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={pathname === child.href}
                >
                  <Link href={child.href}>
                    <child.icon />
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}

export function NavMain() {
  const pathname = usePathname()

  return (
    <>
      {NAV_SECTIONS.map((section) => (
        <SidebarGroup key={section.title} className="gap-1">
          <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {section.items.map((item) =>
                isParentItem(item) ? (
                  <NavParentItemLink key={item.title} item={item} pathname={pathname} />
                ) : (
                  <NavItemLink key={item.href} item={item} pathname={pathname} />
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
