"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { COMPLIANCE_WARNING_TEXT } from "@/features/products/types"

export interface ComplianceWarningBannerProps {
  className?: string
}

/**
 * Inline warning shown when the selected category is Psychotropic or Narcotic.
 * Includes aria-live="polite" so screen readers announce it immediately.
 */
export function ComplianceWarningBanner({ className }: ComplianceWarningBannerProps) {
  return (
    <Alert
      variant="destructive"
      role="alert"
      aria-live="polite"
      className={className}
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Flujo SEDES obligatorio</AlertTitle>
      <AlertDescription>{COMPLIANCE_WARNING_TEXT}</AlertDescription>
    </Alert>
  )
}
