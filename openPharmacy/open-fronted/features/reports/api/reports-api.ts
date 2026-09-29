import { z } from "zod"

import { useAuthStore } from "@/features/auth/store/auth-store"
import {
  paginatedReportJobsSchema,
  previewSchema,
  reportJobSchema,
  type ReportFiltersValue,
  type ReportFormat,
  type ReportGroupBy,
  type ReportJob,
  type ReportPreview,
  type ReportType,
  type ReportView,
  type PaginatedReportJobs,
} from "@/features/reports/types"

export class ReportsApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ReportsApiError"
    this.status = status
    this.code = code
  }
}

interface ApiErrorBody {
  code?: string
  message?: string | string[]
}

export type ReportRequestResult = {
  kind: "file"
  blob: Blob
  fileName: string
  contentType: string
} | {
  kind: "job"
  job: ReportJob
}

export interface ReportRequestInput extends ReportFiltersValue {
  reportType: ReportType
  format: ReportFormat
}

interface PreviewInput extends ReportFiltersValue {
  reportType: ReportType
  page?: number
  pageSize?: number
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return {}
  }
}

function getError(response: Response, body: ApiErrorBody): ReportsApiError {
  const message = Array.isArray(body.message)
    ? body.message.join(" ")
    : body.message ?? "No se pudo procesar el reporte."
  return new ReportsApiError(response.status, body.code ?? "UNKNOWN", message)
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function requestJson<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...((init.headers as Record<string, string>) ?? {}),
      },
    })
  } catch {
    throw new ReportsApiError(0, "UNKNOWN", "No se pudo conectar con el servidor.")
  }

  if (!response.ok) throw getError(response, await parseErrorBody(response))
  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new ReportsApiError(0, "INVALID_RESPONSE", "La respuesta del servidor no tiene el formato esperado.")
  }
  return parsed.data
}

function buildFilterBody(filters: ReportFiltersValue): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""),
  )
}

function buildQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value))
  }
  const value = query.toString()
  return value ? `?${value}` : ""
}

export function previewReport(input: PreviewInput): Promise<ReportPreview> {
  return requestJson(
    "/reports/preview",
    {
      method: "POST",
      body: JSON.stringify({
        reportType: input.reportType,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 20,
        ...buildFilterBody(input),
      }),
    },
    previewSchema,
  )
}

function getFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get("content-disposition")
  const match = disposition?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? fallback
}

export async function createReport(input: ReportRequestInput): Promise<ReportRequestResult> {
  let response: Response
  try {
    response = await fetch("/api/reports", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        reportType: input.reportType,
        format: input.format,
        ...buildFilterBody(input),
      }),
    })
  } catch {
    throw new ReportsApiError(0, "UNKNOWN", "No se pudo conectar con el servidor.")
  }

  if (!response.ok) throw getError(response, await parseErrorBody(response))

  if (response.status === 202) {
    const parsed = reportJobSchema.safeParse(await response.json())
    if (!parsed.success) throw new ReportsApiError(0, "INVALID_RESPONSE", "Respuesta de reporte inválida.")
    return { kind: "job", job: parsed.data }
  }

  return {
    kind: "file",
    blob: await response.blob(),
    fileName: getFileName(response, `${input.reportType.toLowerCase()}.${input.format.toLowerCase()}`),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  }
}

export function getReportJob(id: string): Promise<ReportJob> {
  return requestJson(`/reports/${id}`, { method: "GET" }, reportJobSchema)
}

export function listReportJobs(params: {
  page?: number
  pageSize?: number
  reportType?: ReportType
  status?: string
} = {}): Promise<PaginatedReportJobs> {
  return requestJson(
    `/reports${buildQuery(params)}`,
    { method: "GET" },
    paginatedReportJobsSchema,
  )
}

export async function downloadReport(id: string): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`/api/reports/${id}/download`, {
    method: "GET",
    credentials: "include",
    headers: authHeaders(),
  })
  if (!response.ok) throw getError(response, await parseErrorBody(response))
  return {
    blob: await response.blob(),
    fileName: getFileName(response, "reporte"),
  }
}

export function reportFilterKey(filters: ReportFiltersValue): string {
  return JSON.stringify(filters)
}

export type { ReportGroupBy, ReportView }
