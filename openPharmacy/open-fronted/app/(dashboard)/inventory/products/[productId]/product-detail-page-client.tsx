"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Edit,
  Package,
  Pill,
  Power,
  PowerOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useActivateProduct } from "@/features/products/api/use-activate-product"
import { useDeactivateProduct } from "@/features/products/api/use-deactivate-product"
import { useProduct } from "@/features/products/api/use-product"
import { ProductCategoryBadge } from "@/features/products/components/product-category-badge"
import { ProductDeactivateDialog } from "@/features/products/components/product-deactivate-dialog"
import {
  isControlledCategory,
  COMPLIANCE_WARNING_TEXT,
  type Product,
} from "@/features/products/types"
import { StatusBadge } from "@/shared/components/status-badge"
import { formatCurrencyBOB } from "@/shared/utils/format"

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export function ProductDetailPageClient({ id }: { id: string }) {
  const router = useRouter()
  const { data: product, isLoading, error } = useProduct(id)
  const [dialogOpen, setDialogOpen] = useState(false)

  const deactivate = useDeactivateProduct()
  const activate = useActivateProduct()

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando producto…</p>
  }

  if (error || !product) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-destructive">No se pudo cargar el producto.</p>
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

  const onConfirmToggle = (target: Product) => {
    const mutation = target.active ? deactivate : activate
    mutation.mutate(target.id, {
      onSettled: () => {
        setDialogOpen(false)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 sm:items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            aria-label="Volver"
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {product.commercialName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {product.dciName} ·{" "}
              <span className="font-mono text-xs">{product.barcode}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={product.active ? "outline" : "default"}
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-1"
          >
            {product.active ? (
              <>
                <PowerOff aria-hidden="true" />
                Desactivar
              </>
            ) : (
              <>
                <Power aria-hidden="true" />
                Reactivar
              </>
            )}
          </Button>
          <Button asChild size="sm" className="gap-1">
            <Link href={`/inventory/products/${id}/edit`}>
              <Edit aria-hidden="true" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4" aria-hidden="true" />
              Información general
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Nombre DCI" value={product.dciName} />
            <DetailItem label="Nombre comercial" value={product.commercialName} />
            <DetailItem
              label="Laboratorio"
              value={product.laboratory || "—"}
            />
            <DetailItem
              label="Forma farmacéutica"
              value={product.form || "—"}
            />
            <DetailItem label="Concentración" value={product.concentration || "—"} />
            <DetailItem
              label="Categoría"
              value={
                <ProductCategoryBadge category={product.category} />
              }
            />
            <DetailItem label="Estado" value={<StatusBadge active={product.active} />} />
            <DetailItem
              label="Código de barras"
              value={
                <span className="font-mono text-xs">{product.barcode}</span>
              }
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="size-4" aria-hidden="true" />
                Precios y stock
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <DetailItem
                label="Precio de venta"
                value={formatCurrencyBOB(product.salePrice)}
              />
              <DetailItem
                label="Precio de costo"
                value={formatCurrencyBOB(product.costPrice)}
              />
              <Separator />
              <DetailItem label="Stock mínimo" value={product.minStock} />
            </CardContent>
          </Card>

          {isControlledCategory(product.category) ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive">SEDES</CardTitle>
                <CardDescription className="text-destructive/80">
                  {COMPLIANCE_WARNING_TEXT}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="size-4" aria-hidden="true" />
                Lotes
              </CardTitle>
              <CardDescription>
                Revisa el inventario por lote para este producto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full gap-1">
                <Link href={`/inventory/products/${id}/lots`}>
                  Ver lotes
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ProductDeactivateDialog
        product={product}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={onConfirmToggle}
        isPending={deactivate.isPending || activate.isPending}
      />
    </div>
  )
}
