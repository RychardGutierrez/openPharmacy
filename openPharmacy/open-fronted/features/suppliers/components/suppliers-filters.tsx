"use client"

import { useEffect, useState } from "react"
import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SUPPLIER_STATUS_LABELS,
  supplierStatusSchema,
  type SuppliersFiltersValue,
  type SupplierStatus,
} from "@/features/suppliers/types"
import { useDebounce } from "@/shared/hooks/use-debounce"

export interface SuppliersFiltersProps {
  value: SuppliersFiltersValue
  onChange: (value: SuppliersFiltersValue) => void
}

export function SuppliersFilters({ value, onChange }: SuppliersFiltersProps) {
  const [search, setSearch] = useState(value.q)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (debouncedSearch !== value.q) {
      onChange({ ...value, q: debouncedSearch })
    }
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = supplierStatusSchema.options

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Buscar por nombre, NIT o contacto"
          className="pl-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <Select
        value={value.status}
        onValueChange={(next) =>
          onChange({ ...value, status: next as SupplierStatus })
        }
      >
        <SelectTrigger className="sm:w-48">
          <SelectValue placeholder="Todos los estados" />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((status) => (
            <SelectItem key={status} value={status}>
              {SUPPLIER_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
