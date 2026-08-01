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
  LOT_EXPIRY_LABELS,
  LOT_EXPIRY_STATUSES,
  type LotExpiryStatus,
  type LotsFiltersValue,
} from "@/features/lots/types"
import { useDebounce } from "@/shared/hooks/use-debounce"

const ALL = "ALL"

export interface LotsFiltersProps {
  value: LotsFiltersValue
  onChange: (value: LotsFiltersValue) => void
}

export function LotsFilters({ value, onChange }: LotsFiltersProps) {
  const [search, setSearch] = useState(value.q)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (debouncedSearch !== value.q) onChange({ ...value, q: debouncedSearch })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Buscar por número de lote"
          className="pl-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <Select
        value={value.status ?? ALL}
        onValueChange={(next) =>
          onChange({
            ...value,
            status: next === ALL ? undefined : (next as LotExpiryStatus),
          })
        }
      >
        <SelectTrigger className="sm:w-56">
          <SelectValue placeholder="Todos los estados" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          {LOT_EXPIRY_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {LOT_EXPIRY_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
