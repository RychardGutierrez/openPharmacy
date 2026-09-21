"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSuppliers } from "@/features/purchase-orders/api/use-purchase-orders"
import type { Supplier } from "@/features/purchase-orders/types"

export function SuppliersPageClient() {
  const query = useSuppliers()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de proveedores registrados para órdenes de compra.
        </p>
      </header>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-32 w-full" />
          ))}
        </div>
      ) : query.data && query.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((supplier: Supplier) => (
            <Card key={supplier.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{supplier.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  NIT {supplier.nit}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
                {supplier.city ? <span>Ciudad: {supplier.city}</span> : null}
                {supplier.contactPerson ? (
                  <span>Contacto: {supplier.contactPerson}</span>
                ) : null}
                {supplier.email ? <span>Email: {supplier.email}</span> : null}
                {supplier.phone ? <span>Tel: {supplier.phone}</span> : null}
                {supplier.paymentTerms ? (
                  <span>Condiciones: {supplier.paymentTerms}</span>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No hay proveedores activos.
        </div>
      )}
    </div>
  )
}
