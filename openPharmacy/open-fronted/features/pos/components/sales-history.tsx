"use client"

import { ChevronLeft, ChevronRight, LoaderCircle, PrinterIcon } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useMySales } from "@/features/pos/api/use-sale"
import { formatReceiptMoney } from "@/features/pos/lib/receipt-format"
import type { SaleReceipt } from "@/features/pos/types"

function getToday(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function SalesHistory({ onReprint }: { onReprint: (sale: SaleReceipt) => void }) {
  const [page, setPage] = useState(1)
  const [fromDate, setFromDate] = useState(getToday)
  const [toDate, setToDate] = useState(getToday)
  const invalidRange = fromDate > toDate
  const { data, isLoading, isError, isFetching } = useMySales(page, fromDate, toDate, !invalidRange)

  function updateFromDate(value: string) {
    setFromDate(value)
    setPage(1)
  }

  function updateToDate(value: string) {
    setToDate(value)
    setPage(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de mis ventas</CardTitle>
        <CardDescription>Revisa y vuelve a imprimir tus últimos comprobantes.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Desde
            <input type="date" value={fromDate} onChange={(event) => updateFromDate(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Hasta
            <input type="date" value={toDate} onChange={(event) => updateToDate(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        </div>
        {invalidRange ? (
          <p className="text-sm text-destructive">La fecha inicial debe ser anterior o igual a la fecha final.</p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Cargando ventas...
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">No se pudo cargar el historial de ventas.</p>
        ) : data?.data.length ? (
          <div className="divide-y rounded-lg border">
            {data.data.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium">Comprobante #{sale.receiptNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sale.createdAt).toLocaleString("es-BO")} · {formatReceiptMoney(sale.total)}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => onReprint(sale)}>
                  <PrinterIcon aria-hidden="true" /> Reimprimir
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay ventas en el rango seleccionado.</p>
        )}
        {data && data.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" disabled={page === 1 || isFetching} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft aria-hidden="true" /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Página {data.page} de {data.totalPages}</span>
            <Button type="button" variant="outline" size="sm" disabled={page >= data.totalPages || isFetching} onClick={() => setPage((current) => current + 1)}>
              Siguiente <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
