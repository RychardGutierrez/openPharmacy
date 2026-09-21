"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useSearchProducts } from "@/features/products/api/use-search-products"
import { productsKeys } from "@/features/products/api/use-products"
import {
  PRODUCT_CATEGORY_LABELS,
  type Product,
} from "@/features/products/types"

export interface ProductPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives every product the user confirmed. Called once on confirm. */
  onConfirm: (products: Product[]) => void
  /** Product ids that are already in the order — never selectable. */
  excludeProductIds?: Set<string>
}

export function ProductPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  excludeProductIds,
}: ProductPickerDialogProps) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Product[]>([])
  const queryClient = useQueryClient()
  const trimmed = search.trim()

  const { data: results, isFetching } = useSearchProducts(trimmed)

  const filtered = useMemo(() => {
    if (!results) return []
    if (!excludeProductIds || excludeProductIds.size === 0) return results
    return results.filter((p) => !excludeProductIds.has(p.id))
  }, [results, excludeProductIds])

  const isSelected = (id: string) =>
    selected.some((product) => product.id === id)

  const toggle = (product: Product) => {
    queryClient.setQueryData(productsKeys.detail(product.id), product)
    setSelected((prev) => {
      if (prev.some((existing) => existing.id === product.id)) {
        return prev.filter((existing) => existing.id !== product.id)
      }
      return [...prev, product]
    })
  }

  const removeFromSelection = (productId: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== productId))
  }

  const clearSelection = () => setSelected([])

  const handleCancel = () => {
    setSelected([])
    setSearch("")
    onOpenChange(false)
  }

  const handleConfirm = () => {
    if (selected.length === 0) return
    onConfirm(selected)
    setSelected([])
    setSearch("")
    onOpenChange(false)
  }

  const confirmLabel =
    selected.length === 0
      ? "Agregar a la orden"
      : `Agregar ${selected.length} ${selected.length === 1 ? "producto" : "productos"}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar productos</DialogTitle>
          <DialogDescription>
            Marca uno o varios productos para añadirlos a la orden. Puedes
            seguir buscando mientras mantienes la selección.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto…"
            className="pl-9"
            autoFocus
            aria-label="Buscar producto"
          />
        </div>

        {selected.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-accent/30 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>
                {selected.length} seleccionado
                {selected.length === 1 ? "" : "s"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={clearSelection}
              >
                Limpiar selección
              </Button>
            </div>
            <ul
              className="flex flex-wrap gap-1.5"
              aria-label="Productos seleccionados"
            >
              {selected.map((product) => (
                <li key={product.id}>
                  <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs">
                    <span className="font-medium">{product.commercialName}</span>
                    <button
                      type="button"
                      onClick={() => removeFromSelection(product.id)}
                      className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Quitar ${product.commercialName} de la selección`}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Resultados de búsqueda"
          className="max-h-72 overflow-y-auto rounded-md border bg-card"
        >
          {isFetching ? (
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : trimmed.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Empieza a escribir para buscar productos.
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Sin resultados.
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((product) => {
                const selected = isSelected(product.id)
                return (
                  <li
                    key={product.id}
                    role="option"
                    aria-selected={selected}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(product)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${
                        selected ? "bg-accent/30" : ""
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background"
                        }`}
                        aria-hidden="true"
                      >
                        {selected ? (
                          <Check className="size-3.5" />
                        ) : null}
                      </span>
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {product.commercialName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {product.dciName} · {product.barcode} ·{" "}
                          {PRODUCT_CATEGORY_LABELS[product.category]}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selected.length === 0}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
