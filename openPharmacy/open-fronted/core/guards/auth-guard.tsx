"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { useSession } from "@/features/auth/api/use-session"

/**
 * Real enforcement layer for the (dashboard) route group.
 *
 * On mount it exchanges the refresh cookie for an access token
 * (`useSession`). Until that resolves, children are not rendered, so no
 * protected UI flashes. On failure the flag cookie is cleared and the user
 * is sent back to login with a return path.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { status } = useSession()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`)
    }
  }, [status, pathname, router])

  if (status !== "authenticated") {
    return (
      <div
        role="status"
        aria-label="Loading session"
        className="flex min-h-svh items-center justify-center">
        <LoaderCircle
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    )
  }

  return <>{children}</>
}
