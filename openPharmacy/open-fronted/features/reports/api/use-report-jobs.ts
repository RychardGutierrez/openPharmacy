"use client"

import { useQuery } from "@tanstack/react-query"
import { listReportJobs } from "@/features/reports/api/reports-api"
import { reportsKeys } from "@/features/reports/api/use-report-preview"
import type { ReportType } from "@/features/reports/types"

export function useReportJobs(params: {
  page?: number
  pageSize?: number
  reportType?: ReportType
  status?: string
} = {}) {
  return useQuery({
    queryKey: reportsKeys.jobs(params),
    queryFn: () => listReportJobs(params),
  })
}
