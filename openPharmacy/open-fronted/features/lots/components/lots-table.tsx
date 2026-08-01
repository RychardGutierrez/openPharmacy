"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LotStatusBadge } from "@/features/lots/components/lot-status-badge"
import { LotFefoIndicator } from "@/features/lots/components/lot-fefo-indicator"
import { cn } from "@/lib/utils"
import type { Lot } from "@/features/lots/types"

export interface LotsTableProps {
  data: Lot[]
  onEdit?: (lot: Lot) => void
  onVoid?: (lot: Lot) => void
  onTrace?: (lot: Lot) => void
  onSelect?: (lot: Lot) => void
  selectedLotId?: string | null
  showProduct?: boolean
}

const ROW_HEIGHT = 56
const OVERSCAN = 8

const GRID_TEMPLATE =
  "48px minmax(140px,1fr) minmax(120px,1fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(120px,1fr) 56px"

function getNextFefoLot(lots: Lot[]): Lot | undefined {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return lots
    .filter(
      (lot) =>
        !lot.voidedAt &&
        lot.currentQty > 0 &&
        new Date(lot.expiryDate).setHours(0, 0, 0, 0) >= now.getTime(),
    )
    .sort(
      (a, b) =>
        new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
    )[0]
}

function getDaysUntil(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
}

export function LotsTable({
  data,
  onEdit,
  onVoid,
  onTrace,
  onSelect,
  selectedLotId,
  showProduct = false,
}: LotsTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const sorted = data.toSorted(
    (a, b) =>
      new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
  )

  const nextFefoLot = getNextFefoLot(sorted)

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  return (
    <div className="rounded-lg border bg-card" data-slot="lots-table">
      <div
        role="row"
        className="grid border-b bg-card text-sm font-medium text-foreground"
        style={{
          gridTemplateColumns: showProduct
            ? `minmax(120px,0.8fr) ${GRID_TEMPLATE}`
            : GRID_TEMPLATE,
        }}
      >
        {showProduct ? (
          <div role="columnheader" className="px-3 py-2">
            Producto
          </div>
        ) : null}
        <div role="columnheader" className="px-2 py-2">
          <span className="sr-only">FEFO</span>
        </div>
        <div role="columnheader" className="px-3 py-2">Lote</div>
        <div role="columnheader" className="px-3 py-2">Vencimiento</div>
        <div role="columnheader" className="px-3 py-2">Cantidad</div>
        <div role="columnheader" className="px-3 py-2">Estado</div>
        <div role="columnheader" className="px-3 py-2">Registro</div>
        <div role="columnheader" className="px-2 py-2">
          <span className="sr-only">Acciones</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        style={{ maxHeight: "600px" }}
        tabIndex={0}
        aria-label="Lista de lotes"
      >
        {sorted.length === 0 ? (
          <div className="flex h-24 items-center justify-center px-3 text-sm text-muted-foreground">
            No se encontraron lotes con los filtros seleccionados.
          </div>
        ) : (
          <div
            className="relative"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const lot = sorted[virtualRow.index]
              if (!lot) return null
              const daysUntil = getDaysUntil(lot.expiryDate)
              const isNextFefo = lot.id === nextFefoLot?.id
              const isSelected = lot.id === selectedLotId
              const isVoided = Boolean(lot.voidedAt)

              return (
                <div
                  key={lot.id}
                  role="row"
                  data-index={virtualRow.index}
                  onClick={() => onSelect?.(lot)}
                  className={cn(
                    "grid cursor-pointer border-b text-sm transition-colors hover:bg-muted/40",
                    "absolute left-0 w-full",
                    isSelected ? "bg-muted" : "",
                    isVoided ? "opacity-60" : "",
                  )}
                  style={{
                    gridTemplateColumns: showProduct
                      ? `minmax(120px,0.8fr) ${GRID_TEMPLATE}`
                      : GRID_TEMPLATE,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {showProduct ? (
                    <div
                      role="cell"
                      className="flex items-center truncate px-3 text-muted-foreground"
                      title={lot.product?.commercialName ?? lot.productId}
                    >
                      {lot.product?.commercialName ?? lot.productId}
                    </div>
                  ) : null}
                  <div
                    role="cell"
                    className="flex items-center justify-center px-2"
                  >
                    <LotFefoIndicator isNext={isNextFefo} />
                  </div>
                  <div role="cell" className="flex items-center px-3">
                    <span
                      className={cn(
                        "truncate font-medium",
                        isVoided ? "line-through" : "",
                      )}
                      title={lot.lotNumber}
                    >
                      {lot.lotNumber}
                    </span>
                  </div>
                  <div
                    role="cell"
                    className="flex items-center px-3 tabular-nums"
                  >
                    {new Date(lot.expiryDate).toLocaleDateString("es-BO")}
                  </div>
                  <div
                    role="cell"
                    className="flex items-center px-3 tabular-nums"
                  >
                    {lot.currentQty}
                  </div>
                  <div role="cell" className="flex items-center px-3">
                    <LotStatusBadge daysUntil={daysUntil} />
                  </div>
                  <div
                    role="cell"
                    className="flex items-center px-3 text-xs text-muted-foreground"
                  >
                    {new Date(lot.createdAt).toLocaleDateString("es-BO")}
                  </div>
                  <div
                    role="cell"
                    className="flex items-center justify-center px-1"
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Abrir acciones para lote ${lot.lotNumber}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onSelect={() => onEdit?.(lot)}
                          disabled={isVoided}
                        >
                          <Pencil className="mr-2 size-4" aria-hidden="true" />
                          <span>Editar</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onVoid?.(lot)}
                          disabled={isVoided || lot.currentQty > 0}
                        >
                          <Trash2 className="mr-2 size-4" aria-hidden="true" />
                          <span>Anular</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onTrace?.(lot)}>
                          <Search className="mr-2 size-4" aria-hidden="true" />
                          <span>Trazabilidad</span>
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
