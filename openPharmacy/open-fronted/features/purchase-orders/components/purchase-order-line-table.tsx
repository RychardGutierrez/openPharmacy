"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrencyBOB } from "@/shared/utils/format"

/**
 * String-typed quantities and unit costs. Storing the raw user input as a
 * string avoids the `type="number"` "leading zero" problem (e.g. a 0 by
 * default that becomes 01 when the user types 1). Numbers are parsed on
 * demand and validated at submission time by the parent form.
 */
export interface DraftLineRow {
  productId: string
  productName: string
  qtyOrdered: string
  unitCost: string
}

export interface PurchaseOrderLineTableProps {
  lines: DraftLineRow[]
  onQuantityChange: (productId: string, value: string) => void
  onCostChange: (productId: string, value: string) => void
  onRemove: (productId: string) => void
}

const INPUT_BASE_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2 py-1 text-right text-sm tabular-nums focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
const NUMBER_INPUT_CLASS = `${INPUT_BASE_CLASS} w-20`
const CURRENCY_INPUT_CLASS = `${INPUT_BASE_CLASS} w-28`

const QTY_PATTERN = "[0-9]*"
const CURRENCY_PATTERN = "[0-9]*\\.?[0-9]{0,2}"

/** Strict integer >= 1. Empty / non-numeric returns null. */
export function parseQuantity(raw: string): number | null {
  if (raw.trim() === "") return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  const intValue = Math.trunc(parsed)
  if (intValue !== parsed || intValue < 1) return null
  return intValue
}

/** Strict positive number with up to 2 decimals. Empty / non-numeric returns null. */
export function parseCurrency(raw: string): number | null {
  if (raw.trim() === "") return null
  const normalised = raw.replace(",", ".")
  const parsed = Number(normalised)
  if (!Number.isFinite(parsed)) return null
  if (parsed <= 0) return null
  // Reject more than 2 decimal places.
  const decimals = normalised.split(".")[1] ?? ""
  if (decimals.length > 2) return null
  return Math.round(parsed * 100) / 100
}

export function PurchaseOrderLineTable({
  lines,
  onQuantityChange,
  onCostChange,
  onRemove,
}: PurchaseOrderLineTableProps) {
  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Aún no agregaste productos. Usa el botón «Agregar producto» para
        empezar.
      </div>
    )
  }

  // Totals use the parsed numbers so partially typed inputs (e.g. "") just
  // contribute zero until the user finishes entering them.
  const total = lines.reduce((sum, line) => {
    const qty = parseQuantity(line.qtyOrdered) ?? 0
    const cost = parseCurrency(line.unitCost) ?? 0
    return sum + qty * cost
  }, 0)

  return (
    <>
      {/* Mobile layout */}
      <div className="grid gap-3 md:hidden">
        {lines.map((line) => {
          const qty = parseQuantity(line.qtyOrdered) ?? 0
          const cost = parseCurrency(line.unitCost) ?? 0
          const qtyInvalid = line.qtyOrdered.trim() !== "" && parseQuantity(line.qtyOrdered) === null
          const costInvalid =
            line.unitCost.trim() !== "" && parseCurrency(line.unitCost) === null
          return (
            <article
              key={line.productId}
              className="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
              aria-label={line.productName}
            >
              <header className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {line.productName}
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(line.productId)}
                  aria-label={`Eliminar ${line.productName}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </header>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">
                    Cantidad
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern={QTY_PATTERN}
                    placeholder="0"
                    value={line.qtyOrdered}
                    onChange={(event) =>
                      onQuantityChange(line.productId, event.target.value)
                    }
                    aria-invalid={qtyInvalid}
                    aria-label={`Cantidad de ${line.productName}`}
                    className="text-right tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">
                    Costo unitario (BOB)
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    pattern={CURRENCY_PATTERN}
                    placeholder="0.00"
                    value={line.unitCost}
                    onChange={(event) =>
                      onCostChange(line.productId, event.target.value)
                    }
                    aria-invalid={costInvalid}
                    aria-label={`Costo unitario de ${line.productName}`}
                    className="text-right tabular-nums"
                  />
                </label>
              </div>
              {(qtyInvalid || costInvalid) && (
                <p className="text-xs text-destructive">
                  {qtyInvalid ? "Cantidad inválida." : null}
                  {qtyInvalid && costInvalid ? " " : null}
                  {costInvalid ? "Costo unitario inválido." : null}
                </p>
              )}
              <p className="text-right text-xs text-muted-foreground">
                Subtotal:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrencyBOB(qty * cost)}
                </span>
              </p>
            </article>
          )
        })}
        <p className="text-right text-sm font-medium">
          Total estimado: {formatCurrencyBOB(total)}
        </p>
      </div>

      {/* Desktop layout */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="w-32 text-right">Cantidad</TableHead>
              <TableHead className="w-36 text-right">
                Costo unitario (BOB)
              </TableHead>
              <TableHead className="w-32 text-right">Subtotal</TableHead>
              <TableHead className="w-12" aria-label="Acciones" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const qty = parseQuantity(line.qtyOrdered) ?? 0
              const cost = parseCurrency(line.unitCost) ?? 0
              const qtyInvalid =
                line.qtyOrdered.trim() !== "" && parseQuantity(line.qtyOrdered) === null
              const costInvalid =
                line.unitCost.trim() !== "" && parseCurrency(line.unitCost) === null
              return (
                <TableRow key={line.productId}>
                  <TableCell className="font-medium">
                    {line.productName}
                  </TableCell>
                  <TableCell className="text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern={QTY_PATTERN}
                      placeholder="0"
                      value={line.qtyOrdered}
                      onChange={(event) =>
                        onQuantityChange(line.productId, event.target.value)
                      }
                      aria-invalid={qtyInvalid}
                      aria-label={`Cantidad de ${line.productName}`}
                      className={NUMBER_INPUT_CLASS}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern={CURRENCY_PATTERN}
                      placeholder="0.00"
                      value={line.unitCost}
                      onChange={(event) =>
                        onCostChange(line.productId, event.target.value)
                      }
                      aria-invalid={costInvalid}
                      aria-label={`Costo unitario de ${line.productName}`}
                      className={CURRENCY_INPUT_CLASS}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyBOB(qty * cost)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onRemove(line.productId)}
                      aria-label={`Eliminar ${line.productName}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            <TableRow>
              <TableCell colSpan={3} className="text-right font-medium">
                Total estimado
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatCurrencyBOB(total)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </>
  )
}
