"use client"

import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useVoidLot } from "@/features/lots/api/use-void-lot"
import type { Lot } from "@/features/lots/types"

export interface LotVoidDialogProps {
  lot: Lot | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function LotVoidDialog({
  lot,
  open,
  onOpenChange,
  onSuccess,
}: LotVoidDialogProps) {
  const [reason, setReason] = useState("")
  const voidMutation = useVoidLot()
  const isPending = voidMutation.isPending

  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault()
    if (!lot) return
    await voidMutation.mutateAsync({ id: lot.id, reason })
    setReason("")
    onOpenChange(false)
    onSuccess?.()
  }

  const canSubmit = reason.trim().length >= 5

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anular lote</AlertDialogTitle>
          <AlertDialogDescription>
            {lot
              ? `El lote ${lot.lotNumber} quedará anulado. Solo se puede anular un lote sin stock y sin movimientos.`
              : "Selecciona un lote para anular."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="void-reason">Razón de anulación</Label>
          <Textarea
            id="void-reason"
            placeholder="Ej. Lote creado por error"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isPending || !lot}
            className="min-h-20"
          />
          <p className="text-xs text-muted-foreground">
            Mínimo 5 caracteres. {reason.trim().length}/5
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || !lot || !canSubmit}
            onClick={handleConfirm}
          >
            {isPending ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                <span>Anulando…</span>
              </>
            ) : (
              <span>Anular lote</span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
