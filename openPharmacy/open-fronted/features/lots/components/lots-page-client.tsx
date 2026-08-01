"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LotsTable } from "@/features/lots/components/lots-table"
import { LotsFilters } from "@/features/lots/components/lots-filters"
import { LotsPagination } from "@/features/lots/components/lots-pagination"
import { LotFormDialog } from "@/features/lots/components/lot-form-dialog"
import { LotVoidDialog } from "@/features/lots/components/lot-void-dialog"
import { LotTraceDialog } from "@/features/lots/components/lot-trace-dialog"
import { useLots } from "@/features/lots/api/use-lots"
import {
  classifyExpiry,
  type Lot,
  type LotsFiltersValue,
} from "@/features/lots/types"

const PAGE_SIZE = 20

function getDaysUntil(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
}

export function LotsPageClient() {
  const [filters, setFilters] = useState<LotsFiltersValue>({
    q: "",
    status: undefined,
  })
  const [page, setPage] = useState(1)
  const [, startTransition] = useTransition()
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [traceDialogOpen, setTraceDialogOpen] = useState(false)
  const [traceLotNumber, setTraceLotNumber] = useState<string>("")

  const { data, isLoading, error } = useLots({
    page,
    pageSize: PAGE_SIZE,
    q: filters.q,
  })

  const handleFiltersChange = (next: LotsFiltersValue) => {
    startTransition(() => {
      setFilters(next)
      setPage(1)
    })
  }

  const filteredLots =
    data?.data.filter((lot) => {
      if (!filters.status) return true
      return classifyExpiry(getDaysUntil(lot.expiryDate)) === filters.status
    }) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lotes</h1>
          <p className="text-sm text-muted-foreground">
            Todos los lotes del inventario.
          </p>
        </div>
        <LotFormDialog
          mode="create"
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => setSelectedLot(null)}
        >
          <Button className="gap-1" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            <span>Nuevo lote</span>
          </Button>
        </LotFormDialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <LotsFilters value={filters} onChange={handleFiltersChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Lotes {data ? `(${filteredLots.length})` : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando lotes…</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              {error.message || "No se pudieron cargar los lotes."}
            </p>
          ) : (
            <>
              <LotsTable
                data={filteredLots}
                showProduct
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
              <LotsPagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

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
