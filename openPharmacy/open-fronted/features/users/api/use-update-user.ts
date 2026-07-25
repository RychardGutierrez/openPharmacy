"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { updateUser } from "@/features/users/api/users-api"
import { usersKeys } from "@/features/users/api/use-users"
import { USERS_ERROR_MESSAGES } from "@/features/users/api/constants"

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, values),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all })
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) })
      toast.success("User updated")
    },
    onError: (error: Error) => {
      toast.error(error.message || USERS_ERROR_MESSAGES.GENERIC)
    },
  })
}
