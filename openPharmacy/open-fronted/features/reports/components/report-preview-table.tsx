"use client"

import { FileSearch } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReportPreview } from "@/features/reports/types"

const LABELS: Record<string, string> = {
  day: "Fecha",
  date: "Fecha / hora",
  transactions: "Transacciones",
  revenue: "Ingresos brutos",
  discounts: "Descuentos",
  net: "Total",
  cashier: "Cajero",
  paymentMethod: "Pago",
  product: "Producto",
  lot: "Lote",
  quantity: "Cantidad",
  unitPrice: "Precio unitario",
  lineTotal: "Total línea",
  movementType: "Tipo",
  user: "Usuario",
  reason: "Motivo",
  category: "Categoría",
  expiryDate: "Vencimiento",
  daysUntilExpiry: "Días restantes",
  status: "Estado",
  valuation: "Valorización",
  unitCost: "Costo unitario",
  order: "Orden",
  supplier: "Proveedor",
  requestedBy: "Solicitado por",
  lines: "Líneas",
  orderedQty: "Cantidad",
  orderedValue: "Valor ordenado",
  source: "Origen",
  receipt: "Recibo",
  lineCount: "Líneas",
  totalQty: "Cantidad",
}

function formatCell(value: unknown, format?: string): string {
  if (value === null || value === undefined || value === "") return "—"
  if (format === "money") return new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
  if (format === "number") return new Intl.NumberFormat("es-BO").format(Number(value))
  return String(value)
}

export function ReportPreviewTable({
  preview,
  isLoading,
}: {
  preview?: ReportPreview
  isLoading: boolean
}) {
  if (isLoading) {
    return <div className="flex flex-col gap-2" aria-label="Cargando vista previa"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
  }

  if (!preview || preview.rows.length === 0) {
    return <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground"><FileSearch className="size-6" aria-hidden="true" /><span>No hay datos para los filtros seleccionados.</span></div>
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {preview.columns.map((column) => <TableHead key={column.key}>{LABELS[column.key] ?? column.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.rows.map((row, index) => (
            <TableRow key={index}>
              {preview.columns.map((column) => <TableCell key={column.key} className={column.format === "money" || column.format === "number" ? "tabular-nums text-right" : undefined}>{formatCell(row[column.key], column.format)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
