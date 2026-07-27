const BOB_FORMATTER = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats a decimal value as Bolivianos (BOB). Accepts numbers or numeric
 * strings (the backend returns `Decimal(12,2)` as either depending on the
 * serializer).
 */
export function formatCurrencyBOB(value: number | string): string {
  const numeric = typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(numeric)) return BOB_FORMATTER.format(0)
  return BOB_FORMATTER.format(numeric)
}

/** Parses a numeric input field into a positive number; returns 0 on empty. */
export function parseDecimalInput(raw: string): number {
  if (!raw || raw.trim().length === 0) return 0
  const normalized = raw.replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Reads a query-string parameter and falls back to the default. */
export function readQueryNumber(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
  fallback: number,
): number {
  if (!searchParams) return fallback
  const raw = searchParams[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
