"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClickOutside } from "@/shared/hooks/use-click-outside"
import { useDebounce } from "@/shared/hooks/use-debounce"
import { useSupplierSearch } from "@/features/purchase-orders/api/use-search-suppliers"
import { useSupplierById } from "@/features/purchase-orders/api/use-supplier-by-id"
import type { SupplierSummary } from "@/features/purchase-orders/api/use-search-suppliers"

export interface SupplierPickerProps {
  value: string | undefined
  onChange: (supplierId: string | undefined) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

/**
 * Searchable supplier picker that mirrors the `ProductPicker` behaviour:
 *
 *  - The input only fetches results once the user has typed at least one
 *    character, so opening the dropdown on a large catalog stays snappy.
 *  - The currently selected supplier is loaded independently so it keeps
 *    showing in the input even when the search box is empty.
 *  - The dropdown is positioned relative to the input itself so its
 *    width always matches the input width — never the surrounding label
 *    grid.
 *  - Keyboard support (ArrowUp / ArrowDown / Enter / Escape) matches the
 *    product picker for a consistent feel.
 */
export function SupplierPicker({
  value,
  onChange,
  label = "Proveedor",
  placeholder = "Buscar por nombre, NIT o contacto…",
  disabled = false,
  ariaInvalid,
  ariaDescribedBy,
}: SupplierPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(
    undefined,
  )
  const debouncedSearch = useDebounce(search, 250)

  const { data: results = [], isFetching } = useSupplierSearch(debouncedSearch)
  const selectedSupplierQuery = useSupplierById(value)
  const selectedSupplier: SupplierSummary | null | undefined =
    value && search === ""
      ? (selectedSupplierQuery.data ?? undefined)
      : undefined

  const displayText = (() => {
    if (search.length > 0) return search
    if (selectedSupplier) return `${selectedSupplier.name} · ${selectedSupplier.nit}`
    if (value && selectedSupplierQuery.isLoading) return "Cargando…"
    return ""
  })()

  useClickOutside(containerRef, () => {
    setOpen(false)
    setHighlighted(0)
  }, open)

  // Keep the dropdown width in sync with the input so it always matches
  // even when the layout reflows (sidebar collapse, responsive resize).
  useEffect(() => {
    if (!open) return
    const update = () => {
      const width = inputWrapperRef.current?.clientWidth
      setDropdownWidth(typeof width === "number" ? width : undefined)
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [open])

  const handleSelect = (supplier: SupplierSummary) => {
    onChange(supplier.id)
    setSearch("")
    setOpen(false)
    setHighlighted(0)
  }

  const handleClear = () => {
    onChange(undefined)
    setSearch("")
    setOpen(false)
    setHighlighted(0)
  }

  const trimmed = search.trim()
  const hasResults = results.length > 0
  const showEmptyState =
    !isFetching && trimmed.length >= 1 && !hasResults
  const showInitialHint = !isFetching && trimmed.length === 0 && !hasResults
  const showLoading =
    (isFetching && trimmed.length >= 1) ||
    (Boolean(value) && search === "" && selectedSupplierQuery.isLoading)

  return (
    <div className="grid gap-2" ref={containerRef}>
      <label
        htmlFor="supplier-search"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
      </label>
      <div className="relative" ref={inputWrapperRef}>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="supplier-search"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? "supplier-picker-list" : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          placeholder={placeholder}
          value={displayText}
          onChange={(event) => {
            setSearch(event.target.value)
            setHighlighted(0)
            setOpen(true)
          }}
          onFocus={() => {
            setHighlighted(0)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
              setHighlighted((idx) =>
                Math.min(idx + 1, Math.max(results.length - 1, 0)),
              )
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setHighlighted((idx) => Math.max(idx - 1, 0))
            } else if (event.key === "Enter" && open && results[highlighted]) {
              event.preventDefault()
              handleSelect(results[highlighted])
            } else if (event.key === "Escape" && open) {
              setOpen(false)
            }
          }}
          disabled={disabled}
          className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pl-9 pr-9 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        />
        {value && search.length === 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Limpiar proveedor seleccionado"
            className="absolute right-0 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : null}

        {open ? (
          <div
            id="supplier-picker-list"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-card shadow-md"
            style={{ width: dropdownWidth }}
          >
            {showLoading ? (
              <div className="flex flex-col gap-2 px-3 py-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : null}
            {!showLoading && showInitialHint ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                Empieza a escribir para buscar por nombre, NIT o contacto.
              </p>
            ) : null}
            {!showLoading && showEmptyState ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                Sin resultados para «{trimmed}».
              </p>
            ) : null}
            {!showLoading && hasResults ? (
              <ul className="divide-y py-1">
                {results.map((supplier, idx) => {
                  const isSelected = supplier.id === value
                  const isHighlighted = idx === highlighted
                  return (
                    <li
                      key={supplier.id}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(supplier)}
                        onMouseEnter={() => setHighlighted(idx)}
                        className={`flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors focus-visible:outline-none ${
                          isHighlighted ? "bg-muted" : ""
                        } ${isSelected ? "font-medium" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{supplier.name}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {supplier.nit}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {[
                            supplier.city,
                            supplier.contactPerson,
                            supplier.phone,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Sin datos de contacto"}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
