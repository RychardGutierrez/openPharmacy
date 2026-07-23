"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { refreshSession } from "@/features/auth/api/auth-api"
import { useAuthStore } from "@/features/auth/store/auth-store"

/**
 * Restores the session on first mount by exchanging the HttpOnly refresh
 * cookie for a fresh access token. React Query deduplicates the request,
 * which is required for correctness: the backend rotates refresh tokens,
 * so firing this call twice in parallel would invalidate one of them.
 */
export function useSession() {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)

  const query = useQuery({
    queryKey: ["auth", "session"],
    queryFn: refreshSession,
    enabled: status === "unknown",
    retry: false,
    staleTime: Infinity,
  })

  // Sync the external query result into the session store.
  useEffect(() => {
    if (query.isSuccess) {
      setSession(query.data)
    } else if (query.isError && status === "unknown") {
      // Only clear the session if this refresh query was the authority.
      // If the user logged in while the refresh was still in flight,
      // status will already be "authenticated" and we must not wipe it.
      clearSession()
    }
  }, [query.isSuccess, query.isError, query.data, setSession, clearSession, status])

  return { status, user }
}
