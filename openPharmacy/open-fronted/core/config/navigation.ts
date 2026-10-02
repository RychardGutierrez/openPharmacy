import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Package2,
  ArrowLeftRight,
  CalendarClock,
  FileText,
  Truck,
  BarChart3,
  Users,
  Settings,
  UserCircle,
  RotateCcw,
  Repeat,
  ShieldCheck,
} from "lucide-react"
import type { UserRole } from "@/features/auth/types"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** When set, the item is only rendered for users with this role. */
  requiredRole?: UserRole
  /** Roles that must not see this item. */
  hiddenForRoles?: UserRole[]
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
    title: "Navegación",
    items: [
      { title: "Panel", href: "/dashboard", icon: LayoutDashboard },
      {
        title: "Ventas",
        icon: ShoppingCart,
        items: [
          { title: "POS", href: "/sales/pos", icon: ShoppingCart, hiddenForRoles: ["ADMIN"] },
          { title: "Caja", href: "/sales/cash-register", icon: RotateCcw, hiddenForRoles: ["ADMIN"] },
          { title: "Devoluciones", href: "/sales/returns", icon: Repeat, hiddenForRoles: ["CASHIER"] },
        ],
      },
      {
        title: "Inventario",
        icon: Package,
        items: [
          { title: "Productos", href: "/inventory/products", icon: Package },
          { title: "Lotes", href: "/inventory/lots", icon: Package2 },
          { title: "Vencimientos", href: "/inventory/lotsExpiry", icon: CalendarClock },
          { title: "Movimientos", href: "/inventory/movements", icon: ArrowLeftRight },
        ],
      },
      {
        title: "Compras",
        icon: FileText,
        hiddenForRoles: ["CASHIER"],
        items: [
          { title: "Órdenes", href: "/purchasing/orders", icon: FileText },
          { title: "Proveedores", href: "/purchasing/suppliers", icon: Truck },
        ],
      },
      { title: "Reportes", href: "/reports", icon: BarChart3 },
      { title: "Usuarios", href: "/users", icon: Users, requiredRole: "ADMIN" },
    ],
  },
  {
    title: "Administración",
    items: [
      { title: "Solicitudes de reapertura", href: "/admin/reopen-requests", icon: ShieldCheck, requiredRole: "ADMIN" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { title: "Mi perfil", href: "/profile", icon: UserCircle },
      { title: "Configuración", href: "/settings", icon: Settings, requiredRole: "ADMIN" },
    ],
  },
]

const TITLE_MAP: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Panel", subtitle: "Resumen y acciones rápidas" },
  "/sales/pos": { title: "Punto de venta", subtitle: "Procesa las ventas" },
  "/sales/cash-register": { title: "Caja", subtitle: "Gestiona las operaciones de caja" },
  "/sales/returns": { title: "Devoluciones", subtitle: "Procesa las devoluciones" },
  "/inventory/products": { title: "Productos", subtitle: "Gestiona los productos del inventario" },
  "/inventory/lots": { title: "Lotes", subtitle: "Todos los lotes del inventario" },
  "/inventory/lotsExpiry": {
    title: "Vencimientos",
    subtitle: "Lotes próximos a vencer y lotes vigentes",
  },
  "/inventory/movements": { title: "Movimientos", subtitle: "Registra movimientos de stock" },
  "/purchasing/orders": { title: "Órdenes de compra", subtitle: "Gestiona las órdenes de compra" },
  "/purchasing/suppliers": { title: "Proveedores", subtitle: "Gestiona la información de proveedores" },
  "/reports": { title: "Reportes", subtitle: "Consulta los reportes del sistema" },
  "/doctors": { title: "Médicos", subtitle: "Gestiona el directorio médico" },
  "/users": { title: "Usuarios", subtitle: "Gestiona los usuarios del sistema" },
  "/sedes": { title: "Sedes", subtitle: "Gestiona las sedes" },
  "/admin/reopen-requests": { title: "Solicitudes de reapertura", subtitle: "Revisa las solicitudes de reapertura" },
  "/settings": { title: "Configuración", subtitle: "Configuración del sistema" },
  "/profile": { title: "Mi perfil", subtitle: "Gestiona tu cuenta" },
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
