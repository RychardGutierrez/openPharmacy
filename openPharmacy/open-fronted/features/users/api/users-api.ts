import { z } from "zod"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { USER_ROLES } from "@/features/auth/types"
import {
  paginatedUsersSchema,
  userSchema,
  type PaginatedUsers,
  type User,
  type UserFormValues,
} from "@/features/users/types"
import { USERS_ERROR_MESSAGES, type UsersErrorCode } from "@/features/users/api/constants"

export class UsersApiError extends Error {
  readonly status: number
  readonly code: UsersErrorCode

  constructor(status: number, code: UsersErrorCode, message: string) {
    super(message)
    this.name = "UsersApiError"
    this.status = status
    this.code = code
  }
}

export interface UsersListQuery {
  page?: number
  pageSize?: number
  role?: (typeof USER_ROLES)[number]
  active?: boolean
  q?: string
}

interface ApiErrorBody {
  statusCode?: number
  code?: string
  message?: string | string[]
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return {}
  }
}

function getErrorMessage(body: ApiErrorBody): { code: UsersErrorCode; message: string } {
  const code = (body.code ?? "UNKNOWN") as UsersErrorCode
  const fallback = USERS_ERROR_MESSAGES[code as keyof typeof USERS_ERROR_MESSAGES] ?? USERS_ERROR_MESSAGES.GENERIC
  if (Array.isArray(body.message)) {
    return { code, message: body.message.join(" ") }
  }
  return { code, message: body.message ?? fallback }
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: "include" })
  } catch {
    throw new UsersApiError(0, "UNKNOWN", USERS_ERROR_MESSAGES.GENERIC)
  }

  if (!response.ok) {
    const { code, message } = getErrorMessage(await parseErrorBody(response))
    throw new UsersApiError(response.status, code, message)
  }

  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new UsersApiError(0, "UNKNOWN", USERS_ERROR_MESSAGES.GENERIC)
  }
  return parsed.data
}

function buildQueryString(query: UsersListQuery): string {
  const params = new URLSearchParams()
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  if (query.role) params.set("role", query.role)
  if (typeof query.active === "boolean") params.set("active", String(query.active))
  if (query.q && query.q.trim().length > 0) params.set("q", query.q.trim())
  const qs = params.toString()
  return qs.length > 0 ? `?${qs}` : ""
}

export function listUsers(query: UsersListQuery = {}): Promise<PaginatedUsers> {
  return request(`/users${buildQueryString(query)}`, { method: "GET" }, paginatedUsersSchema)
}

export function getUser(id: string): Promise<User> {
  return request(`/users/${id}`, { method: "GET" }, userSchema)
}

export function createUser(values: UserFormValues): Promise<User> {
  return request("/users", { method: "POST", body: JSON.stringify(values) }, userSchema)
}

export function updateUser(id: string, values: UserFormValues): Promise<User> {
  return request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(values) }, userSchema)
}

export function deactivateUser(id: string): Promise<User> {
  return request(`/users/${id}/deactivate`, { method: "PATCH" }, userSchema)
}

export function activateUser(id: string): Promise<User> {
  return request(`/users/${id}/activate`, { method: "PATCH" }, userSchema)
}
