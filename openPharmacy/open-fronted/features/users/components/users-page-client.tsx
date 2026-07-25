"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useUsers } from "@/features/users/api/use-users"
import { useDeactivateUser } from "@/features/users/api/use-deactivate-user"
import { useActivateUser } from "@/features/users/api/use-activate-user"
import { UserDeactivateDialog } from "@/features/users/components/user-deactivate-dialog"
import {
  UsersFilters,
  type UsersFiltersValue,
} from "@/features/users/components/users-filters"
import { UsersPagination } from "@/features/users/components/users-pagination"
import { UsersTable } from "@/features/users/components/users-table"
import type { User } from "@/features/users/types"

const PAGE_SIZE = 10

export function UsersPageClient() {
  const router = useRouter()
  const [filters, setFilters] = useState<UsersFiltersValue>({
    q: "",
    role: undefined,
    status: undefined,
  })
  const [page, setPage] = useState(1)
  const [dialogUser, setDialogUser] = useState<User | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading, isFetching, error } = useUsers({
    page,
    pageSize: PAGE_SIZE,
    q: filters.q || undefined,
    role: filters.role,
    active: filters.status,
  })

  const deactivate = useDeactivateUser()
  const activate = useActivateUser()

  const onToggleStatus = (user: User) => {
    setDialogUser(user)
    setDialogOpen(true)
  }

  const onConfirmToggle = (user: User) => {
    const mutation = user.active ? deactivate : activate
    mutation.mutate(user.id, {
      onSettled: () => {
        setDialogOpen(false)
        setDialogUser(null)
      },
    })
  }

  const onEdit = (user: User) => {
    router.push(`/users/${user.id}/edit`)
  }

  const onNew = () => {
    router.push("/users/new")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage system users and their roles.
          </p>
        </div>
        <Button onClick={onNew} className="sm:w-auto">
          <Plus aria-hidden="true" />
          New user
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {isLoading || isFetching
              ? "Loading users…"
              : `${data?.total ?? 0} user${data?.total === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <UsersFilters
            value={filters}
            onChange={(next) => {
              setFilters(next)
              setPage(1)
            }}
          />

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Could not load users. Try again.
            </p>
          ) : (
            <UsersTable
              data={data?.data ?? []}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
            />
          )}

          <UsersPagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <UserDeactivateDialog
        user={dialogUser}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={onConfirmToggle}
        isPending={deactivate.isPending || activate.isPending}
      />
    </div>
  )
}
