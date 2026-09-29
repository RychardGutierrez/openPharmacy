import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { REPORT_STATUS_LABELS, type ReportJob } from "@/features/reports/types"

export function ReportAsyncBanner({
  isLarge,
  job,
}: {
  isLarge: boolean
  job?: ReportJob
}) {
  if (!isLarge && !job) {
    return <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4" aria-hidden="true" />Este rango es corto y se puede exportar inmediatamente.</div>
  }

  const status = job?.status
  return (
    <div className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", status === "FAILED" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-foreground")} aria-live="polite">
      {status === "FAILED" ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{status ? `Reporte: ${REPORT_STATUS_LABELS[status]}` : "Reporte grande"}</p>
        <p className="text-xs text-muted-foreground">{status === "FAILED" ? job?.errorMessage ?? "No se pudo generar el reporte." : "Los reportes grandes se generan en segundo plano. Te avisaremos cuando estén listos."}</p>
      </div>
      {status ? <Badge variant={status === "FAILED" ? "destructive" : "secondary"}>{REPORT_STATUS_LABELS[status]}</Badge> : null}
    </div>
  )
}
