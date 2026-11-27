"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSiatCatalogItems } from "@/features/siat-settings/api/use-siat-settings"
import type { SiatCatalogItem } from "@/features/products/types"
import { useClickOutside } from "@/shared/hooks/use-click-outside"
import { useDebounce } from "@/shared/hooks/use-debounce"

export type SiatPickerCatalog = "activities" | "products" | "units"

export interface SiatCatalogPickerProps {
  catalog: SiatPickerCatalog
  /** Required for `products`: the activity the product must belong to. */
  parentCode?: string
  /** The stored SIN code (activity code, product code or unit code). */
  value: string | undefined
  onChange: (code: string | undefined) => void
  label: string
  placeholder?: string
  disabled?: boolean
  ariaInvalid?: boolean
  id: string
}

/**
 * The code to store for a catalog item. Products are keyed `activity:product` in the catalog, but
 * the product code itself is in `extra.codigoProducto`.
 */
export function storedCodeOf(
  catalog: SiatPickerCatalog,
  item: SiatCatalogItem,
): string {
  if (catalog === "products") {
    const code = item.extra?.codigoProducto
    if (typeof code === "string" || typeof code === "number") return String(code)
    return item.code.split(":").pop() ?? item.code
  }
  return item.code
}

/**
 * Combobox over one SIN catalog (SIAT-08). It keeps the stored code in the form and shows the
 * selected item's description. Products are only searchable once an activity is chosen.
 */
export function SiatCatalogPicker({
  catalog,
  parentCode,
  value,
  onChange,
  label,
  placeholder = "Buscar por código o descripción…",
  disabled = false,
  ariaInvalid,
  id,
}: SiatCatalogPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined)
  const debouncedSearch = useDebounce(search, 250)

  const needsParent = catalog === "products"
  const searchEnabled = !needsParent || Boolean(parentCode)

  // The list for the open dropdown.
  const list = useSiatCatalogItems(
    catalog,
    {
      parentCode: needsParent ? parentCode : undefined,
      search: debouncedSearch.trim() || undefined,
      pageSize: 20,
    },
    { enabled: open && searchEnabled },
  )
  const results = list.data?.items ?? []

  // The selected item, found by its stored code. Products are searched by `activity:product`,
  // which the backend matches as a code prefix.
  const lookupSearch =
    value && needsParent && parentCode
      ? `${parentCode}:${value}`
      : value
  const selectedQuery = useSiatCatalogItems(
    catalog,
    {
      parentCode: needsParent ? parentCode : undefined,
      search: lookupSearch,
      pageSize: 5,
    },
    { enabled: Boolean(value) && searchEnabled && search === "" },
  )
  const selected = value
    ? (selectedQuery.data?.items ?? []).find(
        (item) => storedCodeOf(catalog, item) === value,
      )
    : undefined

  const displayText = (() => {
    if (search.length > 0) return search
    if (selected) return `${storedCodeOf(catalog, selected)} · ${selected.description}`
    if (value && selectedQuery.isLoading) return "Cargando…"
    return value ?? ""
  })()

  useClickOutside(containerRef, () => {
    setOpen(false)
    setHighlighted(0)
  }, open)

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

  const handleSelect = (item: SiatCatalogItem) => {
    onChange(storedCodeOf(catalog, item))
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
  const showLoading = list.isFetching && open && searchEnabled
  const showEmpty = !showLoading && results.length === 0 && open
  // With no search text the dropdown lists the whole catalog, so an empty list there means the
  // catalog has no synced codes, not that the user typed something wrong.
  const hint = needsParent && !parentCode
    ? "Elige primero la actividad."
    : list.isError
      ? "No se pudo cargar el catálogo SIN. Intenta de nuevo."
      : trimmed.length > 0
        ? `Sin resultados para «${trimmed}».`
        : needsParent
          ? "Esta actividad no tiene productos SIN sincronizados."
          : "Catálogo SIN sin sincronizar. Un administrador debe sincronizarlo en Configuración › Facturación SIAT."

  return (
    <div className="grid gap-2" ref={containerRef}>
      <label
        htmlFor={id}
        className="text-sm font-medium leading-none"
      >
        {label}
      </label>
      <div className="relative" ref={inputWrapperRef}>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? `${id}-list` : undefined}
          aria-invalid={ariaInvalid}
          placeholder={needsParent && !parentCode ? "Elige una actividad primero" : placeholder}
          value={displayText}
          disabled={disabled || (needsParent && !parentCode)}
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
              setHighlighted((idx) => Math.min(idx + 1, Math.max(results.length - 1, 0)))
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
          className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pl-9 pr-9 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {value && search.length === 0 && !disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            aria-label={`Limpiar ${label.toLowerCase()}`}
            className="absolute right-0 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : null}

        {open ? (
          <div
            id={`${id}-list`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-card shadow-md"
            style={{ width: dropdownWidth }}
          >
            {showLoading ? (
              <div className="flex flex-col gap-2 px-3 py-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : null}
            {showEmpty ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">{hint}</p>
            ) : null}
            {!showLoading && results.length > 0 ? (
              <ul className="divide-y py-1">
                {results.map((item, idx) => {
                  const code = storedCodeOf(catalog, item)
                  const isHighlighted = idx === highlighted
                  return (
                    <li key={`${item.code}`} role="option" aria-selected={code === value}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setHighlighted(idx)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors focus-visible:outline-none ${
                          isHighlighted ? "bg-muted" : ""
                        } ${code === value ? "font-medium" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {code}
                          </span>
                          <span className="truncate text-sm">{item.description}</span>
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
