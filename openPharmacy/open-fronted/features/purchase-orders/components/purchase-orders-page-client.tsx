"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  usePurchaseOrders,
  useSuppliers,
} from "@/features/purchase-orders/api/use-purchase-orders"
import { PurchaseOrderFilters } from "@/features/purchase-orders/components/purchase-order-filters"
import { PurchaseOrderKpiGrid } from "@/features/purchase-orders/components/purchase-order-kpi-grid"
import { PurchaseOrdersTable } from "@/features/purchase-orders/components/purchase-orders-table"
import type { PurchaseOrderFiltersValue } from "@/features/purchase-orders/types"

const PAGE_SIZE = 10

export function PurchaseOrdersPageClient() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<PurchaseOrderFiltersValue>({})

  const suppliersQuery = useSuppliers()
  const ordersQuery = usePurchaseOrders(filters, page, PAGE_SIZE)

  const onNew = () => router.push("/purchasing/orders/new")
  const onSelect = (order: { id: string }) =>
    router.push(`/purchasing/orders/${order.id}`)

  const isLoading = ordersQuery.isLoading || ordersQuery.isFetching
  const data = ordersQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Órdenes de compra
          </h1>
          <p className="text-sm text-muted-foreground">
            Crea, envía y recibe órdenes de compra a proveedores.
          </p>
        </div>
        <Button onClick={onNew} className="sm:w-auto">
          <Plus aria-hidden="true" />
          Nueva orden
        </Button>
      </header>

      <PurchaseOrderKpiGrid orders={data} />

      <PurchaseOrderFilters
        value={filters}
        onChange={(next) => {
          setFilters(next)
          setPage(1)
        }}
        suppliers={suppliersQuery.data ?? []}
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <PurchaseOrdersTable data={data} onSelect={onSelect} />
      )}

      {ordersQuery.data ? (
        <Pagination className="mt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  if (ordersQuery.data.page > 1) setPage(ordersQuery.data.page - 1)
                }}
                aria-disabled={ordersQuery.data.page <= 1}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {ordersQuery.data.page}
              </PaginationLink>
            </PaginationItem>
            {ordersQuery.data.totalPages > 1 ? (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            ) : null}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  if (ordersQuery.data.page < ordersQuery.data.totalPages) {
                    setPage(ordersQuery.data.page + 1)
                  }
                }}
                aria-disabled={
                  ordersQuery.data.page >= ordersQuery.data.totalPages
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
