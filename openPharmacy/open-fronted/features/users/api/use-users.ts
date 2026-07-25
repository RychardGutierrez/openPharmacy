"use client"

import { useQuery } from "@tanstack/react-query"
import { listUsers, type UsersListQuery } from "@/features/users/api/users-api"

export const usersKeys = {
  all: ["users"] as const,
  list: (query: UsersListQuery) => [...usersKeys.all, "list", query] as const,
  detail: (id: string) => [...usersKeys.all, "detail", id] as const,
}

export function useUsers(query: UsersListQuery = {}) {
  return useQuery({
    queryKey: usersKeys.list(query),
    queryFn: () => listUsers(query),
  })
}
