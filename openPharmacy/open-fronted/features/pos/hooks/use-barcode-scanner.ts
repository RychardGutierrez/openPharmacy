"use client"

import { useCallback, useEffect, useState } from "react"

export function useBarcodeScanner(
  onScan: (value: string) => void,
  debounceMs = 50,
) {
  const [value, setValue] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), debounceMs)
    return () => clearTimeout(timer)
  }, [value, debounceMs])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return
      event.preventDefault()
      const raw = event.currentTarget.value.trim()
      if (raw.length === 0) return
      onScan(raw)
      setValue("")
      setDebounced("")
    },
    [onScan],
  )

  return { value, setValue, debounced, handleKeyDown }
}
