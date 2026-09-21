"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, AlertTriangle, LoaderCircle, Truck } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DatePicker } from "@/features/purchase-orders/components/date-picker"
import { ReceivingSuccessDialog } from "@/features/purchase-orders/components/receiving-success-dialog"
import {
  usePurchaseOrder,
  useReceivePurchaseOrder,
} from "@/features/purchase-orders/api/use-purchase-orders"
import { formatCurrencyBOB } from "@/shared/utils/format"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrder,
  type ReceivingResponse,
} from "@/features/purchase-orders/types"

interface ReceivingLine {
  orderItemId: string
  productName: string
  qtyOrdered: number
  qtyReceived: number
  qtyNow: string
  lotNumber: string
  expiryDate: string | undefined
  unitCost: string
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function seedLines(order: PurchaseOrder): ReceivingLine[] {
  return order.items
    .filter((item) => item.qtyReceived < item.qtyOrdered)
    .map((item) => ({
      orderItemId: item.id,
      productName: item.productName,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      qtyNow: "",
      lotNumber: "",
      expiryDate: undefined,
      unitCost: item.unitCost.toString(),
    }))
}

export interface ReceivePurchaseOrderPageClientProps {
  orderId: string
}

export function ReceivePurchaseOrderPageClient({
  orderId,
}: ReceivePurchaseOrderPageClientProps) {
  const router = useRouter()
  const query = usePurchaseOrder(orderId)
  const receive = useReceivePurchaseOrder()
  const order = query.data
  const [lines, setLines] = useState<ReceivingLine[]>(() =>
    order ? seedLines(order) : [],
  )
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [success, setSuccess] = useState<ReceivingResponse | null>(null)

  const receivableStatus = order
    ? order.status === "ORDERED" || order.status === "PARTIAL"
    : false

  // If the user lands on /receive for an order that can no longer be received
  // (already RECEIVED, still PENDING, or CANCELLED) we redirect them back to
  // the detail page instead of showing a dead-end alert.
  useEffect(() => {
    if (!order) return
    if (receivableStatus) return
    router.replace(`/purchasing/orders/${orderId}`)
  }, [order, receivableStatus, orderId, router])

  // Same redirect once every pending line has already been received.
  const allLinesReceived = order
    ? order.items.every((item) => item.qtyReceived >= item.qtyOrdered)
    : false
  useEffect(() => {
    if (!order || query.isLoading) return
    if (!allLinesReceived) return
    if (success !== null) return
    router.replace(`/purchasing/orders/${orderId}`)
  }, [order, query.isLoading, allLinesReceived, success, orderId, router])

  const updateLine = (orderItemId: string, patch: Partial<ReceivingLine>) =>
    setLines((prev) =>
      prev.map((line) =>
        line.orderItemId === orderItemId ? { ...line, ...patch } : line,
      ),
    )

  const parseQty = (raw: string): number => {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
  }

  const parseCost = (raw: string): number => {
    if (!raw) return 0
    const parsed = Number(raw.replace(",", "."))
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
  }

  const issues = useMemo(() => {
    return lines.map((line) => {
      const remaining = line.qtyOrdered - line.qtyReceived
      const qty = parseQty(line.qtyNow)
      const errors: string[] = []
      if (qty < 0) errors.push("Cantidad inválida")
      if (qty > remaining) errors.push("Excede el pendiente")
      if (qty > 0 && line.lotNumber.trim().length === 0)
        errors.push("Falta número de lote")
      if (qty > 0 && !line.expiryDate)
        errors.push("Falta fecha de vencimiento")
      if (line.expiryDate && new Date(line.expiryDate) < new Date(todayIso()))
        errors.push("La fecha está en el pasado")
      if (qty > 0 && parseCost(line.unitCost) <= 0)
        errors.push("Costo unitario requerido")
      return { orderItemId: line.orderItemId, errors, qty }
    })
  }, [lines])

  const isInvoiceValid = invoiceNumber.trim().length > 0 && invoiceDate.length > 0
  const receivingAny = issues.some((entry) => entry.qty > 0)
  const hasBlockingIssues = issues.some((entry) => entry.qty > 0 && entry.errors.length > 0)
  const canConfirm = isInvoiceValid && receivingAny && !hasBlockingIssues

  const projectedStatus = useMemo(() => {
    if (!order) return "ORDERED" as const
    const total = order.items.reduce((sum, item) => sum + item.qtyOrdered, 0)
    const previouslyReceived = order.items.reduce(
      (sum, item) => sum + item.qtyReceived,
      0,
    )
    const additional = issues.reduce((sum, entry) => sum + entry.qty, 0)
    const projected = previouslyReceived + additional
    if (projected >= total) return "RECEIVED" as const
    if (projected > 0) return "PARTIAL" as const
    return order.status === "PARTIAL"
      ? ("PARTIAL" as const)
      : ("ORDERED" as const)
  }, [issues, order])

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (query.error || !order) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar la orden</AlertTitle>
        <AlertDescription>
          {query.error?.message ?? "Inténtalo de nuevo."}
        </AlertDescription>
      </Alert>
    )
  }

  if (!receivableStatus) {
    return (
      <div
        className="flex items-center gap-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Redirigiendo al detalle de la orden…
      </div>
    )
  }

  if (lines.length === 0 && !success) {
    return (
      <div
        className="flex items-center gap-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Redirigiendo al detalle de la orden…
      </div>
    )
  }

  const handleConfirm = async () => {
    const payload = {
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      items: issues
        .filter((entry) => entry.qty > 0)
        .map((entry) => {
          const line = lines.find((l) => l.orderItemId === entry.orderItemId)!
          return {
            orderItemId: line.orderItemId,
            qtyReceived: entry.qty,
            lotNumber: line.lotNumber.trim(),
            expiryDate: line.expiryDate!,
            unitCost: parseCost(line.unitCost),
          }
        }),
    }
    const response = await receive.mutateAsync({
      id: orderId,
      payload,
    })
    setSuccess(response)
  }

  const allLinesComplete = order.items.every(
    (item) => item.qtyReceived + parseQty(
      lines.find((l) => l.orderItemId === item.id)?.qtyNow ?? "0",
    ) >= item.qtyOrdered,
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon-sm" className="size-9">
            <Link href={`/purchasing/orders/${orderId}`} aria-label="Volver">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Recepción de mercancía
            </h1>
            <p className="text-sm text-muted-foreground">
              Orden a {order.supplierName}
            </p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Datos de la factura</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="invoice-number"
              className="text-sm font-medium leading-none"
            >
              Número de factura
            </label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              placeholder="Ej. INV-2026-0001"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="invoice-date"
              className="text-sm font-medium leading-none"
            >
              Fecha de factura
            </label>
            <DatePicker
              id="invoice-date"
              value={invoiceDate}
              onChange={(next) => setInvoiceDate(next ?? todayIso())}
              required
              maxDate={new Date()}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Progreso de recepción</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Estado resultante
            </span>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {PURCHASE_ORDER_STATUS_LABELS[projectedStatus]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {issues.reduce((sum, entry) => sum + entry.qty, 0)} unidades a recibir en esta factura.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {lines.map((line) => {
          const remaining = line.qtyOrdered - line.qtyReceived
          const qty = parseQty(line.qtyNow)
          const errors =
            issues.find((entry) => entry.orderItemId === line.orderItemId)
              ?.errors ?? []
          const showPartialWarning =
            qty > 0 && qty < remaining && errors.length === 0
          return (
            <Card
              key={line.orderItemId}
              className={
                errors.length > 0 && qty > 0 ? "border-destructive/40" : undefined
              }
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{line.productName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Pendiente: {remaining} · Recibido: {line.qtyReceived} /
                    Pedido: {line.qtyOrdered}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-4">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-muted-foreground">
                    Cantidad a recibir
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={remaining}
                    value={line.qtyNow}
                    onChange={(event) =>
                      updateLine(line.orderItemId, { qtyNow: event.target.value })
                    }
                    aria-invalid={errors.some((e) => e.includes("Cantidad") || e.includes("Excede"))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-muted-foreground">
                    Número de lote
                  </span>
                  <Input
                    value={line.lotNumber}
                    onChange={(event) =>
                      updateLine(line.orderItemId, {
                        lotNumber: event.target.value,
                      })
                    }
                    aria-invalid={errors.some((e) => e.includes("lote"))}
                    disabled={qty <= 0}
                    placeholder="Ej. L-2026-001"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-muted-foreground">
                    Fecha de vencimiento
                  </span>
                  <DatePicker
                    value={line.expiryDate}
                    onChange={(next) =>
                      updateLine(line.orderItemId, { expiryDate: next })
                    }
                    disabled={qty <= 0}
                    minDate={new Date()}
                    ariaInvalid={errors.some((e) =>
                      e.includes("vencimiento") || e.includes("pasado"),
                    )}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-muted-foreground">
                    Costo unitario (BOB)
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step={0.01}
                    value={line.unitCost}
                    onChange={(event) =>
                      updateLine(line.orderItemId, { unitCost: event.target.value })
                    }
                    aria-invalid={errors.some((e) => e.includes("Costo"))}
                  />
                </label>
              </CardContent>
              {qty > 0 && errors.length > 0 ? (
                <div className="px-6 pb-4">
                  <p className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    {errors.join(" · ")}
                  </p>
                </div>
              ) : null}
              {showPartialWarning ? (
                <div className="px-6 pb-4">
                  <p className="text-sm text-muted-foreground">
                    Quedan {remaining - qty} unidades abiertas en esta línea.
                  </p>
                </div>
              ) : null}
              {qty > 0 ? (
                <div className="px-6 pb-4 text-right text-xs text-muted-foreground">
                  Subtotal recibido:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCurrencyBOB(qty * parseCost(line.unitCost))}
                  </span>
                </div>
              ) : null}
            </Card>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild variant="outline">
          <Link href={`/purchasing/orders/${orderId}`}>Cancelar</Link>
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || receive.isPending || !receivingAny}
        >
          {receive.isPending ? (
            <>
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              Procesando…
            </>
          ) : (
            <>
              <Truck className="size-4" aria-hidden="true" />
              Confirmar recepción
            </>
          )}
        </Button>
      </div>

      <ReceivingSuccessDialog
        open={success !== null}
        onOpenChange={(open) => {
          if (!open) setSuccess(null)
        }}
        response={success}
        onClose={() => {
          if (allLinesComplete) {
            router.push(`/purchasing/orders/${orderId}`)
          } else {
            router.push(`/purchasing/orders/${orderId}`)
          }
        }}
      />
    </div>
  )
}
