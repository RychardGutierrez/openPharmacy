"use client"

import { Download, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, type ReportJob } from "@/features/reports/types"

export function RecentReports({
  jobs,
  onDownload,
}: {
  jobs: ReportJob[]
  onDownload: (job: ReportJob) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileText className="size-4 text-muted-foreground" aria-hidden="true" />Reportes recientes</CardTitle>
        <CardDescription>Consulta el estado de tus exportaciones anteriores.</CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no tienes reportes generados.</p> : <div className="flex flex-col divide-y">{jobs.slice(0, 5).map((job) => <div key={job.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{REPORT_TYPE_LABELS[job.reportType]}</p><p className="text-xs text-muted-foreground">{job.format} · {new Date(job.requestedAt).toLocaleString("es-BO")}</p></div><div className="flex items-center gap-2"><Badge variant={job.status === "FAILED" ? "destructive" : job.status === "COMPLETED" ? "secondary" : "outline"}>{REPORT_STATUS_LABELS[job.status]}</Badge>{job.status === "COMPLETED" && job.fileName ? <Button type="button" variant="ghost" size="sm" onClick={() => onDownload(job)}><Download aria-hidden="true" />Descargar</Button> : null}</div></div>)}</div>}
      </CardContent>
    </Card>
  )
}
