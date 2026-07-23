"use client"

import { useMutation } from "@tanstack/react-query"
import { login } from "@/features/auth/api/auth-api"
import { useAuthStore } from "@/features/auth/store/auth-store"

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: login,
    onSuccess: setSession,
  })
}
