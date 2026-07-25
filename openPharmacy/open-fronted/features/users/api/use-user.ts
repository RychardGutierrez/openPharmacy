"use client"

import { useQuery } from "@tanstack/react-query"
import { getUser } from "@/features/users/api/users-api"
import { usersKeys } from "@/features/users/api/use-users"

export function useUser(id: string) {
  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => getUser(id),
    enabled: Boolean(id),
  })
}
