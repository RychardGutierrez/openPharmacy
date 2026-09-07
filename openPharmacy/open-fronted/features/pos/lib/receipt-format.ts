const NBSP = /\u00a0/g

const PLAIN_BOB_FORMATTER = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DATE_FORMATTER = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "short",
  timeStyle: "short",
})

export function formatReceiptMoney(value: number): string {
  if (!Number.isFinite(value)) return "Bs 0,00"
  return PLAIN_BOB_FORMATTER.format(value).replace(NBSP, " ")
}

export function formatReceiptDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "-"
  return DATE_FORMATTER.format(date).replace(NBSP, " ")
}
