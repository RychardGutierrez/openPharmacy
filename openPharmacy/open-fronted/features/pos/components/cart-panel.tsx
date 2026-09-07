"use client"

import { useMemo } from "react"
import { BanknoteIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCurrencyBOB } from "@/shared/utils/format"
import { computeCartTotals, usePosStore } from "@/features/pos/store/pos-store"
import { CartLineRow } from "@/features/pos/components/cart-line"

interface CartPanelProps {
  onCheckout: () => void
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const lines = usePosStore((state) => state.lines)
  const clearCart = usePosStore((state) => state.clearCart)
  const totals = useMemo(() => computeCartTotals(lines), [lines])

  return (
    <section
      aria-label="Carrito de venta"
      className="flex h-full min-h-0 flex-col gap-3 rounded-xl border bg-muted/40 p-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-sm font-semibold uppercase tracking-[0.14em]">
          <BanknoteIcon className="size-4 text-primary" aria-hidden="true" />
          Carrito
          <span className="font-mono text-xs font-bold text-muted-foreground">
            ({lines.length})
          </span>
        </h2>
        {lines.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={clearCart}
            className="text-muted-foreground"
          >
            Vaciar
          </Button>
        )}
      </header>

      {lines.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Escanea un producto para comenzar la venta.
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
          {lines.map((line) => (
            <CartLineRow key={line.productId} line={line} />
          ))}
        </ul>
      )}

      <Separator />

      <dl className="space-y-1 font-mono text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal</dt>
          <dd>{formatCurrencyBOB(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Descuento</dt>
          <dd className={totals.discount > 0 ? "text-destructive" : ""}>
            −{formatCurrencyBOB(totals.discount)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <dt className="font-sans text-sm font-semibold uppercase tracking-wide">
            Total
          </dt>
          <dd
            aria-live="polite"
            className="font-serif text-2xl font-bold text-primary"
          >
            {formatCurrencyBOB(totals.total)}
          </dd>
        </div>
      </dl>

      <Button
        size="lg"
        className="h-12 w-full text-base font-bold"
        disabled={lines.length === 0}
        onClick={onCheckout}
      >
        Cobrar {lines.length > 0 ? formatCurrencyBOB(totals.total) : ""}
      </Button>
    </section>
  )
}
