"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrencyBOB } from "@/shared/utils/format"
import type { Shift, ShiftCloseResponse, ShiftSales } from "@/features/shifts/types"

export function ZReportButton({ shift, cashierName, closeResult, sales }: {
  shift: Shift
  cashierName: string
  closeResult?: ShiftCloseResponse
  sales?: ShiftSales
}) {
  const printReport = () => {
    window.print()
  }
  const expected = closeResult?.expectedCash ?? sales?.expectedCash ?? shift.openingCash
  const counted = closeResult?.countedCash
  const difference = closeResult?.difference
  return (
    <>
      <Button type="button" variant="outline" onClick={printReport} className="gap-2">
        <Printer className="size-4" aria-hidden="true" />
        Imprimir Z-Report
      </Button>
      <section className="print-report hidden" aria-hidden="true">
        <h1>OPEN PHARMACY</h1>
        <h2>REPORTE DE CIERRE DE TURNO</h2>
        <p>Cajero: {cashierName}</p>
        <p>Turno: {new Date(shift.openedAt).toLocaleString("es-BO")} - {shift.closedAt ? new Date(shift.closedAt).toLocaleString("es-BO") : "abierto"}</p>
        <hr />
        <h2>PRODUCTOS VENDIDOS (por cantidad)</h2>
        {sales?.products.map((product) => <p key={product.productId}>{product.name} | {product.quantity} | {formatCurrencyBOB(product.total)}</p>)}
        <p>Total unidades: {sales?.totals.units ?? 0}</p>
        <p>Productos distintos: {sales?.totals.distinctProducts ?? 0}</p>
        <hr />
        <h2>RESUMEN DE VENTAS</h2>
        <p>Transacciones: {sales?.totals.transactions ?? 0}</p>
        <p>Ventas brutas: {formatCurrencyBOB(sales?.totals.grossSales ?? 0)}</p>
        <p>Descuentos: -{formatCurrencyBOB(sales?.totals.discounts ?? 0)}</p>
        <p>Devoluciones: -{formatCurrencyBOB(sales?.totals.returns ?? 0)}</p>
        <p>Ventas netas: {formatCurrencyBOB(sales?.totals.netSales ?? 0)}</p>
        <hr />
        <h2>DESGLOSE POR MÉTODO DE PAGO</h2>
        <p>Efectivo: {formatCurrencyBOB(sales?.payments.CASH ?? 0)}</p>
        <p>Tarjeta: {formatCurrencyBOB(sales?.payments.CARD ?? 0)}</p>
        <p>QR: {formatCurrencyBOB(sales?.payments.QR ?? 0)}</p>
        <p>Transferencia: {formatCurrencyBOB(sales?.payments.TRANSFER ?? 0)}</p>
        <p>Mixto: {formatCurrencyBOB(sales?.payments.MIXED ?? 0)}</p>
        <hr />
        <h2>RECONCILIACIÓN DE EFECTIVO</h2>
        <p>Apertura: {formatCurrencyBOB(shift.openingCash)}</p>
        <p>Efectivo esperado: {formatCurrencyBOB(expected)}</p>
        {counted !== undefined ? <p>Efectivo contado: {formatCurrencyBOB(counted)}</p> : null}
        {difference !== undefined ? <p>Diferencia: {formatCurrencyBOB(difference)}</p> : null}
      </section>
    </>
  )
}
