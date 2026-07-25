import { useEffect, useState } from "react"

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms
 * of inactivity. Useful for search inputs that drive network requests.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])

  return debounced
}
