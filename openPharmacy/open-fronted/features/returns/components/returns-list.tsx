"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrencyBOB } from "@/shared/utils/format"
import {
  RETURN_SOURCE_LABELS,
  RETURN_TYPE_LABELS,
  type ReturnListResponse,
} from "@/features/returns/types"

export interface ReturnsListProps {
  response: ReturnListResponse
  page: number
  onPageChange: (page: number) => void
}

export function ReturnsList({ response, page, onPageChange }: ReturnsListProps) {
  const { data, total, totalPages } = response

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Historial de devoluciones y cancelaciones</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay devoluciones ni cancelaciones registradas.
          </p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Venta</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Líneas</TableHead>
                    <TableHead className="text-right">Reembolso</TableHead>
                    <TableHead>Realizado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.createdAt).toLocaleString("es-BO")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.source === "CANCELLATION"
                              ? "destructive"
                              : "default"
                          }
                        >
                          {RETURN_SOURCE_LABELS[item.source]}
                        </Badge>
                        {item.returnType === "PARTIAL" && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {RETURN_TYPE_LABELS[item.returnType]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{item.receiptNumber}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {item.reason}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.itemCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyBOB(item.totalRefund)}
                      </TableCell>
                      <TableCell>{item.userName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {data.length} de {total} registros · Página {page} de{" "}
                {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Siguiente
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
