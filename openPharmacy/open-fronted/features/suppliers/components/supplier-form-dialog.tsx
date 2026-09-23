"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SupplierForm } from "@/features/suppliers/components/supplier-form"
import type { Supplier, SupplierFormValues } from "@/features/suppliers/types"

export interface SupplierFormDialogProps {
  supplier: Supplier | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: SupplierFormValues) => Promise<void> | void
  isPending?: boolean
  serverError?: { field?: string; message: string } | null
}

export function SupplierFormDialog({
  supplier,
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
  serverError,
}: SupplierFormDialogProps) {
  const isEditing = Boolean(supplier)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Actualiza la información del proveedor."
              : "Agrega un nuevo proveedor al catálogo."}
          </DialogDescription>
        </DialogHeader>
        <SupplierForm
          defaultValues={supplier ?? undefined}
          onSubmit={onSubmit}
          submitLabel={isEditing ? "Guardar cambios" : "Crear proveedor"}
          isPending={isPending}
          serverError={serverError}
        />
      </DialogContent>
    </Dialog>
  )
}
