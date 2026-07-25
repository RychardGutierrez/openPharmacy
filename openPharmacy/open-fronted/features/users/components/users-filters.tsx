"use client"

import { useEffect, useState } from "react"
import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { USER_ROLES, type UserRole } from "@/features/auth/types"
import { USER_ROLE_LABELS } from "@/features/users/types"
import { useDebounce } from "@/shared/hooks/use-debounce"

const ALL = "ALL"

export interface UsersFiltersValue {
  q: string
  role: UserRole | undefined
  status: boolean | undefined
}

export interface UsersFiltersProps {
  value: UsersFiltersValue
  onChange: (value: UsersFiltersValue) => void
}

export function UsersFilters({ value, onChange }: UsersFiltersProps) {
  const [search, setSearch] = useState(value.q)
  const debouncedSearch = useDebounce(search, 300)

  // Push debounced search into the parent query.
  useEffect(() => {
    if (debouncedSearch !== value.q) {
      onChange({ ...value, q: debouncedSearch })
    }
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by name, CI or email"
          className="pl-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <Select
        value={value.role ?? ALL}
        onValueChange={(next) =>
          onChange({
            ...value,
            role: next === ALL ? undefined : (next as UserRole),
          })
        }
      >
        <SelectTrigger className="sm:w-48">
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All roles</SelectItem>
          {USER_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.status === undefined ? ALL : value.status ? "active" : "inactive"}
        onValueChange={(next) =>
          onChange({
            ...value,
            status: next === ALL ? undefined : next === "active",
          })
        }
      >
        <SelectTrigger className="sm:w-48">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
