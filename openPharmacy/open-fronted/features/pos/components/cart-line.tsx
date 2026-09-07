"use client"

import { memo } from "react"
import { MinusIcon, PlusIcon, Trash2Icon, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatCurrencyBOB } from "@/shared/utils/format"
import { usePosStore } from "@/features/pos/store/pos-store"
import { formatDaysUntilExpiry } from "@/features/lots/types"
import { lineTotal, type CartLine } from "@/features/pos/types"


interface CartLineRowProps {
  line: CartLine
}

function daysUntil(dateIso: string): number {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const target = new Date(dateIso)
  target.setUTCHours(0, 0, 0, 0)
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000)
}

export const CartLineRow = memo(function CartLineRow({ line }: CartLineRowProps) {
  const incrementQty = usePosStore((state) => state.incrementQty)
  const decrementQty = usePosStore((state) => state.decrementQty)
  const removeLine = usePosStore((state) => state.removeLine)
  const setLineDiscount = usePosStore((state) => state.setLineDiscount)

  const showExpiry =
    line.earliestExpiry !== null && daysUntil(line.earliestExpiry) <= 60

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3",
        showExpiry && "border-orange-300 dark:border-orange-800",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {line.commercialName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {line.dciName} · {formatCurrencyBOB(line.unitPrice)} c/u
          </p>
          {line.fefoLots.length > 0 && (
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              Lote {line.fefoLots[0].lotNumber}
              {line.fefoLots.length > 1
                ? ` +${line.fefoLots.length - 1} más`
                : ""}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => removeLine(line.productId)}
          aria-label={`Quitar ${line.commercialName} del carrito`}
        >
          <Trash2Icon className="text-muted-foreground" />
        </Button>
      </div>

      {showExpiry && line.earliestExpiry !== null && (
        <p
          role="alert"
          className="flex items-center gap-1.5 rounded bg-orange-100 px-2 py-1 text-[11px] font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          Vence {formatDaysUntilExpiry(daysUntil(line.earliestExpiry)).toLowerCase()} —
          verificar antes de vender.
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => decrementQty(line.productId)}
            aria-label="Disminuir cantidad"
            className="size-9"
          >
            <MinusIcon />
          </Button>
          <span
            className="w-10 text-center font-mono text-sm font-bold"
            aria-live="polite"
          >
            {line.quantity}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => incrementQty(line.productId)}
            aria-label="Aumentar cantidad"
            disabled={line.quantity >= line.availableQty}
            className="size-9"
          >
            <PlusIcon />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            %
            <Input
              type="number"
              min={0}
              max={100}
              value={line.discountPct === 0 ? "" : line.discountPct}
              onChange={(event) =>
                setLineDiscount(
                  line.productId,
                  Number(event.target.value) || 0,
                )
              }
              className="h-8 w-16 text-center font-mono"
              aria-label={`Descuento de ${line.commercialName} en porcentaje`}
            />
          </label>
          <span className="font-mono text-sm font-bold">
            {formatCurrencyBOB(lineTotal(line))}
          </span>
        </div>
      </div>
    </li>
  )
})
