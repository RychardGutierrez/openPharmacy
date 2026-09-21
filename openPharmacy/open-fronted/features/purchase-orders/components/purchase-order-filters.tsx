"use client"

import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDebounce } from "@/shared/hooks/use-debounce"
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderFiltersValue,
  type PurchaseOrderStatus,
  type Supplier,
} from "@/features/purchase-orders/types"

const ALL_STATUS = "__ALL__"
const ALL_SUPPLIERS = "__ALL__"

export interface PurchaseOrderFiltersProps {
  value: PurchaseOrderFiltersValue
  onChange: (next: PurchaseOrderFiltersValue) => void
  suppliers: Supplier[]
  /** Debounce (ms) before propagating the typed search to `onChange`. */
  searchDebounceMs?: number
}

export function PurchaseOrderFilters({
  value,
  onChange,
  suppliers,
  searchDebounceMs = 300,
}: PurchaseOrderFiltersProps) {
  const [searchInput, setSearchInput] = useState(value.q ?? "")
  const debouncedSearch = useDebounce(searchInput, searchDebounceMs)

  useEffect(() => {
    const normalised = debouncedSearch.trim()
    const current = value.q ?? ""
    if (normalised === current) return
    onChange({ ...value, q: normalised ? normalised : undefined })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters =
    Boolean(value.status) ||
    Boolean(value.supplierId) ||
    Boolean(value.q && value.q.trim().length > 0)

  const clearAll = () => {
    setSearchInput("")
    onChange({})
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="flex flex-col gap-1.5 lg:flex-1">
        <label
          htmlFor="po-filter-search"
          className="text-xs font-medium text-muted-foreground"
        >
          Buscar
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="po-filter-search"
            type="search"
            placeholder="Buscar por ID o proveedor…"
            className="pl-9 pr-9"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Buscar órdenes de compra"
            autoComplete="off"
          />
          {searchInput ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchInput("")}
              className="absolute right-0 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 lg:w-56">
        <label
          htmlFor="po-filter-status"
          className="text-xs font-medium text-muted-foreground"
        >
          Estado
        </label>
        <Select
          value={value.status ?? ALL_STATUS}
          onValueChange={(next) =>
            onChange({
              ...value,
              status: next === ALL_STATUS ? undefined : (next as PurchaseOrderStatus),
            })
          }
        >
          <SelectTrigger id="po-filter-status" className="w-full">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>Todos los estados</SelectItem>
            {PURCHASE_ORDER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {PURCHASE_ORDER_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5 lg:w-72">
        <label
          htmlFor="po-filter-supplier"
          className="text-xs font-medium text-muted-foreground"
        >
          Proveedor
        </label>
        <Select
          value={value.supplierId ?? ALL_SUPPLIERS}
          onValueChange={(next) =>
            onChange({
              ...value,
              supplierId: next === ALL_SUPPLIERS ? undefined : next,
            })
          }
        >
          <SelectTrigger id="po-filter-supplier" className="w-full">
            <SelectValue placeholder="Todos los proveedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SUPPLIERS}>Todos los proveedores</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          onClick={clearAll}
          className="self-start text-muted-foreground"
        >
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  )
}
