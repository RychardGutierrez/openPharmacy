"use client"

import { create } from "zustand"
import type { AuthResponse, AuthUser } from "@/features/auth/types"

/**
 * Lightweight flag consumed by `proxy.ts` for routing decisions only.
 * It is NOT a security boundary: every API call is authorized by the
 * backend JWT, and session restoration goes through the refresh endpoint.
 */
export const SESSION_COOKIE_NAME = "op_session"

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days, mirrors refresh TTL

type AuthStatus = "unknown" | "authenticated" | "unauthenticated"

interface AuthState {
  user: AuthUser | null
  /** In-memory only. Never persisted to localStorage (XSS-safe). */
  accessToken: string | null
  status: AuthStatus
  setSession: (response: AuthResponse) => void
  clearSession: () => void
}

function writeSessionCookie(): void {
  const secure = window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${SESSION_COOKIE_NAME}=1; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; samesite=lax${secure}`
}

function clearSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  // Neutral initial value: first client render must match server HTML.
  status: "unknown",
  setSession: (response) => {
    writeSessionCookie()
    set({
      user: response.user,
      accessToken: response.accessToken,
      status: "authenticated",
    })
  },
  clearSession: () => {
    clearSessionCookie()
    set({ user: null, accessToken: null, status: "unauthenticated" })
  },
}))
