"use client"

import { useState } from "react"
import { Package, SearchIcon, Tag } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLotTraceability } from "@/features/lots/api/use-lot-traceability"
import { useDebounce } from "@/shared/hooks/use-debounce"

export interface LotTraceDialogProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultLotNumber?: string
}

export function LotTraceDialog({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultLotNumber,
}: LotTraceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange ?? setInternalOpen : setInternalOpen

  const hasDefaultLot = Boolean(defaultLotNumber?.trim())
  const [search, setSearch] = useState(defaultLotNumber ?? "")
  const debouncedSearch = useDebounce(search, 300)
  const { data, isLoading, error } = useLotTraceability(debouncedSearch)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Trazabilidad de lote
            {hasDefaultLot ? (
              <Badge variant="secondary" className="font-mono">
                {defaultLotNumber}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {hasDefaultLot
              ? "Movimientos y ventas asociados a este lote."
              : "Busca un número de lote para ver sus movimientos y ventas asociadas."}
          </DialogDescription>
        </DialogHeader>

        {!hasDefaultLot ? (
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Buscar por número de lote"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-8"
            />
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando trazabilidad…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error.message || "No se pudo cargar la trazabilidad."}
          </p>
        ) : data ? (
          <div className="flex flex-col gap-4">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Package className="size-4 text-muted-foreground" />
                  <span>{data.product?.commercialName ?? data.product?.dciName ?? "Producto desconocido"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Tag className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Lote:</span>
                    <span className="font-mono font-medium">{data.lotNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Cantidad inicial:</span>
                    <span>{data.initialQty}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Cantidad actual:</span>
                    <span className="font-medium">{data.currentQty}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Vencimiento:</span>
                    <span>{new Date(data.expiryDate).toLocaleDateString("es-BO")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TraceSection
              title="Movimientos"
              empty="Sin movimientos registrados para este lote."
              columns={["Tipo", "Cantidad", "Razón", "Fecha", "Usuario"]}
              rows={data.movements.map((movement) => [
                movement.movementType,
                movement.quantity,
                movement.reason ?? "—",
                new Date(movement.createdAt).toLocaleDateString("es-BO"),
                movement.userFullName,
              ])}
            />

            <TraceSection
              title="Ventas"
              empty="Sin ventas registradas para este lote."
              columns={["Venta", "Cantidad", "Precio unitario", "Total", "Fecha"]}
              rows={data.saleItems.map((sale) => [
                sale.saleId,
                sale.quantity,
                sale.unitPrice,
                sale.lineTotal,
                new Date(sale.createdAt).toLocaleDateString("es-BO"),
              ])}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function TraceSection({
  title,
  empty,
  columns,
  rows,
}: {
  title: string
  empty: string
  columns: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="max-h-60 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={index}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
