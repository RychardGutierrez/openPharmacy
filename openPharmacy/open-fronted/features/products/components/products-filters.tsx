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
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from "@/features/products/types"
import { useDebounce } from "@/shared/hooks/use-debounce"

const ALL = "ALL"

export interface ProductsFiltersValue {
  q: string
  category: ProductCategory | undefined
  status: boolean | undefined
}

export interface ProductsFiltersProps {
  value: ProductsFiltersValue
  onChange: (value: ProductsFiltersValue) => void
}

export function ProductsFilters({ value, onChange }: ProductsFiltersProps) {
  const [search, setSearch] = useState(value.q)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (debouncedSearch !== value.q) {
      onChange({ ...value, q: debouncedSearch })
    }
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
          placeholder="Buscar por nombre o código"
          className="pl-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <Select
        value={value.category ?? ALL}
        onValueChange={(next) =>
          onChange({
            ...value,
            category: next === ALL ? undefined : (next as ProductCategory),
          })
        }
      >
        <SelectTrigger className="sm:w-56">
          <SelectValue placeholder="Todas las categorías" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las categorías</SelectItem>
          {PRODUCT_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {PRODUCT_CATEGORY_LABELS[category]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={
          value.status === undefined
            ? ALL
            : value.status
              ? "active"
              : "inactive"
        }
        onValueChange={(next) =>
          onChange({
            ...value,
            status: next === ALL ? undefined : next === "active",
          })
        }
      >
        <SelectTrigger className="sm:w-48">
          <SelectValue placeholder="Todos los estados" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
