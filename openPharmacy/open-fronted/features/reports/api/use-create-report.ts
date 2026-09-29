"use client"

import { useMutation } from "@tanstack/react-query"
import { createReport, type ReportRequestInput } from "@/features/reports/api/reports-api"

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: ReportRequestInput) => createReport(input),
  })
}
