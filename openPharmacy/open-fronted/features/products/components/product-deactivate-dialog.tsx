"use client"

import { LoaderCircle, Power, PowerOff } from "lucide-react"

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
import type { Product } from "@/features/products/types"

export interface ProductDeactivateDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (product: Product) => void
  isPending?: boolean
}

/**
 * Confirmation dialog for toggling a product's active status (soft delete).
 * Keeps the product in history so it remains visible in the catalog list.
 */
export function ProductDeactivateDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: ProductDeactivateDialogProps) {
  if (!product) return null
  const isActive = product.active

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? "Desactivar producto" : "Reactivar producto"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `${product.commercialName} quedará inactivo. No podrá venderse, pero permanecerá en el historial.`
              : `${product.commercialName} volverá a estar disponible para la venta.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm(product)
            }}
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                <span>Procesando…</span>
              </>
            ) : (
              <>
                {isActive ? (
                  <PowerOff aria-hidden="true" />
                ) : (
                  <Power aria-hidden="true" />
                )}
                <span>{isActive ? "Desactivar" : "Reactivar"}</span>
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
