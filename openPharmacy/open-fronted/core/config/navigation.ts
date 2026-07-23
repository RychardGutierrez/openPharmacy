import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ArrowLeftRight,
  FileText,
  Truck,
  BarChart3,
  Stethoscope,
  Users,
  MapPin,
  Settings,
  RotateCcw,
  Repeat,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
}

export type NavParentItem = {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

export type NavSection = {
  title: string
  items: (NavItem | NavParentItem)[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Navigation",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        title: "Sales",
        icon: ShoppingCart,
        items: [
          { title: "POS", href: "/sales/pos", icon: ShoppingCart },
          { title: "Cash Register", href: "/sales/cash-register", icon: RotateCcw },
          { title: "Returns", href: "/sales/returns", icon: Repeat },
        ],
      },
      {
        title: "Inventory",
        icon: Package,
        items: [
          { title: "Products", href: "/inventory/products", icon: Package },
          { title: "Movements", href: "/inventory/movements", icon: ArrowLeftRight },
        ],
      },
      {
        title: "Purchasing",
        icon: FileText,
        items: [
          { title: "Orders", href: "/purchasing/orders", icon: FileText },
          { title: "Suppliers", href: "/purchasing/suppliers", icon: Truck },
        ],
      },
      { title: "Reports", href: "/reports", icon: BarChart3 },
      { title: "Doctors", href: "/doctors", icon: Stethoscope },
      { title: "Users", href: "/users", icon: Users },
      { title: "Sedes", href: "/sedes", icon: MapPin },
    ],
  },
  {
    title: "System",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
]

const TITLE_MAP: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Overview and quick actions" },
  "/sales/pos": { title: "Point of Sale", subtitle: "Process sales transactions" },
  "/sales/cash-register": { title: "Cash Register", subtitle: "Manage cash operations" },
  "/sales/returns": { title: "Returns", subtitle: "Process product returns" },
  "/inventory/products": { title: "Products", subtitle: "Manage inventory items" },
  "/inventory/movements": { title: "Movements", subtitle: "Track stock movements" },
  "/purchasing/orders": { title: "Purchase Orders", subtitle: "Manage purchase orders" },
  "/purchasing/suppliers": { title: "Suppliers", subtitle: "Manage supplier information" },
  "/reports": { title: "Reports", subtitle: "View system reports" },
  "/doctors": { title: "Doctors", subtitle: "Manage doctor records" },
  "/users": { title: "Users", subtitle: "Manage system users" },
  "/sedes": { title: "Sedes", subtitle: "Manage locations" },
  "/settings": { title: "Settings", subtitle: "System configuration" },
}

export function getPageInfo(pathname: string): { title: string; subtitle: string } {
  return TITLE_MAP[pathname] ?? { title: "Open Pharmacy", subtitle: "" }
}

/** Flat lookup: href -> trail of ancestor labels (excluding the leaf). */
const HREF_TRAIL: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if ("items" in item) {
        for (const child of item.items) {
          map[child.href] = [section.title, item.title]
        }
      } else {
        map[item.href] = [section.title]
      }
    }
  }
  return map
})()

export type BreadcrumbItem = { label: string; href?: string }

/** Returns the breadcrumb trail for a pathname, leaf last. */
export function getBreadcrumb(pathname: string): BreadcrumbItem[] {
  const trail = HREF_TRAIL[pathname]
  const info = getPageInfo(pathname)
  return [
    ...(trail ?? []).map((label) => ({ label })),
    { label: info.title, href: pathname },
  ]
}
