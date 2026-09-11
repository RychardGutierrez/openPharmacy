"use client"

import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatCurrencyBOB } from "@/shared/utils/format"
import {
  isControlledCategory,
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  type ReturnableSale,
  type ReturnType,
} from "@/features/returns/types"

export interface FoundSaleCardProps {
  sale: ReturnableSale
  selectedIds: Set<string>
  onToggle: (id: string) => void
  returnType: ReturnType
  disabled?: boolean
}

export function FoundSaleCard({
  sale,
  selectedIds,
  onToggle,
  returnType,
  disabled = false,
}: FoundSaleCardProps) {
  const isCompleted = sale.status === "COMPLETED"
  const hasControlledLine = sale.items.some((item) =>
    isControlledCategory(item.productCategory),
  )
  const isFullReturn = returnType === "FULL"

  const returnableQuantity = (item: ReturnableSale["items"][number]) =>
    item.quantity - item.alreadyReturnedQuantity

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Venta {sale.receiptNumber}</CardTitle>
          <span
            className="inline-flex h-5 w-fit items-center justify-center rounded-4xl px-2 py-0.5 text-xs font-medium whitespace-nowrap"
            data-status={sale.status.toLowerCase()}
          >
            {SALE_STATUS_LABELS[sale.status]}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>
            {new Date(sale.createdAt).toLocaleString("es-BO")} ·{" "}
            {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
          </p>
          <p className="mt-1">
            Total: {formatCurrencyBOB(sale.total)} · Pagado:{" "}
            {formatCurrencyBOB(sale.cashReceived)} · Cambio:{" "}
            {formatCurrencyBOB(sale.changeGiven)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {hasControlledLine && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertTitle>Venta con sustancia controlada</AlertTitle>
            <AlertDescription>
              Esta venta incluye un producto psicotrópico o narcótico. Las
              devoluciones y cancelaciones de sustancias controladas no están
              permitidas.
            </AlertDescription>
          </Alert>
        )}

        {!isCompleted && !hasControlledLine && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertTitle>Venta no disponible</AlertTitle>
            <AlertDescription>
              Solo se pueden devolver o cancelar ventas completadas.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Devolver</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => {
                const controlled = isControlledCategory(item.productCategory)
                const remaining = returnableQuantity(item)
                const isSelectable =
                  isCompleted && !controlled && remaining > 0 && !disabled
                const isSelected = isFullReturn
                  ? isSelectable
                  : selectedIds.has(item.id)
                const checkboxId = `return-item-${item.id}`

                return (
                  <TableRow
                    key={item.id}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Checkbox
                              id={checkboxId}
                              checked={isSelected}
                              disabled={!isSelectable || isFullReturn}
                              onCheckedChange={() => onToggle(item.id)}
                              aria-label={`Devolver ${item.productName}`}
                            />
                          </span>
                        </TooltipTrigger>
                        {controlled ? (
                          <TooltipContent>
                            Sustancia controlada — no admite devolución
                          </TooltipContent>
                        ) : remaining <= 0 ? (
                          <TooltipContent>
                            Toda la cantidad ya fue devuelta
                          </TooltipContent>
                        ) : isFullReturn ? (
                          <TooltipContent>
                            Seleccionado automáticamente por devolución total
                          </TooltipContent>
                        ) : null}
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <label
                        htmlFor={checkboxId}
                        className="cursor-pointer font-medium"
                      >
                        {item.productName}
                      </label>
                      {controlled && (
                        <p className="text-xs text-destructive">
                          Sustancia controlada
                        </p>
                      )}
                      {item.alreadyReturnedQuantity > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Ya devuelto: {item.alreadyReturnedQuantity}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{item.lotNumber}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyBOB(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyBOB(item.lineTotal)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
