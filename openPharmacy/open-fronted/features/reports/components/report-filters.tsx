"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/features/purchase-orders/components/date-picker"
import { ProductPicker } from "@/features/lots/components/product-picker"
import { SupplierPicker } from "@/features/purchase-orders/components/supplier-picker"
import { ReportUserPicker } from "@/features/reports/components/report-user-picker"
import {
  PRODUCT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  type ReportDefinition,
  type ReportFiltersValue,
} from "@/features/reports/types"

export function ReportFilters({
  value,
  definition,
  onChange,
}: {
  value: ReportFiltersValue
  definition: ReportDefinition
  onChange: (value: ReportFiltersValue) => void
}) {
  const hasFilters = Object.values(value).some(Boolean)
  const dateDisabled = definition.dateMode === "none"

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2">
          <label htmlFor="report-from" className="text-sm font-medium">Desde</label>
          <DatePicker
            id="report-from"
            value={value.from}
            onChange={(from) => onChange({ ...value, from: from ?? value.from })}
            maxDate={value.to ? new Date(`${value.to}T00:00:00`) : undefined}
            disabled={dateDisabled}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="report-to" className="text-sm font-medium">Hasta</label>
          <DatePicker
            id="report-to"
            value={value.to}
            onChange={(to) => onChange({ ...value, to: to ?? value.to })}
            minDate={value.from ? new Date(`${value.from}T00:00:00`) : undefined}
            disabled={dateDisabled}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="report-category" className="text-sm font-medium">Categoría</label>
          <Select
            value={value.category ?? "ALL"}
            onValueChange={(category) => onChange({ ...value, category: category === "ALL" ? undefined : category as ReportFiltersValue["category"] })}
          >
            <SelectTrigger id="report-category"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las categorías</SelectItem>
              {PRODUCT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{REPORT_CATEGORY_LABELS[category]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {definition.id === "purchases" ? (
          <SupplierPicker value={value.supplierId} onChange={(supplierId) => onChange({ ...value, supplierId })} />
        ) : (
          <ReportUserPicker value={value.userId} onChange={(userId) => onChange({ ...value, userId })} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProductPicker value={value.productId} onChange={(productId) => onChange({ ...value, productId })} label="Producto" placeholder="Buscar medicamento…" />
        {definition.id === "expiry" ? (
          <div className="grid gap-2">
            <label htmlFor="report-horizon" className="text-sm font-medium">Horizonte</label>
            <Select value={String(value.horizonDays ?? 90)} onValueChange={(horizonDays) => onChange({ ...value, horizonDays: Number(horizonDays) })}>
              <SelectTrigger id="report-horizon"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[30, 60, 90, 180, 365].map((days) => <SelectItem key={days} value={String(days)}>{days} días</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {definition.id === "returns-adjustments" ? (
          <div className="grid gap-2">
            <label htmlFor="report-view" className="text-sm font-medium">Vista</label>
            <Select
              value={value.view ?? "RETURNS"}
              onValueChange={(view) => onChange({ ...value, view: view as ReportFiltersValue["view"], movementType: view === "ADJUSTMENTS" ? "MANUAL_ADJUSTMENT" : undefined })}
            >
              <SelectTrigger id="report-view"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RETURNS">Devoluciones</SelectItem>
                <SelectItem value="ADJUSTMENTS">Ajustes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {hasFilters ? (
          <div className="flex items-end">
            <Button type="button" variant="ghost" onClick={() => onChange({ ...value, category: undefined, productId: undefined, supplierId: undefined, userId: undefined, movementType: undefined, horizonDays: definition.id === "expiry" ? 90 : undefined, view: definition.id === "returns-adjustments" ? "RETURNS" : undefined })}>
              <X className="size-4" aria-hidden="true" />
              Limpiar filtros
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
