"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleGate } from "@/core/guards/role-guard"
import { downloadReport } from "@/features/reports/api/reports-api"
import { useCreateReport } from "@/features/reports/api/use-create-report"
import { useReportJobs } from "@/features/reports/api/use-report-jobs"
import { useReportJob } from "@/features/reports/api/use-report-job"
import { useReportPreview } from "@/features/reports/api/use-report-preview"
import { ReportActions } from "@/features/reports/components/report-actions"
import { ReportAsyncBanner } from "@/features/reports/components/report-async-banner"
import { ReportFilters } from "@/features/reports/components/report-filters"
import { ReportPreviewTable } from "@/features/reports/components/report-preview-table"
import { RecentReports } from "@/features/reports/components/recent-reports"
import { ReportTypeGrid } from "@/features/reports/components/report-type-grid"
import {
  REPORT_DEFINITIONS,
  type ReportDefinition,
  type ReportFiltersValue,
} from "@/features/reports/types"
import { useQueryClient } from "@tanstack/react-query"

function localDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function initialFilters(): ReportFiltersValue {
  const today = localDate()
  return {
    from: today,
    to: today,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/La_Paz",
    horizonDays: 90,
  }
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function ReportsPageClient() {
  const queryClient = useQueryClient()
  const [definition, setDefinition] = useState<ReportDefinition>(REPORT_DEFINITIONS[0])
  const [filters, setFilters] = useState<ReportFiltersValue>(initialFilters)
  const [page, setPage] = useState(1)
  const [jobId, setJobId] = useState<string>()

  const effectiveReportType = definition.id === "returns-adjustments" && filters.view === "ADJUSTMENTS"
    ? "INVENTORY_MOVEMENTS"
    : definition.reportType

  const preview = useReportPreview(effectiveReportType, {
    ...filters,
    groupBy: definition.groupBy,
  }, page, 20)
  const create = useCreateReport()
  const jobQuery = useReportJob(jobId)
  const recent = useReportJobs({ page: 1, pageSize: 5 })

  useEffect(() => {
    if (jobQuery.data?.status === "COMPLETED") {
      toast.success("El reporte está listo para descargar.")
      void queryClient.invalidateQueries({ queryKey: ["reports", "jobs"] })
    }
    if (jobQuery.data?.status === "FAILED") {
      toast.error(jobQuery.data.errorMessage ?? "No se pudo generar el reporte.")
    }
  }, [jobQuery.data?.status, jobQuery.data?.errorMessage, queryClient])

  const asyncJob = jobQuery.data
  const isGenerating = create.isPending || asyncJob?.status === "QUEUED" || asyncJob?.status === "PROCESSING"
  const isLarge = Boolean(preview.data?.isLargeReport)

  const handleSelectDefinition = (next: ReportDefinition) => {
    const today = new Date()
    const todayValue = localDate(today)
    const monthStart = localDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setDefinition(next)
    setPage(1)
    setJobId(undefined)
    setFilters((current) => ({
      ...current,
      from: next.dateMode === "month" ? monthStart : todayValue,
      to: todayValue,
      groupBy: next.groupBy,
      view: next.defaultView,
      movementType: next.defaultView === "ADJUSTMENTS" ? "MANUAL_ADJUSTMENT" : undefined,
    }))
  }

  const handleFiltersChange = (next: ReportFiltersValue) => {
    setFilters(next)
    setPage(1)
    setJobId(undefined)
  }

  const handleExport = async (format: "XLSX" | "PDF") => {
    try {
      const result = await create.mutateAsync({
        reportType: effectiveReportType,
        format,
        ...filters,
        groupBy: definition.groupBy,
      })
      if (result.kind === "file") {
        saveBlob(result.blob, result.fileName)
        toast.success("Reporte descargado.")
      } else {
        setJobId(result.job.id)
        toast.info("El reporte se está generando en segundo plano.")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el reporte.")
    }
  }

  const handleDownload = async (job: { id: string; fileName: string | null }) => {
    try {
      const file = await downloadReport(job.id)
      saveBlob(file.blob, file.fileName || job.fileName || "reporte")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el reporte.")
    }
  }

  return (
    <RoleGate allowedRoles={["ADMIN", "PHARMACIST"]}>
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Análisis operativo</p>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Explora el rendimiento de la farmacia, revisa el inventario y exporta información para tu operación.</p>
        </div>

        <ReportTypeGrid selectedId={definition.id} onSelect={handleSelectDefinition} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportFilters value={filters} definition={definition} onChange={handleFiltersChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-end justify-between gap-4">
            <div>
              <CardTitle className="text-base">Vista previa</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{preview.data?.total ?? 0} registros encontrados · página {preview.data?.page ?? page} de {preview.data?.totalPages ?? 1}</p>
            </div>
            {preview.data?.estimatedRows !== undefined ? <span className="hidden text-xs text-muted-foreground sm:inline">Estimado: {preview.data.estimatedRows.toLocaleString("es-BO")} filas</span> : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {preview.error ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{preview.error instanceof Error ? preview.error.message : "No se pudo cargar la vista previa."}</p> : <ReportPreviewTable preview={preview.data} isLoading={preview.isLoading || preview.isFetching} />}

            {preview.data && preview.data.totalPages > 1 ? <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Mostrando {preview.data.rows.length} filas de la vista previa</span><div className="flex gap-2"><button type="button" className="rounded-md border px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><button type="button" className="rounded-md border px-3 py-1.5 disabled:opacity-40" disabled={page >= preview.data.totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div></div> : null}

            <ReportAsyncBanner isLarge={isLarge} job={asyncJob} />
            <ReportActions isPending={isGenerating} disabled={preview.isLoading || Boolean(asyncJob && asyncJob.status !== "FAILED" && asyncJob.status !== "COMPLETED")} onExport={handleExport} />
          </CardContent>
        </Card>

        <RecentReports jobs={recent.data?.data ?? []} onDownload={handleDownload} />
      </div>
    </RoleGate>
  )
}
