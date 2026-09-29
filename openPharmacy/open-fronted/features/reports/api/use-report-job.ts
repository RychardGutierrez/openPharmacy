"use client"

import { useQuery } from "@tanstack/react-query"
import { getReportJob } from "@/features/reports/api/reports-api"
import { reportsKeys } from "@/features/reports/api/use-report-preview"

export function useReportJob(id: string | undefined) {
  return useQuery({
    queryKey: reportsKeys.job(id ?? ""),
    queryFn: () => getReportJob(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "QUEUED" || status === "PROCESSING" ? 2_000 : false
    },
  })
}
