"use client"

import { useState } from "react"
import { LoaderCircle, Trash2 } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { formatCurrencyBOB } from "@/shared/utils/format"
import type { ReturnableSale } from "@/features/returns/types"

export interface CancelSaleDialogProps {
  sale: ReturnableSale
  disabled?: boolean
  isPending: boolean
  onConfirm: (reason: string) => void
}

export function CancelSaleDialog({
  sale,
  disabled = false,
  isPending,
  onConfirm,
}: CancelSaleDialogProps) {
  const [reason, setReason] = useState("")
  const [open, setOpen] = useState(false)

  const canConfirm = reason.trim().length >= 3 && !isPending

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Cancelar venta
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar venta</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción devuelve todo el stock de la venta {sale.receiptNumber}{" "}
            ({formatCurrencyBOB(sale.total)}). No se puede cancelar una venta
            que ya tenga devoluciones parciales.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 py-2">
          <label htmlFor="cancel-reason" className="text-sm font-medium">
            Motivo de cancelación
          </label>
          <Textarea
            id="cancel-reason"
            placeholder="Ej. Venta duplicada registrada por error"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason("")}>
            Cerrar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              if (!canConfirm) return
              onConfirm(reason)
              setOpen(false)
              setReason("")
            }}
            disabled={!canConfirm}
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                <span>Cancelando…</span>
              </>
            ) : (
              "Confirmar cancelación"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
