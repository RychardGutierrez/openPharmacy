import { Pill } from "lucide-react"

const FEATURE_BULLETS = [
  {
     title: "Punto de venta y turnos",
     description: "Ventas, caja y devoluciones en un solo flujo",
    modules: ["sales", "shifts", "returns"],
  },
  {
     title: "Inventario y trazabilidad de lotes",
     description: "Control de vencimientos FEFO y movimientos de stock en tiempo real",
    modules: ["products", "lots", "inventory-movements"],
  },
  {
     title: "Compras y proveedores",
     description: "Órdenes de compra, recepción y base de proveedores",
    modules: ["purchase-orders", "suppliers"],
  },
  {
     title: "Recetas y médicos",
     description: "Dispensación de sustancias controladas con registros médicos",
    modules: ["prescriptions", "doctors"],
  },
  {
     title: "Múltiples sedes",
     description: "Opera varias ubicaciones de farmacia desde una cuenta",
    modules: ["sedes"],
  },
  {
     title: "Usuarios y roles",
     description: "Administradores, farmacéuticos y cajeros con trazabilidad completa",
    modules: ["auth", "users", "audit"],
  },
  {
     title: "Reportes y facturación",
     description: "Reportes de cumplimiento y gestión de facturas",
    modules: ["reports", "billing"],
  },
  {
     title: "Alertas en tiempo real (SSE)",
     description: "Notificaciones de stock bajo, vencimientos y aprobaciones",
    modules: ["alerts"],
  },
  {
     title: "Configuración segura",
     description: "Configuración centralizada con secretos cifrados",
    modules: ["config"],
  },
] as const

/**
 * Branded half of the split-screen login. Server-rendered and deterministic
 * (no random values) so SSR and client HTML always match.
 */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
          <Pill className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-semibold tracking-tight">
            OpenPharmacy
          </span>
          <span className="text-xs text-background/60">
            Sistema de gestión farmacéutica
          </span>
        </div>
      </div>

      <div className="max-w-md">
        <h2 className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
           <span className="block">Gestión farmacéutica</span>
           <span className="block text-primary">integral</span>
        </h2>
        <p className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700 mt-5 text-base leading-relaxed text-background/70 [animation-delay:150ms]">
           Organiza tu inventario de medicamentos, procesa órdenes de forma
           eficiente y controla las distribuciones con nuestro sistema integral.
        </p>

        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-4">
          {FEATURE_BULLETS.map((bullet, index) => (
            <li
              key={bullet.title}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700 flex items-start gap-2.5 text-sm"
              style={{ animationDelay: `${300 + index * 100}ms` }}>
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="flex flex-col leading-snug">
                <span className="font-medium text-background">
                  {bullet.title}
                </span>
                <span className="text-xs text-background/60">
                  {bullet.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both motion-safe:duration-700 flex items-center gap-2 [animation-delay:1500ms]">
        <span className="text-xs text-background/50">
           OpenPharmacy · Preparado para múltiples sedes
        </span>
      </div>
    </aside>
  )
}
