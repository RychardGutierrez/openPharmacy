"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, ChevronLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useProduct } from "@/features/products/api/use-product"
import { useLotsByProduct } from "@/features/lots/api/use-lots-by-product"
import { LotsTable } from "@/features/lots/components/lots-table"
import { ExpiryBanner } from "@/features/lots/components/expiry-banner"
import { LotFormDialog } from "@/features/lots/components/lot-form-dialog"
import { LotVoidDialog } from "@/features/lots/components/lot-void-dialog"
import { LotTraceDialog } from "@/features/lots/components/lot-trace-dialog"
import type { Lot } from "@/features/lots/types"

export interface ProductLotsPageClientProps {
  productId: string
}

export function ProductLotsPageClient({
  productId,
}: ProductLotsPageClientProps) {
  const router = useRouter()
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [traceDialogOpen, setTraceDialogOpen] = useState(false)
  const [traceLotNumber, setTraceLotNumber] = useState<string>("")

  const { data: product, isLoading: isLoadingProduct } = useProduct(productId)
  const { data: lots, isLoading: isLoadingLots, error } = useLotsByProduct(productId)

  if (isLoadingProduct || isLoadingLots) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  if (error || !product) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-destructive">
          No se pudo cargar la información del producto.
        </p>
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => router.push("/inventory/products")}
        >
          Volver al catálogo
        </Button>
      </div>
    )
  }

  const activeLots = lots ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push(`/inventory/products/${productId}`)}
              aria-label="Volver al detalle"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Lotes del producto
              </h1>
              <p className="text-sm text-muted-foreground">
                {product.commercialName} · {product.dciName}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LotFormDialog
            mode="create"
            productId={productId}
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onSuccess={() => setSelectedLot(null)}
          >
            <Button
              className="gap-1"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Nuevo lote</span>
            </Button>
          </LotFormDialog>
        </div>
      </div>

      <ExpiryBanner lots={activeLots} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lotes</CardTitle>
          </CardHeader>
          <CardContent>
            <LotsTable
              data={activeLots}
              onEdit={(lot) => {
                setSelectedLot(lot)
                setEditDialogOpen(true)
              }}
              onVoid={(lot) => {
                setSelectedLot(lot)
                setVoidDialogOpen(true)
              }}
              onTrace={(lot) => {
                setSelectedLot(lot)
                setTraceLotNumber(lot.lotNumber)
                setTraceDialogOpen(true)
              }}
              onSelect={setSelectedLot}
              selectedLotId={selectedLot?.id ?? null}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stock total</span>
                <span className="font-medium">
                  {activeLots.reduce((sum, lot) => sum + lot.currentQty, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lotes activos</span>
                <span className="font-medium">
                  {activeLots.filter((lot) => !lot.voidedAt).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stock mínimo</span>
                <span className="font-medium">{product.minStock}</span>
              </div>
              <Separator />
              <Button
                variant="outline"
                className="w-full gap-1"
                onClick={() => router.push("/inventory/lotsExpiry")}
              >
                <CalendarClock className="size-4" aria-hidden="true" />
                <span>Ver vencimientos</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <LotFormDialog
        mode="edit"
        lot={selectedLot ?? undefined}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => setSelectedLot(null)}
      >
        <button type="button" className="hidden" />
      </LotFormDialog>

      <LotVoidDialog
        lot={selectedLot}
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        onSuccess={() => setSelectedLot(null)}
      />

      <LotTraceDialog
        key={traceLotNumber}
        open={traceDialogOpen}
        onOpenChange={setTraceDialogOpen}
        defaultLotNumber={traceLotNumber}
      />
    </div>
  )
}
