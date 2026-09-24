"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AdjustmentForm } from "@/features/inventory-movements/components/adjustment-form"
import { useCreateAdjustment } from "@/features/inventory-movements/api/use-create-adjustment"
import type { CreateAdjustmentFormValues } from "@/features/inventory-movements/types"

export function NewAdjustmentDialog() {
  const [open, setOpen] = useState(false)
  const createAdjustment = useCreateAdjustment()

  const handleSubmit = (values: CreateAdjustmentFormValues) => {
    createAdjustment.mutate(values, {
      onSuccess: () => {
        setOpen(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Nuevo ajuste
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar ajuste</DialogTitle>
          <DialogDescription>
            Envía un ajuste manual de stock. Un administrador debe aprobarlo
            antes de que el inventario cambie.
          </DialogDescription>
        </DialogHeader>
        <AdjustmentForm onSubmit={handleSubmit} isPending={createAdjustment.isPending} />
      </DialogContent>
    </Dialog>
  )
}
