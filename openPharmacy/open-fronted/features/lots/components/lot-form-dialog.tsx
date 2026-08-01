"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LotForm, buildLotFormDefaults } from "@/features/lots/components/lot-form"
import { useCreateLot } from "@/features/lots/api/use-create-lot"
import { useUpdateLot } from "@/features/lots/api/use-update-lot"
import type { Lot, LotFormValues } from "@/features/lots/types"

export interface LotFormDialogProps {
  mode?: "create" | "edit"
  productId?: string
  lot?: Lot
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
}

export function LotFormDialog({
  mode = "create",
  productId,
  lot,
  children,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: LotFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange ?? setInternalOpen : setInternalOpen

  const create = useCreateLot()
  const update = useUpdateLot()
  const isPending = create.isPending || update.isPending

  useEffect(() => {
    if (!open) {
      create.reset()
      update.reset()
    }
  }, [open, create, update])

  const handleSubmit = async (values: LotFormValues) => {
    if (mode === "edit" && lot) {
      await update.mutateAsync({
        id: lot.id,
        values: {
          lotNumber: values.lotNumber,
          expiryDate: values.expiryDate,
          reason: values.reason,
        },
      })
    } else {
      await create.mutateAsync(values)
    }
    setOpen(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar lote" : "Nuevo lote"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Corrige únicamente el número de lote o la fecha de vencimiento. Indica la razón."
              : "Registra un nuevo lote para este producto."}
          </DialogDescription>
        </DialogHeader>
        <LotForm
          mode={mode}
          productId={mode === "create" ? productId : lot?.productId}
          defaultValues={mode === "edit" ? buildLotFormDefaults(lot) : undefined}
          onSubmit={handleSubmit}
          submitLabel={mode === "edit" ? "Guardar cambios" : "Crear lote"}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  )
}
