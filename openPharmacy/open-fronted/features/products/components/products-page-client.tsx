"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileUp, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useActivateProduct } from "@/features/products/api/use-activate-product"
import { useDeactivateProduct } from "@/features/products/api/use-deactivate-product"
import { useProducts } from "@/features/products/api/use-products"
import { ProductBulkImportDialog } from "@/features/products/components/product-bulk-import-dialog"
import { ProductDeactivateDialog } from "@/features/products/components/product-deactivate-dialog"
import {
  ProductsFilters,
  type ProductsFiltersValue,
} from "@/features/products/components/products-filters"
import { ProductsPagination } from "@/features/products/components/products-pagination"
import { ProductsTable } from "@/features/products/components/products-table"
import type { Product } from "@/features/products/types"

const PAGE_SIZE = 20

export function ProductsPageClient() {
  const router = useRouter()
  const [filters, setFilters] = useState<ProductsFiltersValue>({
    q: "",
    category: undefined,
    status: undefined,
  })
  const [page, setPage] = useState(1)
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading, isFetching, error } = useProducts({
    page,
    pageSize: PAGE_SIZE,
    q: filters.q || undefined,
    category: filters.category,
    active: filters.status,
  })

  const deactivate = useDeactivateProduct()
  const activate = useActivateProduct()

  const onToggleStatus = (product: Product) => {
    setDialogProduct(product)
    setDialogOpen(true)
  }

  const onConfirmToggle = (product: Product) => {
    const mutation = product.active ? deactivate : activate
    mutation.mutate(product.id, {
      onSettled: () => {
        setDialogOpen(false)
        setDialogProduct(null)
      },
    })
  }

  const onEdit = (product: Product) => {
    router.push(`/inventory/products/${product.id}/edit`)
  }

  const onViewDetail = (product: Product) => {
    router.push(`/inventory/products/${product.id}`)
  }

  const onNew = () => {
    router.push("/inventory/products/new")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo farmacéutico, categorías y precios.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ProductBulkImportDialog>
            <Button variant="outline" className="gap-1">
              <FileUp aria-hidden="true" />
              Importar CSV
            </Button>
          </ProductBulkImportDialog>
          <Button onClick={onNew} className="gap-1">
            <Plus aria-hidden="true" />
            Nuevo producto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
          <CardDescription>
            {isLoading || isFetching
              ? "Cargando productos…"
              : `${data?.total ?? 0} producto${data?.total === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ProductsFilters
            value={filters}
            onChange={(next) => {
              setFilters(next)
              setPage(1)
            }}
          />

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              No se pudieron cargar los productos. Intenta nuevamente.
            </p>
          ) : (
            <ProductsTable
              data={data?.data ?? []}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              onViewDetail={onViewDetail}
            />
          )}

          <ProductsPagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <ProductDeactivateDialog
        product={dialogProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={onConfirmToggle}
        isPending={deactivate.isPending || activate.isPending}
      />
    </div>
  )
}
