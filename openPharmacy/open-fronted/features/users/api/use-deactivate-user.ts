"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { deactivateUser } from "@/features/users/api/users-api"
import { usersKeys } from "@/features/users/api/use-users"
import { USERS_ERROR_MESSAGES } from "@/features/users/api/constants"

export function useDeactivateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all })
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(user.id) })
      toast.success("User deactivated")
    },
    onError: (error: Error) => {
      toast.error(error.message || USERS_ERROR_MESSAGES.GENERIC)
    },
  })
}
