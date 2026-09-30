"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/features/auth/store/auth-store"

export type DashboardStreamStatus = "connecting" | "live" | "disconnected"

export function useDashboardStream(onEvent: () => void) {
  const token = useAuthStore((state) => state.accessToken)
  const [status, setStatus] = useState<DashboardStreamStatus>("connecting")
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    async function connect() {
      setStatus("connecting")
      try {
        const response = await fetch("/api/dashboard/stream", {
          headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
          credentials: "include",
          signal: controller.signal,
        })
        if (!response.ok || !response.body) throw new Error("SSE connection failed")
        setStatus("live")
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        while (!stopped) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true })
          const events = buffer.split(/\r?\n\r?\n/)
          buffer = events.pop() ?? ""
          for (const event of events) {
            if (event.split(/\r?\n/).some((line) => line.startsWith("data:"))) onEvent()
          }
        }
      } catch {
        if (stopped) return
        setStatus("disconnected")
        retryTimer = setTimeout(connect, 3000)
      }
    }

    void connect()
    return () => {
      stopped = true
      controller.abort()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [token, onEvent])

  return status
}
