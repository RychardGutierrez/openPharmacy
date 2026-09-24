"use client"

import { useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

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
import { useLotsByProduct } from "@/features/lots/api/use-lots-by-product"
import { useUserLookup } from "@/features/inventory-movements/api/use-user-lookup"
import { userLookupKeys } from "@/features/inventory-movements/api/use-user-lookup"
import { useDebounce } from "@/shared/hooks/use-debounce"
import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  type MovementType,
} from "@/features/inventory-movements/types"
import type { UserLookupResult } from "@/features/inventory-movements/types"

export interface MovementsFiltersValue {
  productId: string | undefined
  lotId: string | undefined
  movementType: MovementType | undefined
  userId: string | undefined
  from: string | undefined
  to: string | undefined
}

export interface MovementsFiltersProps {
  value: MovementsFiltersValue
  onChange: (value: MovementsFiltersValue) => void
}

const ALL = "ALL"

export function MovementsFilters({ value, onChange }: MovementsFiltersProps) {
  const hasFilters =
    value.productId ||
    value.lotId ||
    value.movementType ||
    value.userId ||
    value.from ||
    value.to

  const handleClear = () => {
    onChange({
      productId: undefined,
      lotId: undefined,
      movementType: undefined,
      userId: undefined,
      from: undefined,
      to: undefined,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ProductPicker
          value={value.productId}
          onChange={(productId) =>
            onChange({ ...value, productId, lotId: undefined })
          }
          label="Producto"
          placeholder="Buscar producto…"
        />
        <LotSelect
          productId={value.productId}
          value={value.lotId}
          onChange={(lotId) => onChange({ ...value, lotId })}
        />
        <TypeSelect
          value={value.movementType}
          onChange={(movementType) => onChange({ ...value, movementType })}
        />
        <UserPicker
          value={value.userId}
          onChange={(userId) => onChange({ ...value, userId })}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium leading-none">Desde</label>
          <DatePicker
            value={value.from}
            onChange={(from) => onChange({ ...value, from })}
            placeholder="Seleccionar fecha inicial"
            maxDate={value.to ? new Date(value.to) : undefined}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium leading-none">Hasta</label>
          <DatePicker
            value={value.to}
            onChange={(to) => onChange({ ...value, to })}
            placeholder="Seleccionar fecha final"
            minDate={value.from ? new Date(value.from) : undefined}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-2">
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="w-full sm:w-auto"
            >
              <X className="size-4" aria-hidden="true" />
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function LotSelect({
  productId,
  value,
  onChange,
}: {
  productId: string | undefined
  value: string | undefined
  onChange: (lotId: string | undefined) => void
}) {
  const { data: lots, isLoading } = useLotsByProduct(productId)

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium leading-none">Lote</label>
      <Select
        value={value ?? ALL}
        onValueChange={(next) =>
          onChange(next === ALL ? undefined : next)
        }
        disabled={!productId || isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={productId ? "Seleccionar lote" : "Primero selecciona un producto"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los lotes</SelectItem>
          {lots?.map((lot) => (
            <SelectItem key={lot.id} value={lot.id}>
              {lot.lotNumber}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function TypeSelect({
  value,
  onChange,
}: {
  value: MovementType | undefined
  onChange: (type: MovementType | undefined) => void
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium leading-none">Tipo de movimiento</label>
      <Select
        value={value ?? ALL}
        onValueChange={(next) =>
          onChange(next === ALL ? undefined : (next as MovementType))
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Todos los tipos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los tipos</SelectItem>
          {MOVEMENT_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {MOVEMENT_TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function UserPicker({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (userId: string | undefined) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const { data: users, isFetching } = useUserLookup(debouncedSearch)

  const selectedUser = useMemo(() => {
    if (!value) return undefined
    return (
      users?.find((user) => user.id === value) ??
      queryClient.getQueryData<UserLookupResult>(userLookupKeys.search(value))
    )
  }, [value, users, queryClient])

  const displayValue =
    selectedUser && search === "" && value
      ? `${selectedUser.fullName} (${selectedUser.email})`
      : search

  const handleInputChange = (next: string) => {
    setSearch(next)
    setOpen(true)
  }

  const handleSelect = (user: UserLookupResult) => {
    queryClient.setQueryData(userLookupKeys.search(user.id), user)
    onChange(user.id)
    setSearch("")
    setOpen(false)
  }

  const handleClear = () => {
    onChange(undefined)
    setSearch("")
    setOpen(false)
  }

  const showResults = open && (isFetching || users !== undefined)
  const trimmed = search.trim()
  const canSearch = trimmed.length >= 2
  const hasResults = users && users.length > 0
  const showEmpty =
    !isFetching && users !== undefined && !hasResults && canSearch

  return (
    <div className="grid gap-2" ref={containerRef}>
      <label className="text-sm font-medium leading-none">Usuario</label>
      <div className="relative">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? "user-picker-list" : undefined}
            placeholder="Buscar usuario…"
            value={displayValue}
            onChange={(event) => handleInputChange(event.target.value)}
            onFocus={() => setOpen(true)}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pl-9 pr-9 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="absolute right-0 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar selección"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {showResults ? (
          <div
            id="user-picker-list"
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card shadow-md"
          >
            {isFetching ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Buscando…
              </p>
            ) : null}
            {!isFetching && hasResults ? (
              <ul className="py-1">
                {users.map((user) => (
                  <li
                    key={user.id}
                    role="option"
                    aria-selected={value === user.id}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(user)}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                        value === user.id ? "bg-muted font-medium" : ""
                      }`}
                    >
                      <div className="font-medium">{user.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {showEmpty ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No se encontraron usuarios.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
