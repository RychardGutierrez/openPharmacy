"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  LoaderCircle,
  Printer,
  Send,
  Truck,
  UserCircle2,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrencyBOB } from "@/shared/utils/format"
import { useSupplierById } from "@/features/purchase-orders/api/use-supplier-by-id"
import {
  usePurchaseOrder,
  useSubmitPurchaseOrder,
} from "@/features/purchase-orders/api/use-purchase-orders"
import { PurchaseOrderStatusBadge } from "@/features/purchase-orders/components/purchase-order-status-badge"
import {
  PurchaseOrderStatusRail,
} from "@/features/purchase-orders/components/purchase-order-status-rail"
import { SubmitPurchaseOrderDialog } from "@/features/purchase-orders/components/submit-purchase-order-dialog"
import {
  RequesterInfoCard,
  SupplierInfoCard,
} from "@/features/purchase-orders/components/supplier-info-card"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderStatus,
} from "@/features/purchase-orders/types"

const DATE_FORMAT = new Intl.DateTimeFormat("es-BO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const DATETIME_FORMAT = new Intl.DateTimeFormat("es-BO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  PHARMACIST: "Farmacéutico",
  CASHIER: "Cajero",
}

function formatRole(role: string | undefined): string {
  if (!role) return "—"
  return ROLE_LABELS[role] ?? role
}

export interface PurchaseOrderDetailProps {
  orderId: string
}

export function PurchaseOrderDetail({ orderId }: PurchaseOrderDetailProps) {
  const [submitOpen, setSubmitOpen] = useState(false)
  const query = usePurchaseOrder(orderId)
  const submit = useSubmitPurchaseOrder()
  const supplierQuery = useSupplierById(query.data?.supplierId)

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (query.error || !query.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar la orden</AlertTitle>
        <AlertDescription>{query.error?.message ?? "Inténtalo de nuevo."}</AlertDescription>
      </Alert>
    )
  }

  const order = query.data
  const total = order.items.reduce(
    (sum, item) => sum + item.qtyOrdered * item.unitCost,
    0,
  )
  const received = order.items.reduce((sum, item) => sum + item.qtyReceived, 0)
  const ordered = order.items.reduce((sum, item) => sum + item.qtyOrdered, 0)
  const editable = order.status === "PENDING"
  const receivable =
    order.status === "ORDERED" || order.status === "PARTIAL"

  const handleSubmit = async () => {
    await submit.mutateAsync(order.id)
    setSubmitOpen(false)
  }

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" className="size-9">
            <Link href="/purchasing/orders" aria-label="Volver al listado">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Orden a {order.supplierName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {DATE_FORMAT.format(new Date(order.orderDate))} · creada el{" "}
              {DATE_FORMAT.format(new Date(order.createdAt))}
            </p>
          </div>
        </div>
        <PurchaseOrderStatusRail status={order.status} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <PurchaseOrderStatusBadge status={order.status} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handlePrint}>
            <Printer className="size-4" aria-hidden="true" />
            Imprimir
          </Button>
          {editable ? (
            <Button asChild variant="outline">
              <Link href={`/purchasing/orders/${order.id}/edit`}>
                Editar borrador
              </Link>
            </Button>
          ) : null}
          {editable ? (
            <Button onClick={() => setSubmitOpen(true)}>
              <Send className="size-4" aria-hidden="true" />
              Enviar al proveedor
            </Button>
          ) : null}
          {receivable ? (
            <Button asChild>
              <Link href={`/purchasing/orders/${order.id}/receive`}>
                <Truck className="size-4" aria-hidden="true" />
                Recibir mercancía
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <article className="print-letter print-report flex flex-col gap-6 bg-card p-6 ring-1 ring-foreground/10 sm:p-8 print:ring-0">
        <header className="flex flex-col gap-2 border-b border-foreground/20 pb-4 print:border-b-2 print:border-black">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Orden de compra
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {order.supplierName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
            <span>
              <strong className="font-medium text-foreground">Fecha:</strong>{" "}
              {DATE_FORMAT.format(new Date(order.orderDate))}
            </span>
            <span>
              <strong className="font-medium text-foreground">Estado:</strong>{" "}
              {PURCHASE_ORDER_STATUS_LABELS[order.status as PurchaseOrderStatus]}
            </span>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
          <SupplierInfoCard
            supplier={supplierQuery.data}
            loading={supplierQuery.isLoading}
          />
          <RequesterInfoCard
            requesterName={order.userName}
            requesterRole={formatRole(order.userRole)}
            createdAt={order.createdAt}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-muted-foreground print:text-foreground">
            <ClipboardList className="size-4" aria-hidden="true" />
            Detalle de la orden
          </h2>
          <div className="rounded-lg border bg-card print:border-black">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Pedido</TableHead>
                  <TableHead className="text-right">Recibido</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.qtyOrdered}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.qtyReceived}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.max(0, item.qtyOrdered - item.qtyReceived)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBOB(item.unitCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBOB(item.qtyOrdered * item.unitCost)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-medium">
                    Total estimado
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrencyBOB(total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3 print:hidden">
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{order.items.length}</p>
            </CardContent>
          </Card>
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Unidades pedidas / recibidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {received} / {ordered}
              </p>
            </CardContent>
          </Card>
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Total estimado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrencyBOB(total)}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="hidden grid-cols-2 gap-8 border-t border-foreground/20 pt-6 print:grid print:border-t-2 print:border-black">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Firma Proveedor por
            </p>
            <div className="mt-12 border-b border-foreground/60 print:border-black" />
            <p className="mt-1 text-sm text-foreground">
              {supplierQuery.data?.contactPerson ?? supplierQuery.data?.name ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Proveedor · {DATETIME_FORMAT.format(new Date())}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Firma del solicitante
            </p>
            <div className="mt-12 border-b border-foreground/60 print:border-black" />
            <p className="mt-1 text-sm text-foreground">
              {order.userName || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRole(order.userRole)}
            </p>
          </div>
        </section>

        <footer className="hidden flex-col gap-1 border-t border-foreground/20 pt-3 text-xs text-muted-foreground print:flex">
          <p>
            Documento generado por OpenPharmacy el{" "}
            {DATETIME_FORMAT.format(new Date(order.createdAt))}
          </p>
          <p>
            Esta orden debe firmarse y archivarse según las políticas de
            compras de la farmacia.
          </p>
        </footer>
      </article>

      <SubmitPurchaseOrderDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        supplierName={order.supplierName}
        orderDate={order.orderDate}
        itemCount={order.items.length}
        totalEstimate={total}
        isPending={submit.isPending}
        onConfirm={handleSubmit}
      />

      {submit.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Enviando la orden…
        </div>
      ) : null}
    </div>
  )
}