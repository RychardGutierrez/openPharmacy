"use client"

import { useState } from "react"
import { TrendingUp } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useProduct } from "@/features/products/api/use-product"
import { UpdatePriceDialog } from "@/features/products/components/update-price-dialog"
import { formatCurrencyBOB } from "@/shared/utils/format"
import type { MarginAlert } from "@/features/lots/types"

export interface MarginAlertDialogProps {
  alert: MarginAlert | null
  productId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onKeepPrice: () => void
}

export function MarginAlertDialog({
  alert,
  productId,
  open,
  onOpenChange,
  onKeepPrice,
}: MarginAlertDialogProps) {
  const { data: product } = useProduct(productId)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)

  if (!alert || !product) return null

  const handleUpdatePrice = () => {
    setPriceDialogOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-amber-500" aria-hidden="true" />
              Aumento en el costo del lote
            </DialogTitle>
            <DialogDescription>
              El nuevo lote tiene un costo mayor al del lote anterior. Revisa si
              conviene ajustar el precio de venta.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Costo lote anterior
                </p>
                <p className="font-medium">
                  {alert.previousUnitCost === null
                    ? "Sin referencia"
                    : formatCurrencyBOB(alert.previousUnitCost)}
                </p>
              </div>
              <div className="rounded border border-border p-3">
                <p className="text-xs text-muted-foreground">Costo nuevo lote</p>
                <p className="font-medium">
                  {formatCurrencyBOB(alert.newUnitCost)}
                </p>
              </div>
            </div>

            {alert.increasePct !== null ? (
              <p className="text-xs text-muted-foreground">
                Incremento:{" "}
                <span className="font-medium text-amber-600">
                  {alert.increasePct}%
                </span>
              </p>
            ) : null}

            <div className="rounded border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Precio de venta actual</p>
              <p className="font-medium">
                {formatCurrencyBOB(alert.currentSalePrice)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Margen actual: {alert.currentMarginPct}%
              </p>
              {alert.suggestedSalePrice ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sugerencia para mantener margen:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrencyBOB(alert.suggestedSalePrice)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onKeepPrice}>
              Mantener precio actual
            </Button>
            <Button onClick={handleUpdatePrice}>Actualizar precio</Button>
          </div>
        </DialogContent>
      </Dialog>

      {priceDialogOpen ? (
        <UpdatePriceDialog
          key={`margin-price-${priceDialogOpen}`}
          product={product}
          open={priceDialogOpen}
          onOpenChange={setPriceDialogOpen}
          suggestedSalePrice={alert.suggestedSalePrice}
          onSuccess={() => onOpenChange(false)}
        />
      ) : null}
    </>
  )
}
