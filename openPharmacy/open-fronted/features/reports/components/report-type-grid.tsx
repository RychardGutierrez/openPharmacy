"use client"

import {
  BarChart3,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  PackageCheck,
  ShoppingCart,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  REPORT_DEFINITIONS,
  type ReportDefinition,
} from "@/features/reports/types"

const icons: Record<ReportDefinition["icon"], LucideIcon> = {
  sales: CircleDollarSign,
  ranking: BarChart3,
  cashier: Users,
  stock: PackageCheck,
  valuation: CircleDollarSign,
  lot: Boxes,
  expiry: CalendarClock,
  purchase: ShoppingCart,
  returns: SlidersHorizontal,
}

export function ReportTypeGrid({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (definition: ReportDefinition) => void
}) {
  return (
    <section aria-labelledby="report-type-heading">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="report-type-heading" className="text-sm font-semibold">
            Tipo de reporte
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona una vista para preparar tu análisis.
          </p>
        </div>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {REPORT_DEFINITIONS.length} vistas disponibles
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {REPORT_DEFINITIONS.map((definition) => {
          const Icon = icons[definition.icon]
          const selected = selectedId === definition.id
          return (
            <button
              key={definition.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(definition)}
              className="text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card
                size="sm"
                className={cn(
                  "h-full cursor-pointer gap-2 px-3 py-3 transition-colors hover:bg-accent/60",
                  selected && "border-primary bg-accent ring-2 ring-primary/30",
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground",
                      selected && "bg-primary text-primary-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight">
                      {definition.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                      {definition.description}
                    </span>
                  </span>
                </div>
              </Card>
            </button>
          )
        })}
      </div>
    </section>
  )
}
