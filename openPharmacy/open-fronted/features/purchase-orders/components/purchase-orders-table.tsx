"use client"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrencyBOB } from "@/shared/utils/format"
import type { PurchaseOrder } from "@/features/purchase-orders/types"
import { PurchaseOrderStatusBadge } from "@/features/purchase-orders/components/purchase-order-status-badge"

export interface PurchaseOrdersTableProps {
  data: PurchaseOrder[]
  onSelect: (order: PurchaseOrder) => void
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-BO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return DATE_FORMAT.format(date)
}

export function PurchaseOrdersTable({ data, onSelect }: PurchaseOrdersTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No se encontraron órdenes con los filtros actuales.
      </div>
    )
  }

  return (
    <>
      {/* Mobile layout */}
      <div className="grid gap-3 md:hidden">
        {data.map((order) => {
          const total = order.items.reduce(
            (sum, item) => sum + item.qtyOrdered * item.unitCost,
            0,
          )
          return (
            <article
              key={order.id}
              className="rounded-lg border bg-card p-4 shadow-sm"
              aria-label={`Orden ${order.supplierName}`}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">
                    {order.supplierName}
                  </p>
                  {order.supplierNit ? (
                    <p className="inline-flex w-fit items-center rounded bg-muted px-2 py-0.5 font-mono text-xs tracking-wide text-muted-foreground">
                      NIT {order.supplierNit}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(order.orderDate)}
                  </p>
                </div>
                <PurchaseOrderStatusBadge status={order.status} />
              </header>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Productos</dt>
                  <dd className="font-medium">{order.items.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total estimado</dt>
                  <dd className="font-medium">
                    {formatCurrencyBOB(total)}
                  </dd>
                </div>
              </dl>
              <footer className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSelect(order)}
                >
                  Ver detalle
                </Button>
              </footer>
            </article>
          )
        })}
      </div>

      {/* Desktop layout */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead className="w-40">NIT</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-center">Productos</TableHead>
              <TableHead className="text-right">Total estimado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((order) => {
              const total = order.items.reduce(
                (sum, item) => sum + item.qtyOrdered * item.unitCost,
                0,
              )
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.supplierName}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded border bg-muted px-2 py-0.5 font-mono text-xs tracking-wide text-muted-foreground">
                      {order.supplierNit || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(order.orderDate)}
                  </TableCell>
                  <TableCell className="text-center">
                    {order.items.length}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyBOB(total)}
                  </TableCell>
                  <TableCell>
                    <PurchaseOrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onSelect(order)}
                    >
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
