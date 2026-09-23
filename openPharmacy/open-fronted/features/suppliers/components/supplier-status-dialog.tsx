"use client"

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
import type { Supplier } from "@/features/suppliers/types"

export interface SupplierStatusDialogProps {
  supplier: Supplier | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (supplier: Supplier) => void
  isPending?: boolean
}

export function SupplierStatusDialog({
  supplier,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: SupplierStatusDialogProps) {
  if (!supplier) return null
  const isActive = supplier.active

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? "Desactivar proveedor" : "Activar proveedor"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `Desactivar a ${supplier.name} lo ocultará del selector de órdenes de compra. Las órdenes históricas seguirán vinculadas a este proveedor.`
              : `Activar a ${supplier.name} lo hará disponible nuevamente para las órdenes de compra.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm(supplier)
            }}
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                <span>Procesando…</span>
              </>
            ) : (
              <span>{isActive ? "Desactivar" : "Activar"}</span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
