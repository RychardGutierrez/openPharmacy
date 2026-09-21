"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrencyBOB } from "@/shared/utils/format"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  type ReceivingResponse,
} from "@/features/purchase-orders/types"

const DATE_FORMAT = new Intl.DateTimeFormat("es-BO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export interface ReceivingSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  response: ReceivingResponse | null
  onClose?: () => void
}

export function ReceivingSuccessDialog({
  open,
  onOpenChange,
  response,
  onClose,
}: ReceivingSuccessDialogProps) {
  if (!response) return null
  const totalReceived = response.lots.reduce(
    (sum, lot) => sum + lot.qtyReceived,
    0,
  )
  const totalValue = response.lots.reduce(
    (sum, lot) => sum + lot.qtyReceived * lot.unitCost,
    0,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Recepción registrada</DialogTitle>
          <DialogDescription>
            Inventario actualizado para la orden. Revisa el detalle antes de
            continuar.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Factura</dt>
            <dd className="font-medium">{response.invoiceNumber}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Fecha factura</dt>
            <dd className="font-medium">
              {DATE_FORMAT.format(new Date(response.invoiceDate))}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Estado resultante</dt>
            <dd>
              <Badge variant="secondary">
                {PURCHASE_ORDER_STATUS_LABELS[response.status]}
              </Badge>
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Lotes creados</dt>
            <dd className="font-medium">{response.lots.length}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">
              Unidades recibidas
            </dt>
            <dd className="font-medium tabular-nums">{totalReceived}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Valor recibido</dt>
            <dd className="font-medium tabular-nums">
              {formatCurrencyBOB(totalValue)}
            </dd>
          </div>
        </dl>

        <div className="max-h-72 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-left">Lote</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {response.lots.map((lot) => (
                <tr key={lot.lotId}>
                  <td className="px-3 py-2">{lot.productName}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {lot.lotNumber}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {lot.qtyReceived}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrencyBOB(lot.unitCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onClose?.()
            }}
          >
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
