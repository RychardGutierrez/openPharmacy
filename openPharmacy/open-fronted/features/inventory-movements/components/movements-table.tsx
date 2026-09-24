"use client"

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { format } from "date-fns"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MovementTypeBadge } from "@/features/inventory-movements/components/movement-type-badge"
import type { Movement } from "@/features/inventory-movements/types"

export interface MovementsTableProps {
  data: Movement[]
}

export function MovementsTable({ data }: MovementsTableProps) {
  const columns: ColumnDef<Movement>[] = [
    {
      accessorKey: "created_at",
      header: "Fecha / Hora",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {format(new Date(row.original.created_at), "dd/MM/yyyy HH:mm")}
        </span>
      ),
    },
    {
      accessorKey: "product",
      header: "Producto",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.product?.commercialName ?? row.original.product_id}
        </span>
      ),
    },
    {
      accessorKey: "lot",
      header: "Lote",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.lot?.lotNumber ?? row.original.lot_id}
        </span>
      ),
    },
    {
      accessorKey: "movementType",
      header: "Tipo",
      cell: ({ row }) => <MovementTypeBadge type={row.original.movementType} />,
    },
    {
      accessorKey: "quantity",
      header: "Cant.",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {row.original.quantity}
        </span>
      ),
    },
    {
      accessorKey: "user",
      header: "Usuario",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.user?.fullName ?? row.original.user_id}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: "Motivo",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {row.original.reason ?? "—"}
        </span>
      ),
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No hay movimientos que coincidan con los filtros.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
