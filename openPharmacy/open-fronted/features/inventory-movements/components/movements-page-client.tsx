"use client"

import { useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useInventoryMovements } from "@/features/inventory-movements/api/use-inventory-movements"
import { useAdjustments } from "@/features/inventory-movements/api/use-adjustments"
import { MovementsFilters } from "@/features/inventory-movements/components/movements-filters"
import { MovementsTable } from "@/features/inventory-movements/components/movements-table"
import { NewAdjustmentDialog } from "@/features/inventory-movements/components/new-adjustment-dialog"
import { PendingApprovalsCard } from "@/features/inventory-movements/components/pending-approvals-card"
import { UsersPagination } from "@/features/users/components/users-pagination"
import type {
  MovementType,
  MovementsFiltersValue,
} from "@/features/inventory-movements/types"

const PAGE_SIZE = 20

function useMovementsFilters(): {
  filters: MovementsFiltersValue
  page: number
  setFilters: (filters: MovementsFiltersValue) => void
  setPage: (page: number) => void
} {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters = useMemo<MovementsFiltersValue>(() => {
    return {
      productId: searchParams.get("productId") || undefined,
      lotId: searchParams.get("lotId") || undefined,
      movementType:
        (searchParams.get("movementType") as MovementType | null) || undefined,
      userId: searchParams.get("userId") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    }
  }, [searchParams])

  const page = useMemo(() => {
    const raw = searchParams.get("page")
    const parsed = raw ? Number(raw) : 1
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }, [searchParams])

  const buildUrl = useCallback(
    (nextFilters: MovementsFiltersValue, nextPage: number) => {
      const params = new URLSearchParams()
      if (nextFilters.productId) params.set("productId", nextFilters.productId)
      if (nextFilters.lotId) params.set("lotId", nextFilters.lotId)
      if (nextFilters.movementType)
        params.set("movementType", nextFilters.movementType)
      if (nextFilters.userId) params.set("userId", nextFilters.userId)
      if (nextFilters.from) params.set("from", nextFilters.from)
      if (nextFilters.to) params.set("to", nextFilters.to)
      if (nextPage > 1) params.set("page", String(nextPage))
      const qs = params.toString()
      return qs.length > 0 ? `?${qs}` : ""
    },
    [],
  )

  const setFilters = useCallback(
    (next: MovementsFiltersValue) => {
      router.push(`${window.location.pathname}${buildUrl(next, 1)}`)
    },
    [router, buildUrl],
  )

  const setPage = useCallback(
    (next: number) => {
      router.push(`${window.location.pathname}${buildUrl(filters, next)}`)
    },
    [router, buildUrl, filters],
  )

  return { filters, page, setFilters, setPage }
}

export function MovementsPageClient() {
  const { filters, page, setFilters, setPage } = useMovementsFilters()

  const { data, isLoading, isFetching, error } = useInventoryMovements({
    page,
    pageSize: PAGE_SIZE,
    ...filters,
  })

  const { data: pendingAdjustments } = useAdjustments({
    status: "PENDING",
    pageSize: 100,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            Registra movimientos de stock y gestiona ajustes.
          </p>
        </div>
        <NewAdjustmentDialog />
      </div>

      <PendingApprovalsCard
        adjustments={pendingAdjustments?.data ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle>Registro de inventario</CardTitle>
          <CardDescription>
            {isLoading || isFetching
              ? "Cargando movimientos…"
              : `${data?.total ?? 0} movimiento${data?.total === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <MovementsFilters value={filters} onChange={setFilters} />

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              No se pudieron cargar los movimientos. Intenta de nuevo.
            </p>
          ) : isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <MovementsTable data={data?.data ?? []} />
          )}

          <UsersPagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
