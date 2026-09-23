"use client"

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/shared/components/status-badge"
import type { Supplier } from "@/features/suppliers/types"

export interface SuppliersTableProps {
  data: Supplier[]
  selectedId?: string
  onSelect: (supplier: Supplier) => void
  onEdit: (supplier: Supplier) => void
  onToggleStatus: (supplier: Supplier) => void
}

export function SuppliersTable({
  data,
  selectedId,
  onSelect,
  onEdit,
  onToggleStatus,
}: SuppliersTableProps) {
  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "name",
      header: "Empresa",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "nit",
      header: "NIT",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.nit}
        </span>
      ),
    },
    {
      accessorKey: "contactPerson",
      header: "Contacto",
      cell: ({ row }) => row.original.contactPerson ?? "—",
    },
    {
      accessorKey: "phone",
      header: "Teléfono",
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      accessorKey: "city",
      header: "Ciudad",
      cell: ({ row }) => row.original.city ?? "—",
    },
    {
      accessorKey: "active",
      header: "Estado",
      cell: ({ row }) => (
        <StatusBadge
          active={row.original.active}
          activeLabel="Activo"
          inactiveLabel="Inactivo"
        />
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const supplier = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Open actions for ${supplier.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => onEdit(supplier)}>
                <Pencil aria-hidden="true" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onToggleStatus(supplier)}>
                {supplier.active ? (
                  <>
                    <PowerOff aria-hidden="true" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <Power aria-hidden="true" />
                    Activar
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
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
                Ningún proveedor coincide con los filtros.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const isSelected = row.original.id === selectedId
              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? "selected" : undefined}
                  onClick={() => onSelect(row.original)}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
