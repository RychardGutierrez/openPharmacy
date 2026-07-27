"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { MoreHorizontal, Package, Pencil, Power, PowerOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProductCategoryBadge } from "@/features/products/components/product-category-badge"
import { formatCurrencyBOB } from "@/shared/utils/format"
import { StatusBadge } from "@/shared/components/status-badge"
import type { Product } from "@/features/products/types"
import { cn } from "@/lib/utils"

export interface ProductsTableProps {
  data: Product[]
  onEdit: (product: Product) => void
  onToggleStatus: (product: Product) => void
  onViewDetail?: (product: Product) => void
}

const ROW_HEIGHT = 56
const OVERSCAN = 8

/**
 * Column template using CSS grid track sizes. Using a single `gridTemplateColumns`
 * for both header and body keeps every cell perfectly aligned, and avoids the
 * `<tr>` / `position: absolute` quirks that break virtualization in real tables.
 */
const GRID_TEMPLATE =
  "minmax(180px,1.6fr) minmax(140px,1fr) minmax(170px,1fr) minmax(150px,1fr) minmax(130px,0.9fr) minmax(100px,0.6fr) minmax(110px,0.7fr) 56px"

export function ProductsTable({
  data,
  onEdit,
  onToggleStatus,
  onViewDetail,
}: ProductsTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  return (
    <div
      className="rounded-lg border bg-card"
      data-slot="products-table"
    >
      {/* Header (sticky inside the scroll container below) */}
      <div
        role="row"
        className="grid border-b bg-card text-sm font-medium text-foreground"
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
      >
        <div role="columnheader" className="px-3 py-2">Nombre comercial</div>
        <div role="columnheader" className="px-3 py-2">DCI</div>
        <div role="columnheader" className="px-3 py-2">Código</div>
        <div role="columnheader" className="px-3 py-2">Categoría</div>
        <div role="columnheader" className="px-3 py-2">Precio venta</div>
        <div role="columnheader" className="px-3 py-2">Stock mín.</div>
        <div role="columnheader" className="px-3 py-2">Estado</div>
        <div role="columnheader" className="px-2 py-2">
          <span className="sr-only">Acciones</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        ref={scrollRef}
        className="overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        style={{ maxHeight: "600px" }}
        tabIndex={0}
        aria-label="Catálogo de productos"
      >
        {data.length === 0 ? (
          <div className="flex h-24 items-center justify-center px-3 text-sm text-muted-foreground">
            No se encontraron productos con los filtros seleccionados.
          </div>
        ) : (
          <div
            className="relative"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const product = data[virtualRow.index]
              if (!product) return null
              return (
                <div
                  key={product.id}
                  role="row"
                  data-index={virtualRow.index}
                  className={cn(
                    "grid border-b text-sm transition-colors hover:bg-muted/40",
                    "absolute left-0 w-full",
                  )}
                  style={{
                    gridTemplateColumns: GRID_TEMPLATE,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div role="cell" className="flex items-center px-3">
                    <button
                      type="button"
                      onClick={() => onViewDetail?.(product)}
                      className="cursor-pointer truncate text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      title={product.commercialName}
                    >
                      {product.commercialName}
                    </button>
                  </div>
                  <div
                    role="cell"
                    className="flex items-center truncate px-3 text-muted-foreground"
                    title={product.dciName}
                  >
                    {product.dciName}
                  </div>
                  <div role="cell" className="flex items-center px-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {product.barcode}
                    </span>
                  </div>
                  <div role="cell" className="flex items-center px-3">
                    <ProductCategoryBadge category={product.category} />
                  </div>
                  <div role="cell" className="flex items-center px-3 tabular-nums">
                    {formatCurrencyBOB(product.salePrice)}
                  </div>
                  <div role="cell" className="flex items-center px-3 tabular-nums">
                    {product.minStock}
                  </div>
                  <div role="cell" className="flex items-center px-3">
                    <StatusBadge active={product.active} />
                  </div>
                  <div role="cell" className="flex items-center justify-center px-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Abrir acciones para ${product.commercialName}`}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => onViewDetail?.(product)}>
                          <Package aria-hidden="true" />
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onEdit(product)}>
                          <Pencil aria-hidden="true" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onToggleStatus(product)}>
                          {product.active ? (
                            <>
                              <PowerOff aria-hidden="true" />
                              Desactivar
                            </>
                          ) : (
                            <>
                              <Power aria-hidden="true" />
                              Reactivar
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
