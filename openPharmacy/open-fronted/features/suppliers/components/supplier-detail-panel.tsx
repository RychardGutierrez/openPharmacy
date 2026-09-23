"use client"

import { LoaderCircle, Power, PowerOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/shared/components/status-badge"
import { useSupplierRecentOrders } from "@/features/suppliers/api/use-supplier-recent-orders"
import { PURCHASE_ORDER_STATUS_LABELS } from "@/features/purchase-orders/types"
import type { Supplier } from "@/features/suppliers/types"

export interface SupplierDetailPanelProps {
  supplier: Supplier
  onEdit: () => void
  onToggleStatus: () => void
  isPending?: boolean
}

export function SupplierDetailPanel({
  supplier,
  onEdit,
  onToggleStatus,
  isPending = false,
}: SupplierDetailPanelProps) {
  const recentOrders = useSupplierRecentOrders(supplier.id)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="truncate text-lg">{supplier.name}</CardTitle>
              <CardDescription className="font-mono text-xs">
                NIT {supplier.nit}
              </CardDescription>
            </div>
            <StatusBadge
              active={supplier.active}
              activeLabel="Activo"
              inactiveLabel="Inactivo"
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <DetailRow label="Dirección" value={supplier.address} />
            <DetailRow label="Ciudad" value={supplier.city} />
            <DetailRow label="Persona de contacto" value={supplier.contactPerson} />
            <DetailRow label="Teléfono" value={supplier.phone} />
            <DetailRow label="Correo electrónico" value={supplier.email} />
            <DetailRow label="Condiciones de pago" value={supplier.paymentTerms} />
          </dl>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={onEdit} disabled={isPending}>
              Editar proveedor
            </Button>
            <Button
              variant={supplier.active ? "destructive" : "default"}
              onClick={onToggleStatus}
              disabled={isPending}
            >
              {isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : supplier.active ? (
                <PowerOff className="size-4" aria-hidden="true" />
              ) : (
                <Power className="size-4" aria-hidden="true" />
              )}
              {supplier.active ? "Desactivar" : "Activar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Órdenes recientes</CardTitle>
          <CardDescription>
            Últimas órdenes de compra y resumen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentOrders.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : recentOrders.error ? (
            <p className="text-sm text-muted-foreground">
              No se pudieron cargar las órdenes recientes.
            </p>
          ) : (
            <RecentOrdersContent orders={recentOrders.data?.data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium break-words">{value || "—"}</dd>
    </div>
  )
}

function RecentOrdersContent({
  orders,
}: {
  orders: Array<{
    id: string
    status: keyof typeof PURCHASE_ORDER_STATUS_LABELS
    orderDate: string
    items: Array<{ qtyOrdered: number; unitCost: number }>
  }>
}) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay órdenes de compra para este proveedor.
      </p>
    )
  }

  const totalOrders = orders.length
  const latest = orders[0]
  const latestTotal = latest.items.reduce(
    (sum, item) => sum + item.qtyOrdered * item.unitCost,
    0,
  )
  const statusCounts = orders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const formatter = new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
  })
  const dateFormatter = new Intl.DateTimeFormat("es-BO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Total de órdenes
          </dt>
          <dd className="mt-1 text-2xl font-semibold">{totalOrders}</dd>
        </div>
        <div className="rounded-md border p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Última orden
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {dateFormatter.format(new Date(latest.orderDate))}
          </dd>
          <dd className="text-xs text-muted-foreground">
            {PURCHASE_ORDER_STATUS_LABELS[latest.status]}
          </dd>
        </div>
        <div className="rounded-md border p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Total de la última
          </dt>
          <dd className="mt-1 text-lg font-semibold">
            {formatter.format(latestTotal)}
          </dd>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <span
            key={status}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
          >
            {PURCHASE_ORDER_STATUS_LABELS[status as keyof typeof PURCHASE_ORDER_STATUS_LABELS]}
            <span className="font-semibold">{count}</span>
          </span>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {orders.slice(0, 3).map((order) => {
          const orderTotal = order.items.reduce(
            (sum, item) => sum + item.qtyOrdered * item.unitCost,
            0,
          )
          return (
            <li
              key={order.id}
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {dateFormatter.format(new Date(order.orderDate))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {PURCHASE_ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
              <span className="font-semibold">{formatter.format(orderTotal)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
