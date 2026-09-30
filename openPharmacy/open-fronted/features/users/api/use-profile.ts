"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { changeMyPassword, getMyProfile, updateMyProfile } from "@/features/users/api/users-api"

export const profileKey = ["profile"] as const

export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: getMyProfile })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (user) => {
      useAuthStore.getState().setUser({ id: user.id, fullName: user.fullName, email: user.email, role: user.role })
      queryClient.setQueryData(profileKey, user)
      toast.success("Profile updated")
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changeMyPassword,
    onSuccess: () => {
      useAuthStore.getState().clearSession()
      toast.success("Password updated. Please sign in again.")
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
