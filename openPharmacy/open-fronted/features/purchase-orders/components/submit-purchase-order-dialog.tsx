"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { formatCurrencyBOB } from "@/shared/utils/format"

export interface SubmitPurchaseOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierName: string
  orderDate: string
  itemCount: number
  totalEstimate: number
  isPending?: boolean
  onConfirm: () => void
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-BO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function SubmitPurchaseOrderDialog({
  open,
  onOpenChange,
  supplierName,
  orderDate,
  itemCount,
  totalEstimate,
  isPending = false,
  onConfirm,
}: SubmitPurchaseOrderDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <span className="hidden" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar orden a proveedor</AlertDialogTitle>
          <AlertDialogDescription>
            La orden quedará bloqueada para edición y será visible para el
            proveedor. Confirma los datos antes de continuar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Proveedor</dt>
            <dd className="font-medium">{supplierName}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Fecha</dt>
            <dd className="font-medium">
              {DATE_FORMAT.format(new Date(orderDate))}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Productos</dt>
            <dd className="font-medium">{itemCount}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Total estimado</dt>
            <dd className="font-medium tabular-nums">
              {formatCurrencyBOB(totalEstimate)}
            </dd>
          </div>
        </dl>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                onConfirm()
              }}
            >
              {isPending ? "Enviando…" : "Enviar orden"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
