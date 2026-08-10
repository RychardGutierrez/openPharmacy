"use client"

import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUpdateProductPrice } from "@/features/products/api/use-update-product-price"
import { formatCurrencyBOB, parseDecimalInput } from "@/shared/utils/format"
import type { Product } from "@/features/products/types"

export interface UpdatePriceDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestedSalePrice?: number | null
  onSuccess?: () => void
}

export function UpdatePriceDialog({
  product,
  open,
  onOpenChange,
  suggestedSalePrice,
  onSuccess,
}: UpdatePriceDialogProps) {
  const mutation = useUpdateProductPrice()
  const [salePrice, setSalePrice] = useState<number>(
    suggestedSalePrice ?? product?.salePrice ?? 0,
  )
  const [reason, setReason] = useState("")

  if (!product) return null

  const belowFloor = salePrice < product.minSalePrice
  const marginPct =
    salePrice > 0 && product.minSalePrice > 0
      ? Math.round(((salePrice - product.minSalePrice) / salePrice) * 100)
      : null

  const handleSubmit = async () => {
    if (belowFloor || reason.trim().length < 3 || !product) return
    await mutation.mutateAsync({
      id: product.id,
      values: { salePrice, reason: reason.trim() },
    })
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar precio de venta</DialogTitle>
          <DialogDescription>
            {product.commercialName} ({product.dciName})
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Precio actual</p>
              <p className="font-medium">
                {formatCurrencyBOB(product.salePrice)}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">Precio mínimo</p>
              <p className="font-medium">
                {formatCurrencyBOB(product.minSalePrice)}
              </p>
            </div>
          </div>

          {suggestedSalePrice ? (
            <p className="rounded border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
              Sugerencia para mantener margen:{" "}
              <span className="font-medium text-foreground">
                {formatCurrencyBOB(suggestedSalePrice)}
              </span>
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="sale-price">Nuevo precio (Bs)</Label>
            <Input
              id="sale-price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={salePrice}
              onChange={(event) =>
                setSalePrice(parseDecimalInput(event.target.value))
              }
            />
            {belowFloor ? (
              <p className="text-xs text-destructive">
                No puede ser menor a {formatCurrencyBOB(product.minSalePrice)}.
              </p>
            ) : null}
            {marginPct !== null && !belowFloor ? (
              <p className="text-xs text-muted-foreground">
                Margen sobre precio mínimo: {marginPct}%
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="price-reason">Razón del cambio</Label>
            <Input
              id="price-reason"
              placeholder="Ej. Incremento de costo del proveedor"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {reason.trim().length > 0 && reason.trim().length < 3 ? (
              <p className="text-xs text-destructive">
                Escribe al menos 3 caracteres.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={belowFloor || reason.trim().length < 3 || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                <span>Guardando…</span>
              </>
            ) : (
              <span>Actualizar precio</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
