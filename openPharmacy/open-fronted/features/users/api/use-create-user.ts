"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createUser } from "@/features/users/api/users-api"
import { usersKeys } from "@/features/users/api/use-users"
import { USERS_ERROR_MESSAGES } from "@/features/users/api/constants"

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all })
      toast.success("User created")
    },
    onError: (error: Error) => {
      toast.error(error.message || USERS_ERROR_MESSAGES.GENERIC)
    },
  })
}
