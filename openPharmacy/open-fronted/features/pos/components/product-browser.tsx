"use client"

import { useDeferredValue, useEffect, useMemo, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ScanBarcode, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { searchProducts } from "@/features/products/api/products-api"
import { useProducts } from "@/features/products/api/use-products"
import { useSearchProducts } from "@/features/products/api/use-search-products"
import type { Product } from "@/features/products/types"
import { useBarcodeScanner } from "@/features/pos/hooks/use-barcode-scanner"
import { useAddProduct } from "@/features/pos/hooks/use-add-product"
import { ProductCard } from "@/features/pos/components/product-card"

export function ProductBrowser() {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { add } = useAddProduct()

  async function resolveScan(scanned: string) {
    try {
      const results = await queryClient.fetchQuery({
        queryKey: ["products", "search", `scan:${scanned}`] as const,
        queryFn: () => searchProducts(scanned, true),
        staleTime: 5_000,
      })
      const exact = results.find((product) => product.barcode === scanned)
      const chosen = exact ?? (results.length === 1 ? results[0] : undefined)
      if (chosen) {
        await add(chosen)
      }
    } catch {
      return
    }
  }

  const { value, setValue, debounced, handleKeyDown } = useBarcodeScanner(
    (scanned) => {
      void resolveScan(scanned)
    },
    50,
  )
  const deferred = useDeferredValue(debounced)

  const { data: searchResults, isFetching: isSearching } = useSearchProducts(
    deferred,
    true,
  )
  const { data: defaultPage, isPending } = useProducts({
    page: 1,
    pageSize: 24,
    active: true,
    includeStock: true,
  })

  const trimmed = deferred.trim()
  const products: Product[] = useMemo(() => {
    if (trimmed.length > 0) return searchResults ?? []
    return defaultPage?.data ?? []
  }, [trimmed, searchResults, defaultPage])

  const isLoading = trimmed.length > 0 ? isSearching : isPending

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative">
        <ScanBarcode
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-primary"
          aria-hidden="true"
        />
        <SearchIcon
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por codigo o por nombre producto..."
          aria-label="Buscar por codigo o por nombre producto"
          className="h-14 border-2 bg-background pl-11 pr-9 font-mono text-base shadow-none focus-visible:border-primary focus-visible:ring-primary/30"
          autoComplete="off"
          enterKeyHint="done"
          inputMode="numeric"
        />
      </div>

      {isLoading && products.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="grid h-40 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {trimmed.length > 0
            ? "Sin resultados para la búsqueda."
            : "No hay productos activos."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
