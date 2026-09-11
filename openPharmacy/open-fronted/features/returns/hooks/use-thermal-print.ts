"use client"

import { useCallback, useEffect, useRef } from "react"

export function useThermalPrint(trigger: unknown) {
  const lastTrigger = useRef<unknown>(null)

  const print = useCallback(() => {
    if (typeof window === "undefined") return
    window.print()
  }, [])

  useEffect(() => {
    if (trigger === null || trigger === lastTrigger.current) return
    lastTrigger.current = trigger
    const timer = setTimeout(() => {
      requestAnimationFrame(() => print())
    }, 400)
    return () => clearTimeout(timer)
  }, [trigger, print])

  return print
}
