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
import { RoleBadge } from "@/shared/components/role-badge"
import { StatusBadge } from "@/shared/components/status-badge"
import { getUserStatus, type User } from "@/features/users/types"

export interface UsersTableProps {
  data: User[]
  onEdit: (user: User) => void
  onToggleStatus: (user: User) => void
}

export function UsersTable({ data, onEdit, onToggleStatus }: UsersTableProps) {
  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "fullName",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.fullName}</span>
      ),
    },
    {
      accessorKey: "ci",
      header: "CI",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.ci}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={getUserStatus(row.original.active)} />
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const user = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Open actions for ${user.fullName}`}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => onEdit(user)}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onToggleStatus(user)}>
                {user.active ? (
                  <>
                    <PowerOff aria-hidden="true" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Power aria-hidden="true" />
                    Activate
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
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                No users match your filters.
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
