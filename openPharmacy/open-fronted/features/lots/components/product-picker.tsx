"use client"

import { useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { useProduct } from "@/features/products/api/use-product"
import { useSearchProducts } from "@/features/products/api/use-search-products"
import { productsKeys } from "@/features/products/api/use-products"
import { useClickOutside } from "@/shared/hooks/use-click-outside"
import type { Product } from "@/features/products/types"

export interface ProductPickerProps {
  value: string | undefined
  onChange: (productId: string | undefined) => void
  label?: string
  placeholder?: string
}

export function ProductPicker({
  value,
  onChange,
  label = "Producto",
  placeholder = "Buscar producto por nombre, DCI o código…",
}: ProductPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { data: products, isFetching, refetch } = useSearchProducts(search)
  const { data: selectedProduct } = useProduct(value ?? "")

  useClickOutside(containerRef, () => setOpen(false), open)

  const displayValue =
    selectedProduct && search === "" && value
      ? `${selectedProduct.commercialName} (${selectedProduct.dciName})`
      : search

  const handleInputChange = (next: string) => {
    setSearch(next)
    setOpen(true)
  }

  const handleSelect = (product: Product) => {
    queryClient.setQueryData(productsKeys.detail(product.id), product)
    onChange(product.id)
    setSearch("")
    setOpen(false)
  }

  const handleClear = () => {
    onChange(undefined)
    setSearch("")
    setOpen(false)
  }

  const handleTriggerSearch = () => {
    setOpen(true)
    if (search.trim().length >= 1) {
      void refetch()
    }
  }

  const showResults = open && (isFetching || products !== undefined)
  const trimmed = search.trim()
  const canSearch = trimmed.length >= 1
  const hasResults = products && products.length > 0
  const showEmpty =
    !isFetching && products !== undefined && !hasResults && canSearch

  return (
    <div className="grid gap-2" ref={containerRef}>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
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
            aria-controls={open ? "product-picker-list" : undefined}
            placeholder={placeholder}
            value={displayValue}
            onChange={(event) => handleInputChange(event.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleTriggerSearch()
              }
            }}
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
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleTriggerSearch}
              className="absolute right-0 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Buscar producto"
            >
              <Search className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {showResults ? (
          <div
            id="product-picker-list"
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
                {products.map((product) => (
                  <li
                    key={product.id}
                    role="option"
                    aria-selected={value === product.id}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(product)}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                        value === product.id ? "bg-muted font-medium" : ""
                      }`}
                    >
                      <div className="font-medium">
                        {product.commercialName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {product.dciName} · {product.barcode}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {showEmpty ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Sin resultados.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
