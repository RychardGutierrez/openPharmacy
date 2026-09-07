"use client"

import { useState } from "react"

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
import { Label } from "@/components/ui/label"
import type { CartLine } from "@/features/pos/types"

interface PrescriptionGateDialogProps {
  open: boolean
  pendingLines: CartLine[]
  onConfirm: (productIds: string[]) => void
  onCancel: () => void
}

export function PrescriptionGateDialog({
  open,
  pendingLines,
  onConfirm,
  onCancel,
}: PrescriptionGateDialogProps) {
  const [acked, setAcked] = useState<string[]>([])

  function toggle(productId: string) {
    setAcked((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    )
  }

  function handleConfirm() {
    onConfirm(acked)
    setAcked([])
  }

  function handleCancel() {
    setAcked([])
    onCancel()
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Productos con receta</AlertDialogTitle>
          <AlertDialogDescription>
            El carrito incluye productos de venta bajo receta. Confirma cada
            producto para continuar con el cobro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-2">
          {pendingLines.map((line) => (
            <li
              key={line.productId}
              className="flex items-center gap-2 rounded-lg border p-2.5"
            >
              <input
                type="checkbox"
                id={`rx-ack-${line.productId}`}
                checked={acked.includes(line.productId)}
                onChange={() => toggle(line.productId)}
                className="size-4 accent-primary"
              />
              <Label
                htmlFor={`rx-ack-${line.productId}`}
                className="flex-1 cursor-pointer text-sm font-normal"
              >
                <span className="block font-semibold">
                  {line.commercialName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {line.dciName} · {line.quantity} u
                </span>
              </Label>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Volver
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={acked.length !== pendingLines.length}
            onClick={handleConfirm}
          >
            Receta verificada, continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
