import {
  authResponseSchema,
  type AuthResponse,
  type LoginValues,
} from "@/features/auth/types"
import * as constants from "./constants"

export const AUTH_ERROR_ACCOUNT_LOCKED = "ACCOUNT_LOCKED" as const

export class AuthApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = "AuthApiError"
    this.status = status
    this.code = code
  }
}

interface ApiErrorBody {
  message?: string | string[]
  code?: string
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return {}
  }
}

function toAuthApiError(status: number, body: ApiErrorBody): AuthApiError {
  // Anti-enumeration: never reveal whether the email or the password failed.
  if (status === 401) {
    return new AuthApiError(status, constants.INVALID_CREDENTIALS_MESSAGE)
  }
  if (status === 422 && body.code === AUTH_ERROR_ACCOUNT_LOCKED) {
    const message =
      typeof body.message === "string" ? body.message : constants.ACCOUNT_LOCKED_FALLBACK
    return new AuthApiError(status, message, body.code)
  }
  const message = Array.isArray(body.message)
    ? body.message.join(" ")
    : body.message
  return new AuthApiError(status, message ?? constants.GENERIC_FAILURE_MESSAGE, body.code)
}

async function postAuth(path: string, body?: unknown): Promise<AuthResponse> {
  let response: Response
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
    })
  } catch {
    // Network failure (API unreachable, DNS, CORS, ...).
    throw new AuthApiError(0, constants.GENERIC_FAILURE_MESSAGE)
  }

  if (!response.ok) {
    throw toAuthApiError(response.status, await parseErrorBody(response))
  }

  // Validate payloads at the client boundary: runtime + compile-time safety.
  try {
    return authResponseSchema.parse(await response.json())
  } catch {
    throw new AuthApiError(0, constants.GENERIC_FAILURE_MESSAGE)
  }
}

export function login(values: LoginValues): Promise<AuthResponse> {
  return postAuth("login", values)
}

export function refreshSession(): Promise<AuthResponse> {
  return postAuth("refresh")
}

/** Best effort: the local session is cleared by the caller regardless. */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
  } catch {
    // Ignore: nothing actionable if the API is unreachable here.
  }
}
