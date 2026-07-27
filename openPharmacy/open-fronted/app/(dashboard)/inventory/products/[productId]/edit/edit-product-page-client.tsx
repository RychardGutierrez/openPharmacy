"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useProduct } from "@/features/products/api/use-product"
import { useUpdateProduct } from "@/features/products/api/use-update-product"
import { ProductForm } from "@/features/products/components/product-form"
import type { ProductFormValues } from "@/features/products/types"

export function EditProductPageClient({ id }: { id: string }) {
  const router = useRouter()
  const { data: product, isLoading, error } = useProduct(id)
  const update = useUpdateProduct()

  const onSubmit = async (values: ProductFormValues) => {
    await update.mutateAsync({ id, values })
    router.push(`/inventory/products/${id}`)
  }

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

  const defaults: Partial<ProductFormValues> = {
    dciName: product.dciName,
    commercialName: product.commercialName,
    laboratory: product.laboratory ?? undefined,
    form: product.form ?? undefined,
    concentration: product.concentration ?? undefined,
    barcode: product.barcode,
    category: product.category,
    salePrice: product.salePrice,
    costPrice: product.costPrice,
    minStock: product.minStock,
  }

  return (
    <div className="flex flex-col gap-6">
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
          <h1 className="text-2xl font-semibold tracking-tight">Editar producto</h1>
          <p className="text-sm text-muted-foreground">
            Actualiza la información de {product.commercialName}.
          </p>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{product.commercialName}</CardTitle>
          <CardDescription>
            Los cambios se aplican inmediatamente al guardar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm
            defaultValues={defaults}
            currentBarcode={product.barcode}
            onSubmit={onSubmit}
            submitLabel="Guardar cambios"
            isPending={update.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
