"use client"

import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChevronUpIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { logout } from "@/features/auth/api/auth-api"

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "Admin",
  PHARMACIST: "Pharm.",
  CASHIER: "Cashier",
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function NavUser() {
  const { state } = useSidebar()
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)

  const displayName = user?.fullName ?? "Guest"
  const email = user?.email ?? ""
  const role = user?.role ?? "GUEST"

  async function handleLogout() {
    await logout()
    clearSession()
    // AuthGuard (wrapping all protected routes) detects the unauthenticated
    // status and redirects to /login. We don't navigate here so the logout
    // action works even if the menu item is unmounted mid-click.
  }

  return (
    <SidebarFooter className="p-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                tooltip="Account"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar size="sm" className="size-7">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials(displayName) || "—"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-sm font-medium">{displayName}</span>
                  {state !== "collapsed" && (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {email || "Not signed in"}
                    </span>
                  )}
                </div>
                {state !== "collapsed" && (
                  <ChevronUpIcon className="ml-auto size-4 text-muted-foreground" />
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            >
              <DropdownMenuLabel className="flex flex-col gap-0.5 p-2">
                <span className="font-medium">{displayName}</span>
                <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  <span className="truncate">{email}</span>
                  <Badge variant="secondary" className="ml-auto shrink-0 uppercase">
                    {ROLE_BADGE[role] ?? role}
                  </Badge>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <UserIcon />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <SettingsIcon />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={handleLogout}
              >
                <LogOutIcon />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}