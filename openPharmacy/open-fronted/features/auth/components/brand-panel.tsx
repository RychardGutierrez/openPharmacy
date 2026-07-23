import { Pill } from "lucide-react"

const FEATURE_BULLETS = [
  {
    title: "Point of Sale & Shifts",
    description: "Sales, cash register, and returns in one workflow",
    modules: ["sales", "shifts", "returns"],
  },
  {
    title: "Inventory & Lot Tracking",
    description: "FEFO expiration control and real-time stock movements",
    modules: ["products", "lots", "inventory-movements"],
  },
  {
    title: "Purchasing & Suppliers",
    description: "Purchase orders, receiving, and supplier database",
    modules: ["purchase-orders", "suppliers"],
  },
  {
    title: "Prescriptions & Doctors",
    description: "Controlled-substance dispensing with doctor records",
    modules: ["prescriptions", "doctors"],
  },
  {
    title: "Multi-Branch (Sedes)",
    description: "Operate multiple pharmacy locations from one account",
    modules: ["sedes"],
  },
  {
    title: "User & Role Management",
    description: "Admin, Pharmacist, and Cashier with full audit trail",
    modules: ["auth", "users", "audit"],
  },
  {
    title: "Reports & Billing",
    description: "Compliance reports and invoice management",
    modules: ["reports", "billing"],
  },
  {
    title: "Real-Time Alerts (SSE)",
    description: "Live notifications for low stock, expirations, and approvals",
    modules: ["alerts"],
  },
  {
    title: "Secure Configuration",
    description: "Centralized system settings with encrypted secrets",
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
            Pharmacy Management System
          </span>
        </div>
      </div>

      <div className="max-w-md">
        <h2 className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
          <span className="block">Complete Pharmaceutical</span>
          <span className="block text-primary">Inventory Control</span>
        </h2>
        <p className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700 mt-5 text-base leading-relaxed text-background/70 [animation-delay:150ms]">
          Streamline your medicine inventory, process orders efficiently, and
          track distributions with our comprehensive management system.
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
          OpenPharmacy · Multi-branch ready
        </span>
      </div>
    </aside>
  )
}
