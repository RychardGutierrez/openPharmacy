"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileUp, Plus, Tags } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { useSinSummary } from "@/features/products/api/use-product-sin"
import { ProductBulkImportDialog } from "@/features/products/components/product-bulk-import-dialog"
import { ProductDeactivateDialog } from "@/features/products/components/product-deactivate-dialog"
import { ProductSinBulkDialog } from "@/features/products/components/product-sin-bulk-dialog"
import { ProductSinDefaultsDialog } from "@/features/products/components/product-sin-defaults-dialog"
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
    sinPending: false,
  })
  const [page, setPage] = useState(1)
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sinBulkOpen, setSinBulkOpen] = useState(false)

  const { data, isLoading, isFetching, error } = useProducts({
    page,
    pageSize: PAGE_SIZE,
    q: filters.q || undefined,
    category: filters.category,
    active: filters.status,
    sinPending: filters.sinPending || undefined,
  })
  const sinSummary = useSinSummary()

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

  const onToggleSelect = (product: Product) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(product.id)) next.delete(product.id)
      else next.add(product.id)
      return next
    })
  }

  const onToggleAll = (products: Product[], checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const product of products) {
        if (checked) next.add(product.id)
        else next.delete(product.id)
      }
      return next
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
          <ProductSinDefaultsDialog>
            <Button variant="outline" className="gap-1">
              <Tags aria-hidden="true" />
              Códigos SIN por categoría
            </Button>
          </ProductSinDefaultsDialog>
          <Button onClick={onNew} className="gap-1">
            <Plus aria-hidden="true" />
            Nuevo producto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
          <CardDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {isLoading || isFetching
                ? "Cargando productos…"
                : `${data?.total ?? 0} producto${data?.total === 1 ? "" : "s"}`}
            </span>
            {sinSummary.data ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant={sinSummary.data.pending > 0 ? "outline" : "secondary"}>
                  Pendientes de códigos SIN: {sinSummary.data.pending} de {sinSummary.data.total}
                </Badge>
                {sinSummary.data.invalid > 0 ? (
                  <Badge variant="destructive">
                    Códigos SIN no vigentes: {sinSummary.data.invalid}
                  </Badge>
                ) : null}
                {sinSummary.data.invalidDefaults > 0 ? (
                  <Badge variant="destructive">
                    Valores por categoría no vigentes: {sinSummary.data.invalidDefaults}
                  </Badge>
                ) : null}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ProductsFilters
            value={filters}
            onChange={(next) => {
              setFilters(next)
              setPage(1)
              setSelectedIds(new Set())
            }}
          />

          {selectedIds.size > 0 ? (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">
                {selectedIds.size} producto{selectedIds.size === 1 ? "" : "s"} seleccionado
                {selectedIds.size === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Quitar selección
                </Button>
                <Button size="sm" onClick={() => setSinBulkOpen(true)}>
                  Asignar códigos SIN
                </Button>
              </div>
            </div>
          ) : null}

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
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onToggleAll={onToggleAll}
            />
          )}

          <ProductsPagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={(next) => {
              setPage(next)
              setSelectedIds(new Set())
            }}
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

      <ProductSinBulkDialog
        open={sinBulkOpen}
        onOpenChange={setSinBulkOpen}
        selectedIds={[...selectedIds]}
        onDone={() => setSelectedIds(new Set())}
      />
    </div>
  )
}
