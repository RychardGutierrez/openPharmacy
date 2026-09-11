"use client"

import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface SaleLookupCardProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  isLoading?: boolean
  disabled?: boolean
}

export function SaleLookupCard({
  value,
  onChange,
  onSearch,
  isLoading = false,
  disabled = false,
}: SaleLookupCardProps) {
  const canSearch = value.trim().length > 0 && !isLoading

  return (
    <div className="grid gap-2">
      <label
        htmlFor="sale-number"
        className="text-sm font-medium leading-none"
      >
        Número de venta
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="sale-number"
            type="text"
            placeholder="Ej. 00000001"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSearch) {
                event.preventDefault()
                onSearch()
              }
            }}
            disabled={disabled || isLoading}
            className="pl-9"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange("")}
              disabled={isLoading}
              className="absolute right-0 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
        <Button
          type="button"
          onClick={onSearch}
          disabled={!canSearch}
          className="min-w-28"
        >
          {isLoading ? "Buscando…" : "Buscar"}
        </Button>
      </div>
    </div>
  )
}
