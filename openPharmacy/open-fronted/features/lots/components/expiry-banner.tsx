import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  classifyExpiry,
  type LotExpiryStatus,
} from "@/features/lots/types"

export interface ExpiryBannerProps {
  lots: Array<{ expiryDate: string }>
  className?: string
}

export function ExpiryBanner({ lots, className }: ExpiryBannerProps) {
  const worstStatus = lots.reduce<LotExpiryStatus | null>((acc, lot) => {
    const daysUntil = Math.ceil(
      (new Date(lot.expiryDate).setHours(0, 0, 0, 0) -
        new Date().setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24),
    )
    const status = classifyExpiry(daysUntil)
    if (!acc) return status
    if (status === "RED" || acc === "RED") return "RED"
    if (status === "ORANGE" || acc === "ORANGE") return "ORANGE"
    return "GREEN"
  }, null)

  if (!worstStatus || worstStatus === "GREEN") return null

  return (
    <Alert
      variant={worstStatus === "RED" ? "destructive" : "default"}
      role="alert"
      aria-live="polite"
      className={className}
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>
        {worstStatus === "RED"
          ? "Hay lotes vencidos o por vencer"
          : "Hay lotes próximos a vencer"}
      </AlertTitle>
      <AlertDescription>
        {worstStatus === "RED"
          ? "Revisa los lotes marcados en rojo antes de dispensar."
          : "Algunos lotes vencerán en los próximos 60 días."}
      </AlertDescription>
    </Alert>
  )
}
