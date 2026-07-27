"use client"

import { LoaderCircle, CheckCircle2, AlertCircle } from "lucide-react"
import { useSearchProducts } from "@/features/products/api/use-search-products"
import { useDebounce } from "@/shared/hooks/use-debounce"
import { cn } from "@/lib/utils"

export interface BarcodeUniquenessIndicatorProps {
  barcode: string
  /** When editing, the current product's barcode should not trigger a self-conflict. */
  currentBarcode?: string | null
  className?: string
}

/**
 * Debounced barcode uniqueness check. Reuses GET /api/products/search.
 * Only shows a conflict when the debounced query returns at least one product
 * whose barcode is different from the one being edited (if any).
 */
export function BarcodeUniquenessIndicator({
  barcode,
  currentBarcode,
  className,
}: BarcodeUniquenessIndicatorProps) {
  const debounced = useDebounce(barcode, 400)
  const { data: matches, isFetching } = useSearchProducts(debounced)

  const isSelfOnly =
    currentBarcode &&
    debounced === currentBarcode &&
    matches &&
    matches.length === 1 &&
    matches[0]?.barcode === currentBarcode

  const hasConflict = Boolean(
    !isSelfOnly &&
      matches &&
      matches.length > 0 &&
      debounced.trim().length >= 3,
  )

  const isAvailable =
    !isFetching &&
    !hasConflict &&
    debounced.trim().length >= 3 &&
    (!matches || matches.length === 0)

  if (isFetching) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
        <span>Verificando código…</span>
      </span>
    )
  }

  if (hasConflict) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-destructive", className)}>
        <AlertCircle className="size-3" aria-hidden="true" />
        <span>Este código ya existe</span>
      </span>
    )
  }

  if (isAvailable) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-emerald-600", className)}>
        <CheckCircle2 className="size-3" aria-hidden="true" />
        <span>Código disponible</span>
      </span>
    )
  }

  return null
}
