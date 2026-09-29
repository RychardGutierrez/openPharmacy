"use client"

import { useQuery } from "@tanstack/react-query"
import { previewReport } from "@/features/reports/api/reports-api"
import type { ReportFiltersValue, ReportType } from "@/features/reports/types"

export const reportsKeys = {
  all: ["reports"] as const,
  preview: (reportType: ReportType, filters: ReportFiltersValue, page: number, pageSize: number) => [
    ...reportsKeys.all,
    "preview",
    reportType,
    filters,
    page,
    pageSize,
  ] as const,
  jobs: (params: Record<string, unknown>) => [...reportsKeys.all, "jobs", params] as const,
  job: (id: string) => [...reportsKeys.all, "job", id] as const,
}

export function useReportPreview(
  reportType: ReportType,
  filters: ReportFiltersValue,
  page = 1,
  pageSize = 20,
) {
  return useQuery({
    queryKey: reportsKeys.preview(reportType, filters, page, pageSize),
    queryFn: () => previewReport({ ...filters, reportType, page, pageSize }),
    enabled: Boolean(filters.from && filters.to && filters.timezone),
    staleTime: 15_000,
  })
}
