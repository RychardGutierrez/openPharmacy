"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  useActivateSupplier,
  useCreateSupplier,
  useDeactivateSupplier,
  useSupplier,
  useSuppliers,
  useUpdateSupplier,
} from "@/features/suppliers/api/use-suppliers"
import { SupplierDetailPanel } from "@/features/suppliers/components/supplier-detail-panel"
import { SupplierEmptyPanel } from "@/features/suppliers/components/supplier-empty-panel"
import { SupplierFormDialog } from "@/features/suppliers/components/supplier-form-dialog"
import { SupplierStatusDialog } from "@/features/suppliers/components/supplier-status-dialog"
import { SuppliersFilters } from "@/features/suppliers/components/suppliers-filters"
import { SuppliersPagination } from "@/features/suppliers/components/suppliers-pagination"
import { SuppliersTable } from "@/features/suppliers/components/suppliers-table"
import {
  type Supplier,
  type SupplierFormValues,
  type SuppliersFiltersValue,
} from "@/features/suppliers/types"
import { SUPPLIER_ERROR_MESSAGES, type SupplierErrorCode } from "@/features/suppliers/api/suppliers-api"

const PAGE_SIZE = 10

function getActiveFilter(status: SuppliersFiltersValue["status"]): boolean | undefined {
  if (status === "ACTIVE") return true
  if (status === "INACTIVE") return false
  return undefined
}

export function SuppliersPageClient() {
  const [filters, setFilters] = useState<SuppliersFiltersValue>({
    q: "",
    status: "ALL",
  })
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [formSupplier, setFormSupplier] = useState<Supplier | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [statusSupplier, setStatusSupplier] = useState<Supplier | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [serverError, setServerError] = useState<{ field?: string; message: string } | null>(null)

  const query = useSuppliers({
    page,
    pageSize: PAGE_SIZE,
    q: filters.q || undefined,
    active: getActiveFilter(filters.status),
  })

  const selectedQuery = useSupplier(selectedId)

  const create = useCreateSupplier()
  const update = useUpdateSupplier()
  const deactivate = useDeactivateSupplier()
  const activate = useActivateSupplier()

  const onFiltersChange = (next: SuppliersFiltersValue) => {
    setFilters(next)
    setPage(1)
  }

  const onSelect = (supplier: Supplier) => {
    setSelectedId(supplier.id)
  }

  const onNew = () => {
    setFormSupplier(null)
    setServerError(null)
    setFormOpen(true)
  }

  const onEdit = (supplier: Supplier) => {
    setFormSupplier(supplier)
    setServerError(null)
    setFormOpen(true)
  }

  const onToggleStatus = (supplier: Supplier) => {
    setStatusSupplier(supplier)
    setStatusOpen(true)
  }

  const onSubmitForm = async (values: SupplierFormValues) => {
    setServerError(null)
    try {
      if (formSupplier) {
        await update.mutateAsync({ id: formSupplier.id, values })
      } else {
        const created = await create.mutateAsync(values)
        setSelectedId(created.id)
      }
      setFormOpen(false)
      setFormSupplier(null)
    } catch (error) {
      const err = error as { status?: number; code?: SupplierErrorCode; message?: string }
      if (err?.code === "DUPLICATE_NIT") {
        setServerError({ field: "nit", message: err.message || SUPPLIER_ERROR_MESSAGES.DUPLICATE_NIT })
      } else {
        setServerError({ message: err?.message || SUPPLIER_ERROR_MESSAGES.GENERIC })
      }
    }
  }

  const onConfirmStatus = (supplier: Supplier) => {
    const mutation = supplier.active ? deactivate : activate
    mutation.mutate(supplier.id, {
      onSettled: () => {
        setStatusOpen(false)
        setStatusSupplier(null)
      },
    })
  }

  const selectedSupplier = selectedQuery.data ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            Administra proveedores y revisa órdenes de compra recientes.
          </p>
        </div>
        <Button onClick={onNew} className="sm:w-auto">
          <Plus aria-hidden="true" />
          Nuevo proveedor
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Catálogo de proveedores</CardTitle>
            <CardDescription>
              {query.isLoading || query.isFetching
                ? "Cargando proveedores…"
                : `${query.data?.total ?? 0} proveedor${query.data?.total === 1 ? "" : "es"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SuppliersFilters value={filters} onChange={onFiltersChange} />

            {query.error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                No se pudieron cargar los proveedores. Inténtalo de nuevo.
              </p>
            ) : (
              <SuppliersTable
                data={query.data?.data ?? []}
                selectedId={selectedId}
                onSelect={onSelect}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
              />
            )}

            <SuppliersPagination
              page={query.data?.page ?? 1}
              totalPages={query.data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-1">
          {selectedSupplier ? (
            <SupplierDetailPanel
              supplier={selectedSupplier}
              onEdit={() => onEdit(selectedSupplier)}
              onToggleStatus={() => onToggleStatus(selectedSupplier)}
              isPending={deactivate.isPending || activate.isPending}
            />
          ) : (
            <SupplierEmptyPanel />
          )}
        </div>
      </div>

      <SupplierFormDialog
        supplier={formSupplier}
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setServerError(null)
            setFormSupplier(null)
          }
          setFormOpen(open)
        }}
        onSubmit={onSubmitForm}
        isPending={create.isPending || update.isPending}
        serverError={serverError}
      />

      <SupplierStatusDialog
        supplier={statusSupplier}
        open={statusOpen}
        onOpenChange={(open) => {
          if (!open) setStatusSupplier(null)
          setStatusOpen(open)
        }}
        onConfirm={onConfirmStatus}
        isPending={deactivate.isPending || activate.isPending}
      />
    </div>
  )
}
