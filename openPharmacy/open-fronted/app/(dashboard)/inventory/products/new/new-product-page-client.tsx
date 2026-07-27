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
import { useCreateProduct } from "@/features/products/api/use-create-product"
import { ProductForm } from "@/features/products/components/product-form"
import type { ProductFormValues } from "@/features/products/types"

export function NewProductPageClient() {
  const router = useRouter()
  const create = useCreateProduct()

  const onSubmit = async (values: ProductFormValues) => {
    await create.mutateAsync(values)
    router.push("/inventory/products")
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
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
          <p className="text-sm text-muted-foreground">
            Registra un producto en el catálogo.
          </p>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Detalles</CardTitle>
          <CardDescription>
            Todos los campos son obligatorios salvo los marcados como opcionales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm
            onSubmit={onSubmit}
            submitLabel="Crear producto"
            isPending={create.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
